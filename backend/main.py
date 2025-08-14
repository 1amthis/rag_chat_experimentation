from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv
from services.document_service import DocumentService
from services.rag_service import RAGService

load_dotenv()

app = FastAPI(title="RAG Experimentation System", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="frontend"), name="static")

document_service = DocumentService()
rag_service = RAGService(document_service)

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[dict]] = None

class ChunkInfo(BaseModel):
    similarity_score: float
    document_name: str
    chunk_index: int
    content: str
    token_count: int

class ContextMetrics(BaseModel):
    context_tokens_used: int
    max_context_tokens: int
    context_fill_percentage: float
    context_limit_type: str
    mode: str

class ChatResponse(BaseModel):
    response: str
    mode: str  # "full_context" or "rag"
    token_count: int
    relevant_chunks_count: int
    relevant_chunks: List[ChunkInfo]
    context_tokens_used: int
    context_metrics: ContextMetrics
    enhanced_query: Optional[str] = None  # The query actually used for retrieval

class DocumentInfo(BaseModel):
    id: str
    name: str
    token_count: int
    upload_time: str

@app.get("/")
async def root():
    return {"message": "RAG Experimentation System API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/upload-document")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    allowed_extensions = ['pdf', 'docx', 'doc', 'txt']
    file_extension = file.filename.lower().split('.')[-1]
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"File type {file_extension} not supported. Allowed: {allowed_extensions}"
        )
    
    try:
        content = await file.read()
        document, mode_switched_to_rag = await document_service.upload_document(content, file.filename)
        
        return {
            "id": document.id,
            "name": document.name,
            "token_count": document.token_count,
            "total_tokens": document_service.get_total_tokens(),
            "upload_time": document.upload_time.isoformat(),
            "mode_switched_to_rag": mode_switched_to_rag
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/documents")
async def get_documents():
    documents = document_service.get_documents()
    return {
        "documents": [
            {
                "id": doc.id,
                "name": doc.name,
                "token_count": doc.token_count,
                "upload_time": doc.upload_time.isoformat()
            }
            for doc in documents
        ],
        "total_tokens": document_service.get_total_tokens()
    }

@app.get("/documents/{document_id}")
async def get_document(document_id: str):
    document = document_service.get_document_by_id(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get a preview of the document content (first 2000 characters)
    preview_content = document.content[:2000] + ("..." if len(document.content) > 2000 else "")
    
    return {
        "id": document.id,
        "name": document.name,
        "token_count": document.token_count,
        "upload_time": document.upload_time.isoformat(),
        "content_preview": preview_content,
        "full_content_length": len(document.content)
    }

@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    if document_service.remove_document(document_id):
        return {"message": "Document deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="Document not found")

@app.delete("/documents")
async def clear_documents():
    document_service.clear_documents()
    rag_service.vector_store.clear()
    return {"message": "All documents cleared"}

@app.post("/chat")
async def chat(request: ChatRequest):
    try:
        result = await rag_service.chat(
            message=request.message,
            conversation_history=request.conversation_history or []
        )
        
        return ChatResponse(
            response=result["response"],
            mode=result["mode"],
            token_count=result["token_count"],
            relevant_chunks_count=result["relevant_chunks_count"],
            relevant_chunks=result["relevant_chunks"],
            context_tokens_used=result["context_tokens_used"],
            context_metrics=result["context_metrics"],
            enhanced_query=result.get("enhanced_query")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/status")
async def get_status():
    context_metrics = rag_service.get_context_metrics()
    
    return {
        "total_documents": len(document_service.get_documents()),
        "total_tokens": document_service.get_total_tokens(),
        "current_mode": context_metrics["mode"],
        "token_threshold": 10000,
        "vector_store_size": rag_service.vector_store.index.ntotal if hasattr(rag_service.vector_store.index, 'ntotal') else 0,
        "context_metrics": context_metrics
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)