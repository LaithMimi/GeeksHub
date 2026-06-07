import os
from io import BytesIO
import time
from pypdf import PdfReader
import pypdfium2 as pdfium
from google import genai
from google.cloud import vision as gcloud_vision
from sqlmodel import Session, select
from models import MaterialChunk
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception

# Initialize the Gemini Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
_vision_client = None  # lazy-initialized to avoid startup cost when OCR isn't needed

EMBED_MODEL = "gemini-embedding-001"  # stable production model
EMBED_DIM   = 1536  # truncated from 3072 — keeps quality, fits under pgvector HNSW 2000-dim limit

# API Resilience: Retry on ANY exception (ClientError, ServerError, network blips).
# We use retry_if_exception with a broad predicate because exceptions raised inside
# concurrent.futures Futures are not always recognized by retry_if_exception_type.
@retry(
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(5),
    retry=retry_if_exception(lambda e: isinstance(e, Exception) and not isinstance(e, (KeyboardInterrupt, SystemExit)))
)
def _embed_content_with_retry(texts: list[str]):
    """Calls the Gemini embedding API with automatic retries on any transient error."""
    return client.models.embed_content(
        model=EMBED_MODEL,
        contents=texts,
        config={"output_dimensionality": EMBED_DIM}  # truncate 3072 -> 1536 for pgvector HNSW compat
    )


def _get_vision_client() -> gcloud_vision.ImageAnnotatorClient:
    global _vision_client
    if _vision_client is None:
        _vision_client = gcloud_vision.ImageAnnotatorClient()
    return _vision_client


def _ocr_page(page_png_bytes: bytes) -> str:
    """Sends a rendered page image to Cloud Vision and returns extracted text."""
    image = gcloud_vision.Image(content=page_png_bytes)
    response = _get_vision_client().text_detection(image=image)
    if response.error.message:
        raise RuntimeError(f"Cloud Vision: {response.error.message}")
    annotations = response.text_annotations
    return annotations[0].description if annotations else ""


def process_and_embed_pdf(file_content: bytes, material_id: str, session: Session):
    print(f"[EMBED] ▶ Starting embedding for material: {material_id}")
    print(f"[EMBED] File size: {len(file_content):,} bytes")

    # 1. Parse PDF and gather all text
    print(f"[EMBED] Step 1: Parsing PDF...")
    try:
        reader = PdfReader(BytesIO(file_content))
        print(f"[EMBED] PDF has {len(reader.pages)} pages")
    except Exception as e:
        print(f"[EMBED] ❌ Step 1 FAILED — could not parse PDF: {type(e).__name__}: {e}")
        raise

    # Open with pypdfium2 so we can render image-heavy pages for OCR
    pdf_doc = pdfium.PdfDocument(BytesIO(file_content))

    full_text = ""
    page_map = []  # stores (end_char_index, page_number)
    ocr_page_count = 0
    for i, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception as e:
            print(f"[EMBED] ⚠️  Could not extract text from page {i+1}: {type(e).__name__}: {e}")
            text = ""

        # OCR fallback: page has zero selectable text (embedded image, scanned page, photo slide)
        if not text.strip():
            try:
                pdf_page = pdf_doc[i]
                bitmap = pdf_page.render(scale=2.0)  # 2x scale improves OCR accuracy
                pil_image = bitmap.to_pil()
                buf = BytesIO()
                pil_image.save(buf, format="PNG")
                ocr_text = _ocr_page(buf.getvalue())
                if ocr_text.strip():
                    print(f"[EMBED] 🔍 Page {i+1}: OCR found {len(ocr_text)} chars (pypdf got {len(text.strip())})")
                    text = ocr_text
                    ocr_page_count += 1
            except Exception as e:
                print(f"[EMBED] ⚠️  OCR failed for page {i+1}: {type(e).__name__}: {e}")

        if text.strip():
            full_text += text + "\n"
            page_map.append((len(full_text), i + 1))

    pdf_doc.close()
    print(f"[EMBED] Extracted {len(full_text):,} characters from {len(page_map)} text-bearing pages ({ocr_page_count} via OCR)")

    # 2. Bail out if no text found
    if not full_text.strip():
        print(f"[EMBED] ⚠️  No extractable text in material {material_id}, skipping embedding (likely a scanned image PDF).")
        return

    # 3. Create overlapping semantic chunks
    print(f"[EMBED] Step 2: Creating overlapping chunks (size=1000, overlap=200)...")
    chunk_size = 1000
    overlap = 200
    all_chunks = []
    start = 0
    while start < len(full_text):
        end = start + chunk_size
        chunk_text = full_text[start:end]
        if chunk_text.strip():
            page_num = 1
            for end_idx, p_num in page_map:
                if start < end_idx:
                    page_num = p_num
                    break
            all_chunks.append((page_num, chunk_text))
        start += (chunk_size - overlap)

    print(f"[EMBED] Created {len(all_chunks)} chunks")

    # 4. Embed in mini-batches of 100
    print(f"[EMBED] Step 3: Sending to Gemini embedding API in batches of 100...")
    texts_to_embed = [chunk[1] for chunk in all_chunks]
    EMBED_BATCH_SIZE = 100
    all_embeddings = []

    for batch_start in range(0, len(texts_to_embed), EMBED_BATCH_SIZE):
        batch = texts_to_embed[batch_start : batch_start + EMBED_BATCH_SIZE]
        batch_end = batch_start + len(batch)
        print(f"[EMBED]   Calling API: chunks {batch_start + 1}–{batch_end} of {len(texts_to_embed)}...")
        try:
            result = _embed_content_with_retry(batch)
            all_embeddings.extend(result.embeddings)
            print(f"[EMBED]   ✅ Batch {batch_start + 1}–{batch_end} OK — got {len(result.embeddings)} embeddings")
        except Exception as e:
            print(f"[EMBED]   ❌ Batch {batch_start + 1}–{batch_end} FAILED after all retries: {type(e).__name__}: {e}")
            raise

    print(f"[EMBED] Step 4: Writing {len(all_embeddings)} chunks to database...")
    try:
        for i, embedding_data in enumerate(all_embeddings):
            page_num = all_chunks[i][0]
            chunk_text = all_chunks[i][1]
            db_chunk = MaterialChunk(
                material_id=material_id,
                content=chunk_text,
                embedding=embedding_data.values,
                page_number=page_num
            )
            session.add(db_chunk)
        session.commit()
        print(f"[EMBED] ✅ Done! Embedded material: {material_id} ({len(all_embeddings)} chunks saved)")
    except Exception as e:
        print(f"[EMBED] ❌ Step 4 FAILED — database write error: {type(e).__name__}: {e}")
        raise

# RAG search function
def search_material_context(query: str, course_id: str, session: Session, limit: int = 5):
    """
    Finds the most relevant chunks across ALL files in a specific course.
    This is what makes the RAG 'Metadata-Aware'.
    """
    # Generate an embedding for the user's question
    query_result = _embed_content_with_retry([query])
    query_vector = query_result.embeddings[0].values

    # Perform the Vector Search with a Metadata Filter on course_id
    # We join with the 'Material' table to ensure we stay within the correct course
    from models import Material # Import here to avoid circular imports
    
    statement = (
        select(MaterialChunk)
        .join(Material)
        .where(Material.course_id == course_id)
        .order_by(MaterialChunk.embedding.cosine_distance(query_vector))
        .limit(limit)
    )
    
    results = session.exec(statement).all()
    
    # Return the text so the AI can read it
    return "\n---\n".join([r.content for r in results])