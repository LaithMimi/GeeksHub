# turbovec Integration — GeeksHub

**Context:** GeeksHub already has a working RAG stack:
- Gemini `gemini-embedding-001` (1536-dim) at ingest time
- PostgreSQL + pgvector HNSW index for vector search
- `MaterialChunk` rows (content + embedding + page_number + material_id)
- `search_material_context()` for cross-material semantic search
- Full-document context stuffing for the primary file in `ask_ai_tutor()`

turbovec fits as a **hot in-process layer on top of pgvector**, not a replacement.
pgvector stays as the source of truth and persistence layer.
turbovec loads at startup (or lazily) and handles all search queries from RAM.

---

## Why Bother (Given pgvector Exists)

| | pgvector HNSW | turbovec |
|---|---|---|
| Search latency (10K chunks) | ~5–15 ms (network + DB) | ~0.1–0.5 ms (in-process) |
| Memory per 1536-dim vector | 6.1 KB (float32) | ~0.8 KB (4-bit) |
| Filtered search | SQL `WHERE` → full HNSW scan | SIMD-level allowlist per 32-vec block |
| Works offline / no DB connection | No | Yes |
| Persistence | PostgreSQL | `.tq` / `.tvim` file |

The main win for GeeksHub is **latency and filtered search**. `search_material_context()` is called inside a live Gemini tool-use round-trip — shaving 10–15 ms there is noticeable. The filtered search matters because every search is already scoped (by `course_id`, or by a single `material_id`); turbovec's allowlist enforces that inside the SIMD kernel rather than with a SQL `WHERE` clause after scanning the full index.

---

## Integration Points

### 1. `search_material_context()` — Cross-Material Search

**File:** `server/utils/ai_utils.py`, lines 122–146  
**Current flow:** embed query → pgvector cosine search filtered by `course_id` → return top-5 chunks

**With turbovec:**

```python
# server/utils/vector_index.py  (new file)

import numpy as np
from turbovec import IdMapIndex
from sqlmodel import Session, select
from models import MaterialChunk, Material

_index: IdMapIndex | None = None

# chunk_id (uint64) → (material_id, content, page_number)
_chunk_metadata: dict[int, tuple[str, str, int | None]] = {}

def build_index(session: Session) -> IdMapIndex:
    """Load all MaterialChunk rows from PostgreSQL into turbovec."""
    global _index, _chunk_metadata

    idx = IdMapIndex(dim=1536, bit_width=4)
    chunks = session.exec(select(MaterialChunk)).all()

    if not chunks:
        _index = idx
        return idx

    vectors = np.array([c.embedding for c in chunks], dtype=np.float32)
    ids     = np.array([int(c.id) & 0xFFFFFFFFFFFFFFFF for c in chunks], dtype=np.uint64)

    idx.add_with_ids(vectors, ids)

    for c, cid in zip(chunks, ids):
        _chunk_metadata[int(cid)] = (str(c.material_id), c.content, c.page_number)

    _index = idx
    return idx


def get_index() -> IdMapIndex:
    if _index is None:
        raise RuntimeError("Vector index not initialised — call build_index() at startup.")
    return _index


def ids_for_course(course_id: str, session: Session) -> np.ndarray:
    """Return turbovec uint64 ids for every chunk belonging to this course."""
    rows = session.exec(
        select(MaterialChunk.id)
        .join(Material, MaterialChunk.material_id == Material.id)
        .where(Material.course_id == course_id)
    ).all()
    return np.array([int(r) & 0xFFFFFFFFFFFFFFFF for r in rows], dtype=np.uint64)


def ids_for_material(material_id: str, session: Session) -> np.ndarray:
    """Return turbovec uint64 ids for every chunk of a single file."""
    rows = session.exec(
        select(MaterialChunk.id).where(MaterialChunk.material_id == material_id)
    ).all()
    return np.array([int(r) & 0xFFFFFFFFFFFFFFFF for r in rows], dtype=np.uint64)
```

```python
# server/main.py — add to the lifespan startup block

from utils.vector_index import build_index

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    with Session(engine) as session:
        build_index(session)          # loads all chunks from PG into RAM once
    yield
```

```python
# server/utils/ai_utils.py — replace search_material_context()

from utils.vector_index import get_index, ids_for_course, _chunk_metadata

def search_material_context(
    query: str,
    course_id: str,
    session: Session,
    limit: int = 5,
) -> str:
    query_vec = np.array(
        _embed_content_with_retry(query, output_dimensionality=1536),
        dtype=np.float32,
    ).reshape(1, -1)

    allowlist = ids_for_course(course_id, session)
    if len(allowlist) == 0:
        return ""

    scores, ids = get_index().search(query_vec, k=limit, allowlist=allowlist)

    chunks = [_chunk_metadata[int(i)][1] for i in ids[0] if int(i) in _chunk_metadata]
    return "\n---\n".join(chunks)
```

---

