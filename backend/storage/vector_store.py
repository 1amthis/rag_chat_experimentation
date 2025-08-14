import faiss
import numpy as np
from typing import List, Tuple, Optional
import pickle
import os
from models.document import DocumentChunk

class VectorStore:
    def __init__(self, dimension: int = 1536):  # text-embedding-3-small dimension
        self.dimension = dimension
        self.index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        self.chunks: List[DocumentChunk] = []
        self.chunk_embeddings: List[List[float]] = []
    
    def add_chunks(self, chunks: List[DocumentChunk], embeddings: List[List[float]]):
        if len(chunks) != len(embeddings):
            raise ValueError("Number of chunks must match number of embeddings")
        
        # Normalize embeddings for cosine similarity with inner product
        embeddings_array = np.array(embeddings, dtype=np.float32)
        faiss.normalize_L2(embeddings_array)
        
        # Add to FAISS index
        self.index.add(embeddings_array)
        
        # Store chunks and embeddings
        self.chunks.extend(chunks)
        self.chunk_embeddings.extend(embeddings)
    
    def search(self, query_embedding: List[float], k: int = 5) -> List[Tuple[DocumentChunk, float]]:
        if self.index.ntotal == 0:
            return []
        
        # Normalize query embedding
        query_array = np.array([query_embedding], dtype=np.float32)
        faiss.normalize_L2(query_array)
        
        # Search
        scores, indices = self.index.search(query_array, min(k, self.index.ntotal))
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx != -1:  # Valid index
                results.append((self.chunks[idx], float(score)))
        
        return results
    
    def clear(self):
        self.index.reset()
        self.chunks.clear()
        self.chunk_embeddings.clear()
    
    def save(self, filepath: str):
        # Save FAISS index
        faiss.write_index(self.index, f"{filepath}.faiss")
        
        # Save chunks and metadata
        with open(f"{filepath}.pkl", "wb") as f:
            pickle.dump({
                "chunks": self.chunks,
                "chunk_embeddings": self.chunk_embeddings,
                "dimension": self.dimension
            }, f)
    
    def load(self, filepath: str):
        if os.path.exists(f"{filepath}.faiss") and os.path.exists(f"{filepath}.pkl"):
            # Load FAISS index
            self.index = faiss.read_index(f"{filepath}.faiss")
            
            # Load chunks and metadata
            with open(f"{filepath}.pkl", "rb") as f:
                data = pickle.load(f)
                self.chunks = data["chunks"]
                self.chunk_embeddings = data["chunk_embeddings"]
                self.dimension = data["dimension"]
            
            return True
        return False