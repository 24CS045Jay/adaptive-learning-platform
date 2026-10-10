"""
Main FastAPI Application Entrypoint for University Agentic RAG Service.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router as api_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.embeddings.manager import get_embedding_manager
from app.vectorstore.chroma import get_chroma_store

setup_logging()
logger = logging.getLogger("rag_service.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle management."""
    settings = get_settings()
    logger.info(f"Initializing University Agentic RAG Service (env={settings.environment})...")

    # Pre-warm Chroma connection
    try:
        chroma = get_chroma_store()
        logger.info(f"Chroma connection initialized (Cloud={settings.is_chroma_cloud})")
    except Exception as e:
        logger.warning(f"Could not initialize Chroma on startup: {e}")

    # Pre-warm Embedding model
    try:
        emb = get_embedding_manager()
        logger.info(f"Embedding manager initialized with model={emb.model_name}")
    except Exception as e:
        logger.warning(f"Could not load embedding model on startup: {e}")

    # Pre-warm BM25 sparse index from Chroma
    try:
        from app.retrieval.bm25 import get_bm25_retriever
        bm25 = get_bm25_retriever()
        count = bm25.rebuild_from_chroma(chroma)
        logger.info(f"BM25 sparse retriever initialized ({count} indexed documents)")
    except Exception as e:
        logger.warning(f"Could not initialize BM25 sparse index on startup: {e}")

    yield

    logger.info("Shutting down University Agentic RAG Service...")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="University Agentic RAG Service",
        description="Production Agentic RAG with LangChain, LangGraph, Chroma Cloud, BGE-M3, and Hybrid Retrieval",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Global Exception Handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled server error on {request.url.path}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error in RAG service", "error": str(exc)},
        )

    # Include routes under /api/v1 and root
    app.include_router(api_router, prefix="/api/v1")
    app.include_router(api_router)  # Also support root paths /health, /query, etc.

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.service_host,
        port=settings.service_port,
        reload=(settings.environment == "development"),
    )
