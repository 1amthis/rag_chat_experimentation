import PyPDF2
from docx import Document as DocxDocument
from typing import Dict, Any
import io

class DocumentProcessor:
    @staticmethod
    def extract_text(file_content: bytes, filename: str) -> str:
        file_extension = filename.lower().split('.')[-1]
        
        if file_extension == 'pdf':
            return DocumentProcessor._extract_pdf_text(file_content)
        elif file_extension in ['docx', 'doc']:
            return DocumentProcessor._extract_docx_text(file_content)
        elif file_extension == 'txt':
            return file_content.decode('utf-8')
        else:
            raise ValueError(f"Unsupported file type: {file_extension}")
    
    @staticmethod
    def _extract_pdf_text(file_content: bytes) -> str:
        text = ""
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        return text.strip()
    
    @staticmethod
    def _extract_docx_text(file_content: bytes) -> str:
        doc = DocxDocument(io.BytesIO(file_content))
        text = []
        
        for paragraph in doc.paragraphs:
            text.append(paragraph.text)
        
        return "\n".join(text).strip()