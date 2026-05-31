import os
from fastapi import UploadFile, HTTPException

# --- CONFIGURATION ---
MAX_FILE_SIZE_MB = 15  # A good middle ground for PDFs and PPTXs
MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

# We map the MIME type to the expected extension AND its unique "Magic Bytes"
# magic bytes are the first few bytes of a file that indicate its true format, regardless of its extension
ALLOWED_TYPES = {
    "application/pdf": {
        "ext": ".pdf",
        "magic": b"%PDF"
    },
    "image/png": {
        "ext": ".png",
        "magic": b"\x89PNG\r\n\x1a\n"
    },
    "image/jpeg": {
        "ext": ".jpg", # We will normalize .jpeg to .jpg
        "magic": b"\xff\xd8\xff"
    },
    # This massive string is the official MIME type for PPTX files
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
        "ext": ".pptx",
        "magic": b"PK\x03\x04" # PPTX files are actually ZIP archives under the hood!
    }
}

async def validate_uploaded_file(file: UploadFile):
    """
    Validates file size, extension, MIME type, and Magic Bytes.
    Raises an HTTPException if the file fails any check.
    """
    # 1. FILE SIZE CHECK (read actual bytes — client-reported file.size cannot be trusted)
    header_bytes = await file.read(MAX_BYTES + 1)
    if len(header_bytes) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is too large. Maximum allowed size is {MAX_FILE_SIZE_MB}MB."
        )
    await file.seek(0)

    # 2. EXTENSION CHECK
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    
    # Normalize .jpeg to .jpg for easier checking
    if ext == ".jpeg":
        ext = ".jpg"

    valid_extensions = [info["ext"] for info in ALLOWED_TYPES.values()]
    if ext not in valid_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file extension. Allowed extensions are: {', '.join(valid_extensions)}"
        )

    # 3. MIME TYPE CHECK (What the browser says the file is)
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file format.")

    expected_info = ALLOWED_TYPES[file.content_type]
    if expected_info["ext"] != ext:
        raise HTTPException(
            status_code=400, 
            detail="File extension does not match its content type"
        )

    # 4. MAGIC BYTES CHECK (What the file ACTUALLY is)
    # header_bytes was already read above; no second read needed
    if not header_bytes.startswith(expected_info["magic"]):
        raise HTTPException(
            status_code=400, 
            detail="File content does not match its extension. Malicious file detected."
        )

    return ext # We return the safe extension so we can use it to rename the file later