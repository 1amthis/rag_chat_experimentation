# RAG Experimentation System

A web-based chat interface that demonstrates the difference between full-context and RAG (Retrieval-Augmented Generation) approaches for document-based conversations.

## Features

- **Intelligent Context Switching**: Automatically switches between full-context mode (<10k tokens) and RAG mode (≥10k tokens)
- **Document Upload**: Supports PDF, DOCX, and TXT files with drag-and-drop interface
- **Real-time Chat**: Interactive chat interface with conversation history
- **Enhanced Query Rewriting**: Multi-turn conversations use context-aware query enhancement for better retrieval
- **Vector Search**: Uses FAISS with OpenAI embeddings for semantic document retrieval
- **Token Tracking**: Real-time monitoring of document tokens and system mode
- **Query Visibility**: See the actual enhanced queries used for retrieval

## Architecture

- **Backend**: FastAPI with Python
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **LLM**: OpenAI GPT-4o
- **Embeddings**: OpenAI text-embedding-3-small
- **Vector Store**: FAISS (local, no external dependencies)
- **Document Processing**: PyPDF2, python-docx

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure OpenAI API

Copy the environment template and add your OpenAI API key:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Run the Application

```bash
python run.py
```

The application will be available at:
- Backend API: http://localhost:8000
- Frontend Interface: http://localhost:8000/static/index.html
- API Documentation: http://localhost:8000/docs

## Usage

1. **Upload Documents**: Drag and drop or click to upload PDF, DOCX, or TXT files
2. **Monitor Mode**: Watch the status bar to see current mode (Full Context vs RAG)
3. **Chat**: Ask questions about your uploaded documents
4. **Multi-turn Conversations**: In RAG mode, follow-up questions benefit from enhanced query rewriting
5. **Context Switching**: 
   - **Full Context Mode**: Documents <10k tokens are passed entirely to the LLM
   - **RAG Mode**: Documents ≥10k tokens use vector search to retrieve relevant chunks with enhanced queries

## API Endpoints

- `POST /upload-document` - Upload a document
- `GET /documents` - List uploaded documents
- `DELETE /documents/{id}` - Delete a specific document
- `DELETE /documents` - Clear all documents
- `POST /chat` - Send a chat message
- `GET /status` - Get system status and mode

## Project Structure

```
rag_experimentation/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── models/              # Data models
│   ├── services/            # Business logic
│   ├── utils/               # Utilities
│   └── storage/             # Vector storage
├── frontend/
│   ├── index.html           # Chat interface
│   ├── style.css           # Styling
│   └── script.js           # Frontend logic
├── requirements.txt         # Python dependencies
├── .env.example            # Environment template
├── run.py                  # Application runner
└── README.md              # This file
```

## How It Works

### Full Context Mode (<10k tokens)
- All document content is passed directly to the LLM context
- Provides complete document access for comprehensive answers
- Suitable for smaller document sets

### RAG Mode (≥10k tokens)
- Documents are chunked into smaller segments
- Chunks are embedded using OpenAI text-embedding-3-small
- **Query Enhancement**: User queries are enhanced with conversation context using GPT-4o-mini
- Enhanced queries are embedded and matched against document chunks
- Most relevant chunks are retrieved and passed to the LLM
- Maximum context capacity: 100k tokens
- Enhanced queries visible in chat interface when different from original

## Configuration

Key parameters can be modified in `backend/services/rag_service.py`:

- `token_threshold`: 10000 (switch point between modes)
- `max_context_tokens`: 100000 (maximum RAG context size)
- `llm_model`: "gpt-4o" (OpenAI model for responses)
- Query enhancement model: "gpt-4o-mini" (for query rewriting)
- `recent_history_limit`: 6 turns (conversation context for query enhancement)
- Embedding model: "text-embedding-3-small"

## Troubleshooting

1. **Import Errors**: Make sure you're running from the project root using `python run.py`
2. **OpenAI API Errors**: Verify your API key is set correctly in `.env`
3. **File Upload Issues**: Check file formats (PDF, DOCX, TXT only)
4. **Port Conflicts**: The app runs on port 8000 by default

## Experimentation Ideas

1. **Compare Modes**: Upload the same document set and ask identical questions in both modes
2. **Test Threshold**: Modify the 10k token threshold to see impact on mode switching
3. **Chunk Size**: Experiment with different chunk sizes in `token_counter.py`
4. **Retrieval Count**: Adjust the number of chunks retrieved in RAG mode
5. **Different Models**: Try different OpenAI models for comparison