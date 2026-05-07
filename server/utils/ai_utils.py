import os
from io import BytesIO
from pypdf import PdfReader
from google import genai
from sqlmodel import Session, select
from models import MaterialChunk

# Initialize the Gemini Client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def process_and_embed_pdf(file_content: bytes, material_id: str, session: Session):
    reader = PdfReader(BytesIO(file_content))
    
    # 1. Gather all the text into a list FIRST
    all_chunks = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""  # Some pages (scanned images) return None
        if text.strip():
            # Add a tuple of (page_number, text) so we don't lose track
            all_chunks.append((i + 1, text)) 

    # 2. If the PDF had zero extractable text (e.g. all scanned images), bail out
    if not all_chunks:
        print(f"⚠️  No extractable text in material {material_id}, skipping embedding.")
        return

    # 3. Extract just the text for the API
    texts_to_embed = [chunk[1] for chunk in all_chunks]
    
    # 4. Call the API ONCE with the entire list! (Costs 1 RPM)
    result = client.models.embed_content(
        model="text-embedding-004",
        contents=texts_to_embed 
    )
    
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
    query_result = client.models.embed_content(
        model="text-embedding-004",
        contents=query
    )
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