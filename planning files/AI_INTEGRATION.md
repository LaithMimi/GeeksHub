# GeeksHub — AI Integration

> How the AI Study Companion and the Retrieval‑Augmented Generation (RAG) system work, end to end — from a student's question to a grounded answer. For the surrounding system see [ARCHITECTURE.md](./ARCHITECTURE.md) and [BACKEND.md](./BACKEND.md). (An earlier write‑up lives in `AI_RAG_SYSTEM.md`; this file is the consolidated, current version.)

---

## 1. What the AI Does

The **AI Study Companion** is an in‑app tutor for students. It is designed to:

- **Read the document on screen.** The full text of the currently‑viewed PDF is loaded into the model's context, so it can answer directly from what the student is looking at.
- **Search the whole course when needed.** If a question reaches beyond the current file ("was this on last year's exam?"), the model autonomously searches across *all* materials in that course using vector similarity.
- **Tutor, not just answer.** It uses the Socratic method for homework (hints, not full solutions), helps with exam prep, formats with markdown, and replies in the student's language (Hebrew, Arabic, English).

---

## 2. Technology

| Purpose | Technology | Detail |
|---|---|---|
| Chat / reasoning | Google Gemini `gemini-2.5-flash` | Large context window; function‑calling enabled. |
| Embeddings | Google Gemini `gemini-embedding-001` | Native 3072‑dim, truncated to **1536** via `output_dimensionality`. |
| Vector store | PostgreSQL + **pgvector** | `MaterialChunk.embedding` column, HNSW index, cosine distance. |
| PDF text | **pypdf** | Page‑aware text extraction. |
| Resilience | **Tenacity** | Automatic retries on transient API errors. |
| Serving | **FastAPI** | `server/routers/ai.py`. |

The 1536 dimension is deliberate: it keeps embedding quality high while staying under pgvector's HNSW 2000‑dimension cap.

---

## 3. The Files Involved

| File | Role in the pipeline |
|---|---|
| `server/utils/ai_utils.py` | **Core engine.** Initializes the Gemini `client`; `process_and_embed_pdf` (ingestion) and `search_material_context` (retrieval). |
| `server/routers/ai.py` | **Chat endpoint.** `POST /assistant/chat` — builds the prompt, runs Gemini with the search tool, handles context caching and retries. Also `/me/notes`. |
| `server/routers/admin.py` | **Ingestion trigger.** On file approval, schedules a background task that downloads the PDF from GCS and calls `process_and_embed_pdf`. |
| `server/models.py` | **Schema.** `MaterialChunk` (text + 1536‑dim `Vector` + HNSW index) and `Material`. |
| `server/schemas.py` | **Contract.** `AIChatRequest`, `ChatMessage`. |
| `src/features/assistant/api/assistantService.ts` | **Frontend caller.** `sendMessage(fileId, message, history)`. |
| `src/features/assistant/components/AssistantPanel.tsx` (+ `AssistantChat`, `NotesBoard`) | **Frontend UI.** Chat + sticky notes, opened beside the PDF viewer. |

---

## 4. Ingestion — Embedding a Document

Runs **once, in the background, when an admin approves an upload** (`admin.py` → `embed_single`/`embed_batch` → `ai_utils.process_and_embed_pdf`). It opens its own DB session because the request session is already closed by the time the background task runs.

Steps (`process_and_embed_pdf`):

1. **Extract** — `pypdf` reads every page; text is concatenated while tracking which character offset belongs to which page number.
2. **Chunk with overlap** — the text is sliced into **1000‑character chunks with a 200‑character overlap** (rather than splitting strictly by page) so sentences and formulas aren't cut across boundaries. Each chunk is tagged with its originating page number.
3. **Embed in batches** — chunks are sent to `gemini-embedding-001` in **mini‑batches of 100**, truncated to **1536 dims**.
4. **Store** — each chunk (text + page number + embedding) is written as a `MaterialChunk` row.

Scanned/image‑only PDFs (no extractable text) are skipped gracefully.

```
Approved PDF (GCS) ─► pypdf extract ─► 1000-char/200-overlap chunks
   ─► gemini-embedding-001 (batches of 100, 1536-dim)
   ─► MaterialChunk rows (Postgres + pgvector, HNSW index)
```

---

## 5. The Vector Index (HNSW)

`MaterialChunk.embedding` has an HNSW index for cosine distance, defined in `models.py`:

