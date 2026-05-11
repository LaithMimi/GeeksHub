import os
from io import BytesIO
import time
from pypdf import PdfReader
from google import genai
from sqlmodel import Session, select
from models import MaterialChunk
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from google.genai.errors import APIError

# Initialize the Gemini Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# API Resilience: Auto-retry for rate limits / temporary API errors
@retry(
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(5),
    retry=retry_if_exception_type(APIError)
)
def _embed_content_with_retry(texts):
    return client.models.embed_content(
        model="text-embedding-004",
        contents=texts
    )


def process_and_embed_pdf(file_content: bytes, material_id: str, session: Session):
    reader = PdfReader(BytesIO(file_content))
    
    # 1. Gather all text and create an overlapping mapping
    full_text = ""
    page_map = [] # stores (end_char_index, page_number)
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            full_text += text + "\n"
            page_map.append((len(full_text), i + 1))

    # 2. If the PDF had zero extractable text (e.g. all scanned images), bail out
    if not full_text.strip():
        print(f"⚠️  No extractable text in material {material_id}, skipping embedding.")
        return

    # 3. Create overlapping chunks
    chunk_size = 1000
    overlap = 200
    all_chunks = []
    start = 0
    while start < len(full_text):
        end = start + chunk_size
        chunk_text = full_text[start:end]
        
        if chunk_text.strip():
            # Find the starting page of this chunk
            page_num = 1
            for end_idx, p_num in page_map:
                if start < end_idx:
                    page_num = p_num
                    break
            all_chunks.append((page_num, chunk_text))
            
        start += (chunk_size - overlap)

    # 4. Extract just the text for the API
    texts_to_embed = [chunk[1] for chunk in all_chunks]
    
    # 5. Call the API ONCE with the entire list! (Costs 1 RPM)
    # Using the resilient retry function
    result = _embed_content_with_retry(texts_to_embed)
    
    # 4. Loop through the results and save to the database
    for i, embedding_data in enumerate(result.embeddings):
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
    print(f"✅ Successfully batch-embedded material: {material_id}")

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