### 2. Primary-File Context — Replace Full-Document Stuffing

**File:** `server/routers/ai.py`, lines 57–71  
**Current:** fetch ALL `MaterialChunk` rows for the file → concatenate → stuff entire document into context window.  
This works fine for small files but fails silently on large ones (hits context limit, slow, expensive).

**With turbovec — proper per-file RAG:**

```python
# server/routers/ai.py  — replace the chunk-fetch block (lines 57–71)

from utils.vector_index import get_index, ids_for_material, _chunk_metadata

# ... inside ask_ai_tutor() ...

# Embed the user's question once.
query_vec = np.array(
    _embed_content_with_retry(payload.message, output_dimensionality=1536),
    dtype=np.float32,
).reshape(1, -1)

allowlist = ids_for_material(str(payload.fileId), session)

if len(allowlist) > 0:
    k         = min(8, len(allowlist))
    _, ids    = get_index().search(query_vec, k=k, allowlist=allowlist)
    base_context = "\n---\n".join(
        _chunk_metadata[int(i)][1]
        for i in ids[0]
        if int(i) in _chunk_metadata
    )
else:
    base_context = ""
```

This changes the primary context from "entire document" to "top-8 most relevant chunks for this exact question." Context window cost drops from O(document size) to O(8 × 1000 chars) — constant and predictable regardless of file length.

> **Note:** The existing Gemini context caching (lines 135–161) handled the large-document case as a workaround. With per-query chunk retrieval it is no longer needed for that purpose, though you may keep it for other reasons.

---

### 3. Keep the Index Current After New Approvals

When `embed_single()` runs in the background and stores new `MaterialChunk` rows, the turbovec index must be updated.

```python
# server/utils/vector_index.py — add this function

def add_chunks_to_index(chunks: list[MaterialChunk]) -> None:
    """Incrementally add newly embedded chunks without a full rebuild."""
    if not chunks or _index is None:
        return

    vectors = np.array([c.embedding for c in chunks], dtype=np.float32)
    ids     = np.array([int(c.id) & 0xFFFFFFFFFFFFFFFF for c in chunks], dtype=np.uint64)

    _index.add_with_ids(vectors, ids)

    for c, cid in zip(chunks, ids):
        _chunk_metadata[int(cid)] = (str(c.material_id), c.content, c.page_number)
```

```python
# server/utils/ai_utils.py — at the end of process_and_embed_pdf()
# after the session.commit() on line ~115

from utils.vector_index import add_chunks_to_index
add_chunks_to_index(new_chunks)   # new_chunks = the list you just committed
```

turbovec's `add_with_ids` is incremental — no rebuild, no lock, vectors are searchable immediately.

---

### 4. Optional: Persist the Index to Disk

Avoids the full rebuild from PostgreSQL on every server restart. Useful once the corpus is large enough that `build_index()` takes more than a second or two.

```python
# server/utils/vector_index.py

INDEX_PATH = "turbovec_index.tvim"
META_PATH  = "turbovec_meta.pkl"

def save_index() -> None:
    import pickle
    _index.write(INDEX_PATH)
    with open(META_PATH, "wb") as f:
        pickle.dump(_chunk_metadata, f)

def load_index_from_disk() -> bool:
    global _index, _chunk_metadata
    import pickle
    if not (os.path.exists(INDEX_PATH) and os.path.exists(META_PATH)):
        return False
    _index = IdMapIndex.load(INDEX_PATH)
    with open(META_PATH, "rb") as f:
        _chunk_metadata = pickle.load(f)
    return True
```

```python
# server/main.py — replace build_index() call

from utils.vector_index import build_index, load_index_from_disk

with Session(engine) as session:
    if not load_index_from_disk():
        build_index(session)          # cold start: loads from PG, ~1s per 10K chunks
        save_index()                  # warm subsequent restarts
```

---

## What Stays Unchanged

- **Embedding model:** still `gemini-embedding-001` — turbovec is a search index, not an embedding model.
- **pgvector / HNSW:** still the persistence layer and the source of truth. turbovec reads from it at startup.
- **Chunking pipeline:** `process_and_embed_pdf()` unchanged — just add `add_chunks_to_index()` at the end.
- **Auth, gamification, admin, file upload:** untouched.

---

## Installation

```bash
pip install turbovec
```

No native deps to manage — the SIMD kernels are bundled in the wheel.

---

## Summary of Changes

| File | Change |
|---|---|
| `server/utils/vector_index.py` | **New file** — index singleton, `build_index`, `add_chunks_to_index`, allowlist helpers |
| `server/main.py` | Call `build_index()` in lifespan startup |
| `server/utils/ai_utils.py` | `search_material_context()` uses turbovec; `process_and_embed_pdf()` calls `add_chunks_to_index()` |
| `server/routers/ai.py` | Replace full-chunk-fetch with `search(query_vec, k=8, allowlist=material_ids)` |
| `requirements.txt` | Add `turbovec` |
