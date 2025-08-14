# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
```bash
python run.py
```
This starts the FastAPI server on port 8000 with the frontend served at `/static/`.

### Environment Setup
```bash
# Activate virtual environment (if using venv)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```
Create a `.env` file with your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
```

### Development Workflow
```bash
# Start development server
source venv/bin/activate && python run.py

# Access application
# Frontend: http://localhost:8000/static/index.html
# API Docs: http://localhost:8000/docs
```

### Testing
No test framework is currently configured. When adding tests, check the codebase structure first.

### Troubleshooting Document Preview Modal

If clicking on document names doesn't show the preview modal:

1. **Check browser console** for JavaScript errors
2. **Verify server is running** with `source venv/bin/activate && python run.py`
3. **Test API endpoint** manually: `GET /documents/{document_id}` should return document data
4. **Check network tab** to confirm API calls are successful (should see 200 OK responses)
5. **Modal elements**: Ensure `document-preview-modal` element exists in DOM
6. **CSS classes**: Modal should get `show` class when clicked, check with browser dev tools

**Known working**: The implementation includes proper click handlers, backend endpoint, and modal styling. Server logs confirm successful API calls when document names are clicked.

## Architecture Overview

This is a RAG (Retrieval-Augmented Generation) experimentation system that automatically switches between two modes based on document token count:

### Core Architecture
- **FastAPI Backend** (`backend/main.py`): REST API with document upload, chat, and status endpoints
- **Vanilla Frontend** (`frontend/`): HTML/CSS/JavaScript chat interface with drag-and-drop upload
- **Service Layer**: Modular services for document processing, embeddings, and RAG functionality
- **Vector Storage**: FAISS-based local vector store with OpenAI embeddings

### Key Components

#### Services Layer (`backend/services/`)
- **DocumentService**: Handles document upload, storage, and token counting
- **RAGService**: Core logic for mode switching and chat processing
- **EmbeddingService**: OpenAI text-embedding-3-small integration

#### Models (`backend/models/`)
- **Document**: Document entity with metadata and content

#### Storage (`backend/storage/`)
- **VectorStore**: FAISS vector database wrapper

#### Utils (`backend/utils/`)
- **DocumentProcessor**: PDF, DOCX, TXT file parsing
- **TokenCounter**: tiktoken-based token counting and text chunking

### Mode Switching Logic
- **Full Context Mode**: Documents <10k tokens passed entirely to LLM
- **RAG Mode**: Documents ≥10k tokens use vector search with chunk retrieval
- Threshold configurable in `rag_service.py` (`token_threshold: 10000`)

### API Integration
- **LLM**: OpenAI GPT-4o
- **Embeddings**: OpenAI text-embedding-3-small
- **Max Context**: 100k tokens in RAG mode

## Key Configuration Points

### RAG Service Parameters (`backend/services/rag_service.py`)
- `token_threshold`: 10000 (mode switch point)
- `max_context_tokens`: 100000 (RAG context limit)
- `llm_model`: "gpt-4o"

### Document Processing
- Supported formats: PDF, DOCX, TXT
- Chunk size and overlap configured in `token_counter.py`

## Recent UX/UI Improvements

The following enhancements have been implemented to improve user experience:

### Chat Experience
- **Enhanced markdown rendering**: Full support for code blocks, bold/italic text, and lists
- **Message copy functionality**: Copy buttons appear on hover for user and assistant messages
- **Improved loading states**: Typing indicators during AI responses and upload progress animations
- **Message timestamps**: Auto-formatted timestamps (time-only for today, date+time for older messages)

### Document Management
- **Document preview modal**: Click document names to view content preview and metadata
- **Enhanced visual feedback**: Better loading states for uploads and API calls
- **Improved accessibility**: Keyboard navigation and screen reader support

### API Enhancements
- **Document preview endpoint**: `GET /documents/{id}` returns document preview and metadata
- **Enhanced document service**: Added `get_document_by_id()` method for individual document retrieval

## Important Notes

- Application must be run from project root using `python run.py` for proper module imports
- Frontend is served as static files from `/static/` route
- No database - all data stored in memory during runtime
- FAISS index is local and ephemeral
- CORS enabled for all origins in development