# GeeksHub AI & RAG System Architecture

This document explains how the AI Study Companion and Retrieval-Augmented Generation (RAG) system is implemented in the GeeksHub project.

## Overview
The AI Study Companion acts as a knowledgeable, supportive tutor for university students. It combines a large context window for reading current documents with a RAG system to search across all course materials (slides, past exams, summaries) when needed.

The core technologies used are:
- **Google Gemini API**: Uses `gemini-1.5-flash` for chat and `text-embedding-004` for vector embeddings.
- **PostgreSQL & pgvector**: Stores vector embeddings and performs similarity searches.
- **SQLModel / SQLAlchemy**: ORM for database interactions.
- **FastAPI**: Backend framework serving the AI endpoints.
- **PyPDF**: Extracts text from PDF materials.

## 1. Document Processing & Embedding
When a new document (e.g., a PDF) is uploaded and approved, it is processed and embedded into the database. This logic lives in `server/utils/ai_utils.py` (`process_and_embed_pdf`).

1. **Extraction**: The `pypdf` library reads the PDF and extracts text page by page.
2. **Embedding**: The text chunks (pages) are sent to the Gemini `text-embedding-004` model to generate 768-dimensional vector embeddings. This is done in a single batch request to optimize API usage.
3. **Storage**: Each chunk of text, along with its page number and embedding vector, is saved in the `MaterialChunk` table (`server/models.py`). 

## 2. Chat Interface & Context Window
The main chat endpoint is located at `POST /api/v1/assistant/chat` (`server/routers/ai.py`).

When a student chats with the AI while viewing a document:
1. **Full Document Context**: The system fetches **all** `MaterialChunk`s for the currently viewed file and orders them by page number. Because Gemini 1.5 has a massive context window (up to 1M tokens), the *entire* document is provided to the AI directly in its system prompt.
2. **System Prompt**: The AI is given a detailed system prompt instructing it to:
   - Be an AI Study Companion for Azrieli College of Engineering.
   - Answer from the current document first.
   - Use the Socratic method for homework (giving hints instead of direct answers).
   - Help with exam preparation and formatting rules.
3. **History**: The chat history is maintained and passed into the `gemini_history` context, allowing for multi-turn conversations.

## 3. Metadata-Aware RAG (Tool Calling)
If the student asks a question about something not in the current document (e.g., "Was this on last year's exam?" or "What did the professor say in lecture 2?"), the AI automatically uses **Function Calling** to search the rest of the course.

1. **The Tool (`search_course_knowledge`)**: The Gemini agent is equipped with a tool that it can autonomously call when it needs external knowledge.
2. **Vector Search**: When the tool is called, it triggers `search_material_context` (`server/utils/ai_utils.py`).
   - The student's query is converted into an embedding using `text-embedding-004`.
   - The system performs a **Cosine Distance Vector Search** (`embedding.cosine_distance(query_vector)`) against all chunks in the database.
   - **Metadata Filtering**: Crucially, it joins the `MaterialChunk` with the `Material` table and filters by `course_id`. This guarantees the RAG only retrieves information relevant to the *specific course* the student is currently studying.
3. **Augmentation**: The top most relevant chunks across the entire course are returned to the AI, which synthesizes them into an answer for the user.
