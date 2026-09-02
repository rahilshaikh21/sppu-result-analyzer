from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import os
import shutil

import pymupdf
import pytesseract

from PIL import Image

from services.parser import (
    parse_multiple_students,
    merge_students
)


# ==========================================
# TESSERACT EXECUTABLE LOCATION
# ==========================================

pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


# ==========================================
# FASTAPI APP
# ==========================================

app = FastAPI(
    title="SPPU Result Analyzer",
    description="Automated SPPU Result Analysis and Ranking System",
    version="1.0.0"
)


# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# ROOT
# ==========================================

@app.get("/")
def root():

    return {
        "message": "SPPU Result Analyzer API is running"
    }


# ==========================================
# HEALTH CHECK
# ==========================================

@app.get("/api/health")
def health_check():

    return {
        "status": "success",
        "message": "Backend is working"
    }


# ==========================================
# UPLOAD RESULT PDF
# ==========================================

@app.post("/api/results/upload")
async def upload_result(
    file: UploadFile = File(...)
):

    # Check PDF file
    if file.content_type != "application/pdf":

        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed."
        )


    # Upload folder
    upload_folder = "uploads"

    os.makedirs(
        upload_folder,
        exist_ok=True
    )


    # Always save as RESULT.pdf
    file_path = os.path.join(
        upload_folder,
        "RESULT.pdf"
    )


    # Save uploaded PDF
    with open(
        file_path,
        "wb"
    ) as buffer:

        shutil.copyfileobj(
            file.file,
            buffer
        )


    return {
        "filename": "RESULT.pdf",
        "content_type": file.content_type,
        "message": "PDF uploaded and saved successfully"
    }


# ==========================================
# EXTRACT PDF TEXT
# ==========================================

@app.get("/api/results/extract")
def extract_result_text():

    file_path = os.path.join(
        "uploads",
        "RESULT.pdf"
    )


    if not os.path.exists(file_path):

        raise HTTPException(
            status_code=404,
            detail="RESULT.pdf not found."
        )


    document = pymupdf.open(file_path)

    pages = []


    for page_number, page in enumerate(document):

        text = page.get_text()


        pages.append({
            "page": page_number + 1,
            "text": text
        })


    document.close()


    return {
        "filename": "RESULT.pdf",
        "total_pages": len(pages),
        "pages": pages
    }


# ==========================================
# OCR TEST
# ==========================================

@app.get("/api/results/ocr-test")
def ocr_test():

    file_path = os.path.join(
        "uploads",
        "RESULT.pdf"
    )


    if not os.path.exists(file_path):

        raise HTTPException(
            status_code=404,
            detail="RESULT.pdf not found."
        )


    document = pymupdf.open(file_path)

    results = []


    for page_number, page in enumerate(document):

        # Convert PDF page to image
        pixmap = page.get_pixmap(
            matrix=pymupdf.Matrix(2, 2)
        )


        image = Image.frombytes(
            "RGB",
            [
                pixmap.width,
                pixmap.height
            ],
            pixmap.samples
        )


        # Run OCR
        text = pytesseract.image_to_string(
            image,
            lang="eng"
        )


        results.append({
            "page": page_number + 1,
            "text": text
        })


    document.close()


    # Save complete OCR output
    raw_text = "\n\n".join(
        page["text"]
        for page in results
    )


    with open(
        "raw_result.txt",
        "w",
        encoding="utf-8"
    ) as file:

        file.write(raw_text)


    return {
        "filename": "RESULT.pdf",
        "total_pages": len(results),
        "pages": results,
        "raw_text_file": "raw_result.txt"
    }


# ==========================================
# PARSE RESULT
# ==========================================

@app.get("/api/results/parse")
def parse_result():

    file_path = os.path.join(
        "uploads",
        "RESULT.pdf"
    )

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail="RESULT.pdf not found."
        )

    document = pymupdf.open(file_path)

    all_students = []

    # ==========================================
    # PROCESS EVERY PDF PAGE
    # ==========================================

    for page_number, page in enumerate(document):

        # --------------------------------------
        # 1. Try normal PDF text extraction
        # --------------------------------------

        text = page.get_text("text")

        # --------------------------------------
        # 2. OCR fallback if PDF has no text
        # --------------------------------------

        if not text or len(text.strip()) < 50:

            pixmap = page.get_pixmap(
                matrix=pymupdf.Matrix(2, 2)
            )

            image = Image.frombytes(
                "RGB",
                [
                    pixmap.width,
                    pixmap.height
                ],
                pixmap.samples
            )

            text = pytesseract.image_to_string(
                image,
                lang="eng"
            )

        # --------------------------------------
        # 3. Parse students
        # --------------------------------------

        page_students = parse_multiple_students(text)

        # --------------------------------------
        # 4. Store original PDF page
        # --------------------------------------

        for student in page_students:

            student["result_page"] = (
                page_number + 1
            )

            all_students.append(student)

    document.close()

    # ==========================================
    # MERGE SAME STUDENTS
    # ==========================================

    all_students = merge_students(
        all_students
    )

    # ==========================================
    # RANK STUDENTS
    # ==========================================

    # Highest overall SGPA first
    all_students.sort(
        key=lambda student: (
            student.get("overall_sgpa") is not None,
            student.get("overall_sgpa") or 0
        ),
        reverse=True
    )

    # Assign rank
    for rank, student in enumerate(
        all_students,
        start=1
    ):
        student["rank"] = rank

    # ==========================================
    # RESPONSE
    # ==========================================

    return {
        "status": "success",
        "total_students": len(all_students),
        "students": all_students
    }


# ==========================================
# VIEW ORIGINAL RESULT PAGE
# ==========================================

@app.get("/api/results/view/{page_number}")
def view_result_page(
    page_number: int
):

    file_path = os.path.join(
        "uploads",
        "RESULT.pdf"
    )


    if not os.path.exists(file_path):

        raise HTTPException(
            status_code=404,
            detail="RESULT.pdf not found."
        )


    document = pymupdf.open(file_path)


    total_pages = len(document)


    # Validate page number
    if (
        page_number < 1
        or page_number > total_pages
    ):

        document.close()

        raise HTTPException(
            status_code=404,
            detail="Invalid PDF page number."
        )


    # Temporary single-page PDF
    output_path = os.path.join(
        "uploads",
        f"student_result_page_{page_number}.pdf"
    )


    new_document = pymupdf.open()


    # Copy only requested page
    new_document.insert_pdf(
        document,
        from_page=page_number - 1,
        to_page=page_number - 1
    )


    # Save single-page PDF
    new_document.save(
        output_path
    )


    new_document.close()
    document.close()


    # Return PDF
    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=(
            f"student_result_page_{page_number}.pdf"
        )
    )