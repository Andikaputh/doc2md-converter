from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from markitdown import MarkItDown
import os
import shutil

# Initialize FastAPI App
app = FastAPI(
    title="MarkItDown Converter API",
    description="API to convert documents to Markdown using Microsoft MarkItDown",
    version="1.0.0"
)

# Configure CORS to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MarkItDown instance
md = MarkItDown()

@app.post("/api/convert")
async def convert_document(file: UploadFile = File(...)):
    """
    Receives an uploaded file, saves it temporarily, 
    converts it to Markdown, and returns the string content.
    """
    temp_file_path = f"temp_{file.filename}"
    
    try:
        # Save the uploaded file temporarily
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Perform conversion
        result = md.convert(temp_file_path)
        
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