"""RAG layer — builds a FAISS retriever from PDFs in the documents/ folder.

The index is cached on disk in .rag_cache/ and only rebuilt when the PDFs
change (detected by fingerprinting filenames + modification times).

Usage (called once by board.py):
    from boardroom.rag import build_retriever
    retriever = build_retriever()   # returns None if no PDFs found
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .config import settings

_PROJECT_ROOT  = Path(__file__).resolve().parents[2]
DOCUMENTS_DIR  = _PROJECT_ROOT / "documents"
_CACHE_DIR     = _PROJECT_ROOT / ".rag_cache"
_FINGERPRINT_FILE = _CACHE_DIR / "fingerprint.txt"

_CHUNK_SIZE    = 1000
_CHUNK_OVERLAP = 150
_TOP_K         = 4


def _fingerprint(pdf_paths: list[Path]) -> str:
    """Hash the sorted list of PDF filenames and their modification times.
    Any addition, removal, or update to a PDF changes this hash."""
    digest = hashlib.md5()
    for p in pdf_paths:
        digest.update(f"{p.name}:{p.stat().st_mtime}".encode())
    return digest.hexdigest()


def _get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(api_key=settings.openai_api_key or None)


def _build_and_cache(pdf_paths: list[Path], fingerprint: str) -> FAISS:
    """Load PDFs, chunk, embed, save index to disk, return vectorstore."""
    print(f"[RAG] Loading {len(pdf_paths)} PDF(s)...")
    docs = []
    for path in pdf_paths:
        loader = PyPDFLoader(str(path))
        docs.extend(loader.load())

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=_CHUNK_SIZE,
        chunk_overlap=_CHUNK_OVERLAP,
    )
    chunks = splitter.split_documents(docs)
    print(f"[RAG] {len(docs)} pages → {len(chunks)} chunks. Embedding...")

    vectorstore = FAISS.from_documents(chunks, _get_embeddings())

    _CACHE_DIR.mkdir(exist_ok=True)
    vectorstore.save_local(str(_CACHE_DIR))
    _FINGERPRINT_FILE.write_text(fingerprint)
    print("[RAG] Index saved to cache.")

    return vectorstore


def build_retriever(documents_dir: Path = DOCUMENTS_DIR, k: int = _TOP_K):
    """Return a FAISS retriever backed by all PDFs in documents_dir.

    Loads from disk cache when documents are unchanged; rebuilds and
    saves to cache otherwise. Returns None when no PDFs are present.
    """
    pdf_paths = sorted(documents_dir.glob("*.pdf"))
    if not pdf_paths:
        print(f"[RAG] No PDFs found in {documents_dir}. Advisors will run without context.")
        return None

    current_fp = _fingerprint(pdf_paths)
    cached_fp  = _FINGERPRINT_FILE.read_text().strip() if _FINGERPRINT_FILE.exists() else ""

    if cached_fp == current_fp and (_CACHE_DIR / "index.faiss").exists():
        print("[RAG] Documents unchanged — loading index from cache.")
        vectorstore = FAISS.load_local(
            str(_CACHE_DIR),
            _get_embeddings(),
            allow_dangerous_deserialization=True,
        )
    else:
        print("[RAG] Documents changed (or first run) — rebuilding index...")
        vectorstore = _build_and_cache(pdf_paths, current_fp)

    print("[RAG] Retriever ready.")
    return vectorstore.as_retriever(search_kwargs={"k": k})
