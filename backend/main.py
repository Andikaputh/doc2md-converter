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
    
    #  Process each file concurrently using asyncio.gather
    tasks = [process_single_file(f) for f in files]
    results = await asyncio.gather(*tasks)
    
    # Prepare the ZIP file in memory (RAM).
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for res in results:
            if res["success"]:
                # Add the successfully processed Markdown file to a ZIP archive.
                zip_file.writestr(res["filename"], res["content"])
            else:
                # If a file fails, create a TXT file containing the error message so the user is informed.
                zip_file.writestr(f"ERROR_{res['filename']}.txt", f"Failed to convert. Error: {res['error']}")
    
    # Reset the memory cursor position to the beginning before sending.
    zip_buffer.seek(0)
    
    # Send directly as a downloadable ZIP file.
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=extracted_markdowns.zip"}
    )