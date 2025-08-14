import openai
from typing import List, Tuple, Optional
import os
from services.embedding_service import EmbeddingService
from services.document_service import DocumentService
from storage.vector_store import VectorStore
from models.document import DocumentChunk

class RAGService:
    def __init__(self, document_service: DocumentService):
        self.document_service = document_service
        self.embedding_service = EmbeddingService()
        self.vector_store = VectorStore()
        self.client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.llm_model = "gpt-4o"
        self.token_threshold = 10000
        self.max_context_tokens = 100000
    
    async def initialize_rag_system(self):
        chunks = self.document_service.chunk_documents()
        if not chunks:
            return
        
        chunk_texts = [chunk.content for chunk in chunks]
        embeddings = await self.embedding_service.get_embeddings(chunk_texts)
        
        self.vector_store.clear()
        self.vector_store.add_chunks(chunks, embeddings)
    
    def should_use_rag(self) -> bool:
        return self.document_service.get_total_tokens() >= self.token_threshold
    
    async def get_relevant_context(self, query: str, max_chunks: int = 10) -> Tuple[str, List[dict]]:
        if not self.should_use_rag():
            full_content = self.document_service.get_all_content()
            return full_content, []
        
        query_embedding = await self.embedding_service.get_embedding(query)
        results = self.vector_store.search(query_embedding, k=max_chunks)
        
        relevant_chunks = []
        context_parts = []
        current_tokens = 0
        
        for chunk, score in results:
            if current_tokens + chunk.token_count > self.max_context_tokens:
                break
            
            chunk_info = {
                "chunk": chunk,
                "similarity_score": float(score),
                "document_name": chunk.document_name,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "token_count": chunk.token_count
            }
            relevant_chunks.append(chunk_info)
            context_parts.append(f"[From {chunk.document_name}]\n{chunk.content}")
            current_tokens += chunk.token_count
        
        context = "\n\n".join(context_parts)
        return context, relevant_chunks
    
    def get_context_metrics(self) -> dict:
        total_tokens = self.document_service.get_total_tokens()
        mode = "rag" if self.should_use_rag() else "full_context"
        
        if mode == "full_context":
            max_tokens = self.token_threshold
            context_limit_type = "document_limit"
        else:
            max_tokens = self.max_context_tokens
            context_limit_type = "retrieval_limit"
        
        fill_percentage = min((total_tokens / max_tokens) * 100, 100.0)
        
        return {
            "context_tokens_used": total_tokens,
            "max_context_tokens": max_tokens,
            "context_fill_percentage": fill_percentage,
            "context_limit_type": context_limit_type,
            "mode": mode
        }
    
    async def chat(self, message: str, conversation_history: List[dict] = None) -> dict:
        if conversation_history is None:
            conversation_history = []
        
        mode = "rag" if self.should_use_rag() else "full_context"
        
        if mode == "rag" and self.vector_store.index.ntotal == 0:
            await self.initialize_rag_system()
        
        context, relevant_chunks = await self.get_relevant_context(message)
        
        system_prompt = f"""You are a helpful assistant that answers questions based on the provided documents. 
        
        Current mode: {mode}
        {"Use the document excerpts below to answer the user's question." if mode == "rag" else "Use the full documents below to answer the user's question."}
        
        Documents:
        {context}
        
        Instructions:
        - Answer based only on the information provided in the documents
        - If the answer is not in the documents, say so clearly
        - Cite which document(s) you're referencing when possible
        - Be concise but comprehensive
        """
        
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(conversation_history)
        messages.append({"role": "user", "content": message})
        
        try:
            response = self.client.chat.completions.create(
                model=self.llm_model,
                messages=messages,
                temperature=0.7,
                max_tokens=1000
            )
            
            assistant_response = response.choices[0].message.content
            
            # Calculate actual context token usage
            context_token_count = self.document_service.token_counter.count_tokens(context) if context else 0
            
            return {
                "response": assistant_response,
                "mode": mode,
                "token_count": self.document_service.get_total_tokens(),
                "relevant_chunks_count": len(relevant_chunks) if mode == "rag" else 0,
                "relevant_chunks": relevant_chunks if mode == "rag" else [],
                "context_tokens_used": context_token_count,
                "context_metrics": self.get_context_metrics()
            }
            
        except Exception as e:
            raise ValueError(f"Error generating response: {str(e)}")