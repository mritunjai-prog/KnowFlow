"""Local text extraction. Images are not transcribed here."""

import io
import zipfile

MAX_PAGES = 20
MAX_UNCOMPRESSED = 40_000_000

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class ParseError(Exception):
    pass


def detect_media(data: bytes, filename: str) -> str | None:
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"PK") and _is_docx(data):
        return DOCX
    if b"\x00" not in data and filename.lower().endswith((".txt", ".text", ".md")):
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            return None
        return "text/plain"
    return None


def _is_docx(data: bytes) -> bool:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            names = set(archive.namelist())
            return "word/document.xml" in names and _zip_is_safe(archive)
    except zipfile.BadZipFile:
        return False


def _zip_is_safe(archive: zipfile.ZipFile) -> bool:
    infos = archive.infolist()
    if len(infos) > 200:
        raise ParseError("The document archive is too complex.")
    if sum(item.file_size for item in infos) > MAX_UNCOMPRESSED:
        raise ParseError("The document archive expands too far.")
    return True


def pdf_page_count(data: bytes) -> int:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        raise ParseError("Encrypted PDFs are not supported.")
    count = len(reader.pages)
    if count < 1 or count > MAX_PAGES:
        raise ParseError(f"PDFs must contain 1 to {MAX_PAGES} pages.")
    return count


def pdf_page_text(data: bytes, index: int) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    text = reader.pages[index].extract_text() or ""
    return text.strip()


def render_pdf_page(data: bytes, index: int) -> bytes:
    import pypdfium2 as pdfium

    pdf = pdfium.PdfDocument(data)
    try:
        page = pdf[index]
        bitmap = page.render(scale=1.5)
        image = bitmap.to_pil()
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()
    finally:
        pdf.close()


def docx_text(data: bytes) -> str:
    from docx import Document

    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        _zip_is_safe(archive)
    document = Document(io.BytesIO(data))
    parts = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                parts.append(" | ".join(cells))
    text = "\n".join(parts).strip()
    if not text:
        raise ParseError("The document has no extractable text.")
    return text


def plain_text(data: bytes, limit: int) -> str:
    if b"\x00" in data:
        raise ParseError("The file is not plain text.")
    try:
        text = data.decode("utf-8").strip()
    except UnicodeDecodeError as exc:
        raise ParseError("Plain text must be UTF-8.") from exc
    if not text:
        raise ParseError("The file is empty.")
    if len(text) > limit:
        raise ParseError("The text is longer than the configured limit.")
    return text
