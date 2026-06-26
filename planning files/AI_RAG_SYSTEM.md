# GeeksHub AI & RAG System Architecture

This document explains how the AI Study Companion and Retrieval-Augmented Generation (RAG) system is implemented in the GeeksHub project.

## Overview
The AI Study Companion acts as a knowledgeable, supportive tutor for university students. It combines a large context window for reading current documents with a RAG system to search across all course materials (slides, past exams, summaries) when needed.

The core technologies used are:
- **Google Gemini API**: Uses `gemini-2.5-flash` for chat and `gemini-embedding-001` for vector embeddings.
- **PostgreSQL & pgvector**: Stores 1536-dimensional vector embeddings with an HNSW index for fast similarity search.
- **SQLModel / SQLAlchemy**: ORM for database interactions.
- **FastAPI**: Backend framework serving the AI endpoints.
- **PyPDF**: Extracts text from PDF materials.
- **Tenacity**: Automatic retry library for API resilience.

---

## 1. Document Processing & Embedding

When a new document (PDF) is approved by an admin, it is processed and embedded in the background. This logic lives in `server/utils/ai_utils.py` (`process_and_embed_pdf`).

### Step-by-step flow:

1. **Extraction**: `pypdf` reads all pages and concatenates them into a single string, keeping track of which character offset corresponds to which page number.

2. **Overlapping Semantic Chunking**: Instead of splitting strictly by page (which can cut sentences and formulas in half), the text is sliced into **1000-character chunks with a 200-character overlap**. Each chunk is mapped back to its originating page number. This ensures no sentence or paragraph is severed across a chunk boundary.

3. **Batch Embedding**: Chunks are sent to the `gemini-embedding-001` model in **mini-batches of 100** to stay within the API's per-request size limit. The `output_dimensionality` parameter truncates the native 3072-dimensional output to **1536 dimensions** — preserving quality while staying under pgvector's HNSW 2000-dimension cap.

4. **Storage**: Each chunk — with its text, page number, and 1536-dimensional embedding vector — is saved as a `MaterialChunk` row in PostgreSQL.

### Key constants (`server/utils/ai_utils.py`):
```python
EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM   = 1536   # truncated from 3072; fits pgvector HNSW ≤ 2000 limit
```

---

## 2. Vector Index (HNSW)

The `MaterialChunk.embedding` column has an **HNSW (Hierarchical Navigable Small World)** index configured for cosine distance. This makes vector searches scale efficiently as the database grows — without it, every query would perform a slow sequential scan.

```sql
CREATE INDEX hnsw_index_for_material_chunks
ON material_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

Defined in `server/models.py` via `sqlalchemy.Index` in `MaterialChunk.__table_args__`.

---

## 3. Chat Interface & Context Window

The main chat endpoint is `POST /api/v1/assistant/chat` (`server/routers/ai.py`).

### Request flow:

1. **Full Document Context**: All `MaterialChunk`s for the currently-viewed file are fetched and ordered by page number. The full document text is injected directly into the system prompt. Because `gemini-2.5-flash` has a massive context window, the *entire* current document is available to the AI without any retrieval step.

2. **Sliding Window History**: The frontend sends conversation history with each request. To prevent payload bloat during long study sessions, only the **last 10 messages** are kept. The AI welcome message (the very first assistant message with id=`"1"`) is also stripped from history since Gemini requires history to start with a `user` turn.

3. **Context Caching (large documents)**: For documents exceeding ~135,000 characters (~32k tokens), the system prompt and document are uploaded to Google's **Context Caching API** with a 1-hour TTL. Subsequent messages in the same session reuse the cache, saving processing time and token costs. Active caches are tracked in `_active_document_caches` (an in-memory dict).

4. **System Prompt**: The AI is instructed to:
   - Answer from the current document first, citing sections/pages.
   - Use the `search_course_knowledge` tool for cross-material questions.
   - Apply the **Socratic method** for homework (hints, not solutions).
   - Help with exam prep, formatting, and multi-language support (Hebrew, Arabic, English).

---

## 4. Metadata-Aware RAG (Agentic Tool Calling)

When a student asks about content outside the current file — e.g. *"Was this on last year's exam?"* — the AI autonomously calls the `search_course_knowledge` tool.

### How it works:

1. **Embedding the query**: The student's question is embedded using `gemini-embedding-001` (also with `output_dimensionality=1536`).

2. **Cosine Distance Vector Search**: The embedding is compared against all `MaterialChunk` rows using pgvector's `cosine_distance` operator, ordered by similarity.

3. **Metadata Filter**: The query joins `MaterialChunk` with `Material` and filters strictly by `course_id`. This prevents the AI from accidentally retrieving chunks from a different course with similar terminology.

4. **Augmentation**: The top-k most relevant chunks are returned as plain text, which Gemini synthesizes into a grounded answer.

```python
# server/utils/ai_utils.py — search_material_context()
statement = (
    select(MaterialChunk)
    .join(Material)
    .where(Material.course_id == course_id)
    .order_by(MaterialChunk.embedding.cosine_distance(query_vector))
    .limit(limit)
)
```

---

## 5. API Resilience

Both the embedding and chat paths use **Tenacity** for automatic retries on transient API failures (rate limits, network blips, temporary server errors).

| Function | Retries | Backoff | Excludes |
|---|---|---|---|
| `_embed_content_with_retry` | 5 attempts | 2–30s exponential | `KeyboardInterrupt`, `SystemExit` |
| `_send_chat_message_with_retry` | 3 attempts | 2–30s exponential | `HTTPException`, `KeyboardInterrupt`, `SystemExit` |

`HTTPException` is explicitly excluded from the chat retry so that 404s (material not found) and 401s (auth errors) bubble up immediately without wasting retry slots.

---

## 6. Frontend Integration

The AI panel is implemented in `src/components/assistant/AssistantPanel.tsx` and communicates via `src/services/assistantService.ts`.

- **`POST /api/v1/assistant/chat`** — sends `{ fileId, message, history }` and receives `{ reply, agentAction }`.
- The panel opens alongside the PDF viewer in `src/components/pages/FilePage.tsx`.
- Selecting text in the PDF and clicking **"Ask AI"** pre-fills the chat input.
- Responses can be **copied** or **pinned to the sticky notes board**.

---

## Model Reference

| Purpose | Model | Dimensions |
|---|---|---|
| Chat / Reasoning | `gemini-2.5-flash` | — |
| Embeddings | `gemini-embedding-001` | 1536 (truncated) |
