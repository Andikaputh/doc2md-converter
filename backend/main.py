from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from markitdown import MarkItDown
from typing import List
import os
import asyncio
import tempfile
import shutil
import io
import zipfile
import gc

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
MAX_BATCH_FILES = 10       # Maximum of 10 files per upload

# MIDDLEWARE: Mengecek ukuran file
@app.middleware("http")
async def check_file_size_limit(request: Request, call_next):
    if request.method == "POST" and "convert" in request.url.path:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_FILE_SIZE * MAX_BATCH_FILES:
            return JSONResponse(
                status_code=413,
                content={"detail": f"Total ukuran file terlalu besar. Batas aman server adalah {MAX_BATCH_FILES * 10}MB."}
            )
    return await call_next(request)

# Initialize MarkItDown instance
md = MarkItDown()

# --- RAM PROTECTION FOR FREE TIER ---
MAX_CONCURRENT_PROCESSES = 2
semaphore = asyncio.Semaphore(MAX_CONCURRENT_PROCESSES)

@app.get("/")
def health_check():
    return {"status": "Alive and kicking!", "service": "Doc2MD API"}

# ==========================================
# ENDPOINT LAMA: Konversi Tunggal (Untuk Live Preview)
# ==========================================
@app.post("/api/convert")
async def convert_document(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1]
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        shutil.copyfileobj(file.file, tmp)
        temp_file_path = tmp.name
    
    try:
        result = await asyncio.to_thread(md.convert, temp_file_path)
        response_data = {
            "success": True,
            "filename": file.filename,
            "markdown_content": result.text_content
        }
        
        # Remove the markitdown result object from memory and clear the RAM
        del result
        gc.collect()
        
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

# ==========================================
# NEW ENDPOINT: Batch Conversion
# ==========================================
async def process_single_file(file: UploadFile):
    """A helper function to process a single file asynchronously within a batch."""
    ext = os.path.splitext(file.filename)[1]
    base_name = os.path.splitext(file.filename)[0]
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        shutil.copyfileobj(file.file, tmp)
        temp_file_path = tmp.name
        
    try:
        async with semaphore:
            result = await asyncio.to_thread(md.convert, temp_file_path)
        return {"success": True, "filename": f"{base_name}.md", "content": result.text_content}
    except Exception as e:
        return {"success": False, "filename": file.filename, "error": str(e)}
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.post("/api/convert/batch")
async def convert_batch_documents(files: List[UploadFile] = File(...)):
    if len(files) > MAX_BATCH_FILES:
        return JSONResponse(status_code=400, content={"detail": f"Maximum {MAX_BATCH_FILES} files allowed per batch."})
    
    # Process each file concurrently
    tasks = [process_single_file(f) for f in files]
    results = await asyncio.gather(*tasks)

    # Bungkus hasil ke variabel final
    response_data = {"success": True, "results": results}
    
    # Hapus referensi array berat dari memori secara manual
    del tasks
    del results
    
    # Paksa "tukang sapu" Python bekerja membuang memori yang tersisa detik ini juga
    gc.collect()
    
    return response_data