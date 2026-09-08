import io

import pymupdf
from docx import Document as DocxDocument


def parse_txt(file_bytes: bytes) -> str:

    try:
        return file_bytes.decode("utf-8-sig")

    except UnicodeDecodeError:
        return file_bytes.decode("cp949")


def parse_pdf(file_bytes: bytes) -> str:

    pdf = pymupdf.open(
        stream=file_bytes,
        filetype="pdf",
    )

    pages: list[str] = []

    try:
        for page in pdf:

            text = page.get_text("text")

            if text and text.strip():
                pages.append(
                    text.strip()
                )

    finally:
        pdf.close()

    return "\n\n".join(pages)


def parse_docx(file_bytes: bytes) -> str:

    document = DocxDocument(
        io.BytesIO(file_bytes)
    )

    paragraphs: list[str] = []

    for paragraph in document.paragraphs:

        text = paragraph.text.strip()

        if text:
            paragraphs.append(text)

    return "\n\n".join(paragraphs)


def parse_document_bytes(
    file_bytes: bytes,
    document_type: str,
) -> str:

    document_type = document_type.upper()

    if document_type in {
        "TXT",
        "MD",
    }:
        return parse_txt(file_bytes)

    if document_type == "PDF":
        return parse_pdf(file_bytes)

    if document_type == "DOCX":
        return parse_docx(file_bytes)

    raise ValueError(
        f"Unsupported document type: {document_type}"
    )