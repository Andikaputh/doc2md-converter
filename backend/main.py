from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from markitdown import MarkItDown
import os
import asyncio

# Initialize FastAPI App
app = FastAPI(
    title="MarkItDown Converter API",
    description="API to convert documents to Markdown using Microsoft MarkItDown",
    version="1.0.0"
)

# Configure CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MarkItDown instance
md = MarkItDown()

# Batas maksimal file adalah 10 MB (10 * 1024 * 1024 bytes)
MAX_FILE_SIZE = 10_485_760

@app.post("/api/convert")
async def convert_document(file: UploadFile = File(...)):
    """
    Receives an uploaded file, saves it temporarily, 
    converts it to Markdown, and returns the string content.
    """
    # 1. Pengecekan ukuran file
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413, 
            detail=f"File terlalu besar. Maksimal ukuran file adalah 10MB. File Anda: {file.size / 1_048_576:.2f}MB"
        )

    temp_file_path = f"temp_{file.filename}"
    
    try:
        # 1. Baca dan simpan file secara asynchronous (tidak memblokir server)
        content = await file.read()
        with open(temp_file_path, "wb") as buffer:
            buffer.write(content)
            
        # 2. Pindahkan tugas komputasi berat ke thread terpisah
        result = await asyncio.to_thread(md.convert, temp_file_path)
        
        return {
            "success": True,
            "filename": file.filename,
            "markdown_content": result.text_content
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
        
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)