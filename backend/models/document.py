from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DocumentChunk(BaseModel):
    id: str
    content: str
    document_name: str
    chunk_index: int
    token_count: int

class Document(BaseModel):
    id: str
    name: str
    content: str
    token_count: int
    upload_time: datetime
    chunks: Optional[List[DocumentChunk]] = None

class DocumentStore(BaseModel):
    documents: List[Document] = []
    total_tokens: int = 0