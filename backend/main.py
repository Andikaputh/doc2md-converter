from fastapi import FastAPI, UploadFile, File, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from markitdown import MarkItDown
from typing import List
import os
import asyncio
import tempfile
import shutil
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

MAX_FILE_SIZE = 10_485_760  # 10 MB
MAX_BATCH_FILES = 10        # Maximum of 10 files per batch

# MIDDLEWARE: Validate payload size to prevent OOM before processing
@app.middleware("http")
async def check_file_size_limit(request: Request, call_next):
    if request.method == "POST" and "convert" in request.url.path:
        content_length = request.headers.get("content-length")
        if content_length:
            is_single = request.url.path.rstrip("/").endswith("/convert")
            limit = (MAX_FILE_SIZE + 1024 * 1024) if is_single else ((MAX_FILE_SIZE * MAX_BATCH_FILES) + 1024 * 1024)
            if int(content_length) > limit:
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"File size too large. Server limit is {limit // (1024 * 1024)}MB."}
                )
    return await call_next(request)

# Initialize MarkItDown instance
md = MarkItDown()

# --- RAM PROTECTION FOR RENDER FREE TIER (512MB RAM LIMIT) ---
# Strictly serialize document conversion using a semaphore to stay under 400MB RAM
MAX_CONCURRENT_PROCESSES = 1
semaphore = asyncio.Semaphore(MAX_CONCURRENT_PROCESSES)

@app.get("/")
def health_check():
    return {"status": "Alive and kicking!", "service": "Doc2MD API"}

@app.get("/api/health")
def api_health():
    """Lightweight endpoint used by the frontend to detect whether this API is reachable."""
    return {"status": "ok", "service": "Doc2MD API"}

async def process_single_file(file: UploadFile) -> dict:
    """Helper function to process a single file safely with strict memory limits and cleanup."""
    filename = file.filename or "uploaded_file"
    ext = os.path.splitext(filename)[1]
    temp_file_path = None
    
    try:
        # Stream file to disk in chunks to avoid buffering large payloads in RAM
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            temp_file_path = tmp.name
            shutil.copyfileobj(file.file, tmp)
            
        # Enforce single-concurrency execution lock
        async with semaphore:
            result = await asyncio.to_thread(md.convert, temp_file_path)
            text_content = result.text_content or ""
            # Immediately drop result reference
            del result

        return {
            "success": True,
            "filename": filename,
            "content": text_content,
            "markdown_content": text_content
        }
    except Exception as e:
        # Return clean JSON error object instead of letting request crash or timeout
        return {
            "success": False,
            "filename": filename,
            "error": str(e),
            "detail": f"Conversion failed: {str(e)}",
            "content": "",
            "markdown_content": ""
        }
    finally:
        # Explicitly close uploaded file handle
        try:
            await file.close()
        except Exception:
            pass

        # Safely remove temporary file from disk
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                pass

        # Force garbage collection immediately to free RAM back to OS
        gc.collect()

# ==========================================
# ENDPOINT: Single Document Conversion
# ==========================================
@app.post("/api/convert")
async def convert_document(file: UploadFile = File(...)):
    """Converts a single document to markdown in a memory-safe manner."""
    result = await process_single_file(file)
    return JSONResponse(status_code=200, content=result)

# ==========================================
# ENDPOINT: Batch Conversion (Sequential fallback)
# ==========================================
@app.post("/api/convert/batch")
async def convert_batch_documents(files: List[UploadFile] = File(...)):
    """Processes batch documents sequentially (one-by-one) with per-file GC cleanup."""
    if len(files) > MAX_BATCH_FILES:
        return JSONResponse(
            status_code=400,
            content={"detail": f"Maximum {MAX_BATCH_FILES} files allowed per batch."}
        )
    
    results = []
    # Process sequentially one-by-one to prevent cumulative RAM spikes
    for f in files:
        res = await process_single_file(f)
        results.append(res)
        gc.collect()

    response_data = {"success": True, "results": results}
    
    del results
    gc.collect()
    
    return response_data
