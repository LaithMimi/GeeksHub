from schemas import AIChatRequest
import os
from google.genai import types
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import engine, get_session
from models import User, Material, MaterialChunk
from utils.auth_utils import get_verified_user
from utils.ai_utils import client, search_material_context

router = APIRouter(tags=["AI Study Companion"])


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


@router.post("/api/v1/assistant/chat")
def ask_ai_tutor(
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

        # 4. Convert frontend history into Gemini Content objects
        gemini_history = []
        for msg in payload.history:
            gemini_history.append(
                types.Content(
                    role="user" if msg.role == "user" else "model",
                    parts=[types.Part.from_text(msg.content)]
                )
            )

        # 5. Create the Agent with the Tool enabled and conversation history
        chat = client.chats.create(
            model='gemini-1.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=[search_course_knowledge],
                temperature=0.3  # Keep it focused and academic
            ),
            history=gemini_history  # Multi-turn memory!
        )

        # 6. Send the message and get the response!
        response = chat.send_message(payload.message)
        
        return {
            "reply": response.text,
            "agentAction": "tool_used" if getattr(response, 'function_calls', None) else "direct_answer"
        }

    except HTTPException:
        raise  # Re-raise 404s and other HTTP exceptions as-is

    except Exception as e:
        print(f"AI Error: {e}")
        raise HTTPException(
            status_code=503, 
            detail="The AI Tutor is currently helping a lot of students! Please take a deep breath and try again in a few seconds."
        )