"""Page-bounded chunks. A page longer than the embed limit is split on sentence boundaries."""

from __future__ import annotations

import re

CHUNK_CHARS = 800


def chunk_document(text: str) -> list[dict]:
    pages = text.split("\f") if text else []
    chunks = []
    for number, page in enumerate(pages or [""], start=1):
        cleaned = page.strip()
        if not cleaned:
            continue
        for piece in _split_page(cleaned):
            chunks.append({"page": number, "text": piece})
    return chunks


def _split_page(page: str) -> list[str]:
    if len(page) <= CHUNK_CHARS:
        return [page]
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", page) if part.strip()]
    if not sentences:
        return [_hard(page)]
    pieces: list[str] = []
    current = ""
    for sentence in sentences:
        if len(sentence) > CHUNK_CHARS:
            if current:
                pieces.append(current)
                current = ""
            pieces.extend(_hard(sentence))
            continue
        candidate = f"{current} {sentence}".strip()
        if len(candidate) <= CHUNK_CHARS:
            current = candidate
        else:
            if current:
                pieces.append(current)
            current = sentence
    if current:
        pieces.append(current)
    return pieces


def _hard(text: str) -> list[str]:
    return [text[index : index + CHUNK_CHARS] for index in range(0, len(text), CHUNK_CHARS)]
