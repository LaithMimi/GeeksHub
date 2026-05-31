from schemas import AIChatRequest
import os
import threading
from google.genai import types
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception
from fastapi import APIRouter, Depends, HTTPException, Request
import time
import traceback
from slowapi import Limiter
from cachetools import TTLCache
from slowapi.util import get_remote_address
from sqlmodel import Session, select
from database import engine, get_session
from models import User, Material, MaterialChunk
from utils.auth_utils import get_verified_user
from utils.ai_utils import client, search_material_context

router = APIRouter(tags=["AI Study Companion"])
limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# Gemini Function-Calling Tool
# ---------------------------------------------------------------------------
# The Gemini agent can invoke this tool when the student's question goes
# beyond the current document (e.g. "Was this on last year's exam?").
# It opens its own Session because function-calling executes outside the
# normal request lifecycle.
# ---------------------------------------------------------------------------

def search_course_knowledge(query: str, course_id: str) -> str:
    """
    Searches the database for related course materials.
    Call this tool if the user asks about exams, other lectures, or concepts not in the current document.
    """
    with Session(engine) as session:
        return search_material_context(query, course_id, session, limit=3)

# Global in-memory store for Gemini Document Caches
# Maps material_id -> (cache_name, expiry_timestamp)
_active_document_caches = TTLCache(maxsize=200, ttl=3600)
_cache_lock = threading.Lock()

CHAT_MODEL = "gemini-2.5-flash"  # confirmed working on this account

# API Resilience: Retry on transient errors only — explicitly exclude HTTPException
# so 404s and auth errors are NOT retried and bubble up immediately.
@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(3),
    retry=retry_if_exception(lambda e: not isinstance(e, (HTTPException, KeyboardInterrupt, SystemExit)))
)
def _send_chat_message_with_retry(chat, message):
    return chat.send_message(message)

@router.post("/api/v1/assistant/chat")
@limiter.limit("20/minute")  # Basic rate limit to prevent abuse; adjust as needed
def ask_ai_tutor(
    request: Request,
    payload: AIChatRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    try:
        # 1. Look up the Material to get course_id (frontend only sends fileId)
        material = session.get(Material, payload.fileId)
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        
        course_id = str(material.course_id)

        # 2. Fetch ALL chunks for the current file, ordered by page number
        #    so the AI reads the document in the correct order.
        #    Gemini's 1M token context window can easily handle full lectures.
        current_file_chunks = session.exec(
            select(MaterialChunk)
            .where(MaterialChunk.material_id == payload.fileId)
            .order_by(MaterialChunk.page_number)
        ).all()
        
        base_context = "\n".join([chunk.content for chunk in current_file_chunks])

        # 3. Build the system prompt
        system_prompt = f"""You are the GeeksHub AI Study Companion — a knowledgeable, supportive tutor for university students at Azrieli College of Engineering.

You are currently helping **{current_user.name}** study.

─────────────────────────────
CURRENT DOCUMENT (on their screen right now):
─────────────────────────────
{base_context}
─────────────────────────────

## YOUR CAPABILITIES
You have access to the `search_course_knowledge` tool which can search across ALL materials in this course, including:
• **Lecture slides & notes** — Professor presentations and handwritten notes
• **Past exams** — Midterms, finals, and quizzes from previous years  
• **Homework assignments & solutions** — Problem sets and worked examples
• **Summaries** — Student-created study guides and condensed notes
• **Lab reports & exercises** — Practical assignments and experiments

## RULES

1. **Answer from the document first.** If the answer is clearly in the CURRENT DOCUMENT above, use it directly. Cite the relevant section or page when possible.

2. **Use the tool for cross-material questions.** If the student asks about content NOT in the current document — such as "Was this topic on last year's exam?", "What did the professor say about this in another lecture?", or "Are there practice problems for this?" — call `search_course_knowledge` with the query and course_id `{course_id}`. Do NOT fabricate answers.

3. **Socratic method for homework.** If the student asks you to solve a homework problem or assignment directly, DO NOT give the full solution. Instead:
   - Ask them what they've tried so far
   - Give a hint or point them to the relevant concept
   - Walk them through the logic step-by-step
   
4. **Exam preparation support.** If the student asks for help preparing for an exam, you CAN:
   - Summarize key topics from the course materials
   - Create practice questions based on the lecture content
   - Explain how past exam questions relate to the current material
   - Suggest study strategies based on the material type

5. **Formatting.** Use markdown for clarity — bullet points, bold key terms, code blocks for formulas or code. Keep explanations concise but thorough.

6. **Language.** Respond in the same language the student writes in. The platform serves Hebrew, Arabic, and English speakers.

7. **Boundaries.** If a question is completely unrelated to the course or academic work, politely redirect: "I'm here to help with your coursework! Could you rephrase your question in relation to the material?"

8. **Be encouraging.** Students are stressed. Acknowledge good questions, celebrate when they understand something, and never be condescending."""

        # 4. Convert frontend history into Gemini Content objects (Sliding Window)
        # IMPORTANT: Gemini requires history to alternate user/model starting with 'user'.
        # The frontend sends the AI welcome message first (role='assistant') — skip it.
        gemini_history = []
        recent_history = payload.history[-10:] if len(payload.history) > 10 else payload.history
        for msg in recent_history:
            # Skip the static welcome message (id='1') — it's not a real exchange
            if msg.role == "assistant" and not gemini_history:
                continue
            gemini_history.append(
                types.Content(
                    role="user" if msg.role == "user" else "model",
                    parts=[types.Part(text=msg.content)]
                )
            )

        # 5. Handle Context Caching for large documents
        # Gemini caching requires at least 32,768 tokens (roughly 130,000 characters).
        is_large_enough = len(base_context) > 135000
        cache_name = None
        
        if is_large_enough:
            mat_id = str(material.id)
            with _cache_lock:
                cached_data = _active_document_caches.get(mat_id)
                if cached_data and cached_data[1] > time.time():
                    # Cache is still valid
                    cache_name = cached_data[0]
                else:
                    # Create a new cache (lock held so only one thread does this)
                    try:
                        new_cache = client.caches.create(
                            model='models/gemini-2.5-flash',
                            config=types.CreateCachedContentConfig(
                                system_instruction=system_prompt,
                                contents=[types.Content(role="user", parts=[types.Part(text="Here is the document context:\n" + base_context)])],
                                ttl="3600s"
                            )
                        )
                        cache_name = new_cache.name
                        _active_document_caches[mat_id] = (cache_name, time.time() + 3500)
                    except Exception as e:
                        print(f"Cache creation skipped/failed: {e}")

        # 6. Create the Agent with the Tool enabled
        if cache_name:
            chat = client.chats.create(
                model=CHAT_MODEL,
                config=types.GenerateContentConfig(
                    cached_content=cache_name,
                    tools=[search_course_knowledge],
                    temperature=0.3
                ),
                history=gemini_history
            )
        else:
            chat = client.chats.create(
                model=CHAT_MODEL,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    tools=[search_course_knowledge],
                    temperature=0.3
                ),
                history=gemini_history
            )

        # 6. Send the message and get the response (with auto-retry)
        response = _send_chat_message_with_retry(chat, payload.message)
        
        return {
            "reply": response.text,
            "agentAction": "tool_used" if getattr(response, 'function_calls', None) else "direct_answer"
        }

    except HTTPException:
        raise  # Re-raise 404s and auth errors as-is

    except Exception as e:
        print(f"[AI CHAT ERROR] {type(e).__name__}: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=503, 
            detail="The AI Tutor is currently helping a lot of students! Please take a deep breath and try again in a few seconds."
        )