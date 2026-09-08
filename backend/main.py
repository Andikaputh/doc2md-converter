from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse
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

MAX_FILE_SIZE = 10_485_760 # 10 MB

# MIDDLEWARE: Mengecek ukuran file sebelum diunduh oleh server
@app.middleware("http")
async def check_file_size_limit(request: Request, call_next):
    if request.url.path == "/api/convert" and request.method == "POST":
        content_length = request.headers.get("content-length")
        # Jika ukuran di header melebihi batas, langsung tolak saat itu juga
        if content_length and int(content_length) > MAX_FILE_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": "File terlalu besar. Maksimal ukuran file adalah 10MB."}
            )
    return await call_next(request)

# Initialize MarkItDown instance
md = MarkItDown()

@app.post("/api/convert")
async def convert_document(file: UploadFile = File(...)):
    # Pengecekan di dalam sini (file.size) bisa dihapus karena sudah ditangani Middleware di atas.
    
    temp_file_path = f"temp_{file.filename}"
    
    try:
        content = await file.read()
        with open(temp_file_path, "wb") as buffer:
            buffer.write(content)
            
        result = await asyncio.to_thread(md.convert, temp_file_path)
        
        return {
            "success": True,
            "filename": file.filename,
            "markdown_content": result.text_content
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
        
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)