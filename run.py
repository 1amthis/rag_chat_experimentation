import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

if __name__ == "__main__":
    import uvicorn
    from main import app
    
    print("🚀 Starting RAG Experimentation System...")
    print("📱 Frontend Interface: http://localhost:8000/static/index.html")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("🔗 API Base URL: http://localhost:8000")
    print()
    
    uvicorn.run(app, host="0.0.0.0", port=8000)