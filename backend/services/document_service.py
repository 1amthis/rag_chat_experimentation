from typing import List, Optional
import uuid
from datetime import datetime
from models.document import Document, DocumentChunk, DocumentStore
from utils.token_counter import TokenCounter
from utils.document_processor import DocumentProcessor

class DocumentService:
    def __init__(self):
        self.document_store = DocumentStore()
        self.token_counter = TokenCounter()
        self.token_threshold = 10000
    
    async def upload_document(self, file_content: bytes, filename: str) -> tuple[Document, bool]:
        try:
            # Check mode before adding document
            was_full_context = self.document_store.total_tokens < self.token_threshold
            
            text = DocumentProcessor.extract_text(file_content, filename)
            token_count = self.token_counter.count_tokens(text)
            
            document = Document(
                id=str(uuid.uuid4()),
                name=filename,
                content=text,
                token_count=token_count,
                upload_time=datetime.now()
            )
            
            self.document_store.documents.append(document)
            self.document_store.total_tokens += token_count
            
            # Check if mode switched to RAG
            is_now_rag = self.document_store.total_tokens >= self.token_threshold
            mode_switched_to_rag = was_full_context and is_now_rag
            
            return document, mode_switched_to_rag
        
        except Exception as e:
            raise ValueError(f"Error processing document {filename}: {str(e)}")
    
    def get_documents(self) -> List[Document]:
        return self.document_store.documents
    
    def get_document_by_id(self, document_id: str) -> Optional[Document]:
        for doc in self.document_store.documents:
            if doc.id == document_id:
                return doc
        return None
    
    def get_total_tokens(self) -> int:
        return self.document_store.total_tokens
    
    def remove_document(self, document_id: str) -> bool:
        for i, doc in enumerate(self.document_store.documents):
            if doc.id == document_id:
                self.document_store.total_tokens -= doc.token_count
                del self.document_store.documents[i]
                return True
        return False
    
    def clear_documents(self):
        self.document_store.documents.clear()
        self.document_store.total_tokens = 0
    
    def get_all_content(self) -> str:
        return "\n\n".join([doc.content for doc in self.document_store.documents])
    
    def chunk_documents(self) -> List[DocumentChunk]:
        chunks = []
        for doc in self.document_store.documents:
            text_chunks = self.token_counter.chunk_text(doc.content)
            for i, chunk_text in enumerate(text_chunks):
                chunk = DocumentChunk(
                    id=f"{doc.id}_{i}",
                    content=chunk_text,
                    document_name=doc.name,
                    chunk_index=i,
                    token_count=self.token_counter.count_tokens(chunk_text)
                )
                chunks.append(chunk)
        return chunks