```sql
CREATE INDEX hnsw_index_for_material_chunks
ON material_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

HNSW keeps similarity search fast as the corpus grows — without it every query would do a full sequential scan.

---

## 6. Chat — Answering a Question

Endpoint: `POST /api/v1/assistant/chat` (`ai.py`), authenticated via `get_verified_user`.

1. **Resolve the document.** The frontend sends only `fileId`; the backend loads the `Material` to get its `course_id` (404 if missing).
2. **Load full document context.** All `MaterialChunk`s for the file are fetched **ordered by page number** and concatenated. Because `gemini-2.5-flash` has a huge context window, the *entire* current document is injected into the system prompt — no retrieval needed for on‑document questions.
3. **Build the system prompt.** It identifies the student by name, embeds the document, lists the tutor rules (answer from the document first; use the tool for cross‑material questions; Socratic method for homework; exam‑prep support; markdown; match the student's language; stay on academic topics; be encouraging).
4. **Trim history (sliding window).** Only the **last 10 messages** are replayed. The static welcome message (the first `assistant` message) is stripped because Gemini requires history to start with a `user` turn.
5. **Context caching for big documents.** If the document exceeds ~135,000 characters (~32k tokens), the system prompt + document are uploaded to Gemini's **Context Caching API** with a 1‑hour TTL, tracked in an in‑memory `_active_document_caches` dict. Subsequent turns reuse the cache to save tokens and latency.
6. **Run the agent with a tool.** A `chats` session is created with the `search_course_knowledge` function‑calling tool enabled and `temperature=0.3`.
7. **Return** `{ reply, agentAction }`, where `agentAction` is `"tool_used"` if Gemini invoked the search tool, else `"direct_answer"`.

```
fileId ─► load Material (course_id) ─► load all chunks (ordered) ─► system prompt
   ─► trim history to last 10 ─► [cache if >135k chars]
   ─► gemini-2.5-flash + search_course_knowledge tool
   ─► reply (+ whether the tool was used)
```

---

## 7. Metadata‑Aware RAG — The Search Tool

When the student asks about something outside the current file, Gemini autonomously calls `search_course_knowledge(query, course_id)` (defined in `ai.py`, backed by `ai_utils.search_material_context`). It opens its own session because tool execution happens outside the normal request flow.

`search_material_context`:
1. **Embed the query** with `gemini-embedding-001` (also 1536‑dim).
2. **Vector search with a metadata filter** — join `MaterialChunk` to `Material`, filter strictly by `course_id`, order by `embedding.cosine_distance(query_vector)`, take the top‑k (default 3 from the tool).
3. **Return the matching chunk text**, which Gemini synthesizes into a grounded answer.

The `course_id` filter is what makes the RAG "metadata‑aware" — it prevents pulling chunks from a *different* course that happen to use similar terminology.

```sql
SELECT * FROM material_chunks mc
JOIN materials m ON mc.material_id = m.id
WHERE m.course_id = :course_id
ORDER BY mc.embedding <=> :query_vector   -- cosine distance
LIMIT :k;
```

---

## 8. Resilience

| Function | Attempts | Backoff | Excludes |
|---|---|---|---|
| `_embed_content_with_retry` (`ai_utils.py`) | 5 | 2–30s exponential | `KeyboardInterrupt`, `SystemExit` |
| `_send_chat_message_with_retry` (`ai.py`) | 3 | 2–30s exponential | `HTTPException`, `KeyboardInterrupt`, `SystemExit` |

Chat retries deliberately **exclude `HTTPException`** so a 404 (material not found) or auth error fails fast instead of burning retry attempts. If the chat path ultimately fails, the endpoint returns a friendly `503` ("the AI Tutor is helping a lot of students…") rather than leaking internals.

---

## 9. Frontend Integration

- `src/features/assistant/api/assistantService.ts` → `sendMessage(fileId, message, history)` posts to `/assistant/chat`, capping replayed history at the last 10 messages, and returns `{ reply, agentAction }`.
- `AssistantPanel.tsx` opens beside the PDF in `FilePage`. It has **Chat** and **Notes** tabs, both `forceMount`ed so the notes board ref is never null.
- In the PDF (`FileViewer.tsx`), selecting text shows an **"Ask AI"** tooltip that pushes the selection into the chat input via a `forwardRef` handle.
- Replies render as markdown; each can be **copied** or **pinned** to the sticky `NotesBoard` (persisted via `/me/notes`).

---

## 10. Configuration & Credentials

- `GEMINI_API_KEY` is read from the environment (`server/.env`) and used to construct the Gemini `client` in `ai_utils.py`. It is never exposed to the frontend — all AI calls are server‑side.
- GCS credentials (for downloading PDFs to embed) come from the service‑account key referenced by `GOOGLE_APPLICATION_CREDENTIALS` (resolved relative to `server/` in `main.py`).
- **Never commit real secrets.** `.env` and `gcp_key.json` must stay out of version control in production.

---

## Model Reference

| Purpose | Model | Dimensions |
|---|---|---|
| Chat / reasoning | `gemini-2.5-flash` | — (large context window) |
| Embeddings | `gemini-embedding-001` | 1536 (truncated from 3072) |
