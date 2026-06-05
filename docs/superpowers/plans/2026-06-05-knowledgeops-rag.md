# KnowledgeOps RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable public technical-team RAG knowledge base demo with React, FastAPI, Supabase pgvector, DashScope embeddings, and DeepSeek-compatible chat.

**Architecture:** Create a separate `KnowledgeOpsRAG` Git repository with `frontend/`, `backend/`, `supabase/`, and deploy config. The frontend is a Netlify-hosted React console dashboard. The backend is a Render-hosted FastAPI API that parses files, indexes chunks into Supabase pgvector, retrieves citations, and answers with DeepSeek-compatible chat.

**Tech Stack:** React, Vite, TypeScript, Python, FastAPI, pytest, Supabase Postgres + pgvector, optional Supabase Storage, DashScope `text-embedding-v4`, DeepSeek-compatible chat, Netlify, Render.

---

## File Structure

Create a new project at `/Users/wangmenglong/Desktop/KnowledgeOpsRAG`.

```text
KnowledgeOpsRAG/
  README.md
  .gitignore
  render.yaml
  supabase/
    schema.sql
    seed_documents/
      render-deploy-runbook.md
      fastapi-api-guide.md
      supabase-vector-notes.md
  backend/
    requirements.txt
    pytest.ini
    .env.example
    run.py
    app/
      __init__.py
      main.py
      settings.py
      schemas.py
      chunking.py
      files.py
      embeddings.py
      chat_client.py
      rag.py
      supabase_repo.py
    tests/
      test_health.py
      test_chunking.py
      test_file_validation.py
      test_rag_flow.py
  frontend/
    package.json
    index.html
    tsconfig.json
    vite.config.ts
    netlify.toml
    .env.example
    src/
      main.tsx
      App.tsx
      api.ts
      types.ts
      mockData.ts
      styles.css
      test-setup.ts
      App.test.tsx
      vite-env.d.ts
```

## Task 1: Scaffold Repository and Shared Config

**Files:**
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/.gitignore`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/README.md`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/render.yaml`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/.env.example`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/.env.example`

- [ ] **Step 1: Create the project directory**

Run:

```bash
mkdir -p /Users/wangmenglong/Desktop/KnowledgeOpsRAG
```

Expected: directory exists.

- [ ] **Step 2: Create `.gitignore`**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/.gitignore`:

```gitignore
node_modules/
dist/
*.tsbuildinfo
.env
.venv/
__pycache__/
.pytest_cache/
*.pyc
.DS_Store
.netlify/
.superpowers/
```

- [ ] **Step 3: Create `README.md`**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/README.md`:

```markdown
# KnowledgeOps RAG

A public technical-team knowledge base RAG demo built with React, FastAPI, Supabase pgvector, DashScope embeddings, and DeepSeek-compatible chat.

## Stack

- Frontend: React, Vite, TypeScript, Netlify
- Backend: Python, FastAPI, Render
- Database: Supabase Postgres + pgvector
- Embeddings: DashScope `text-embedding-v4`
- Chat: DeepSeek-compatible `deepseek-V4-flash`

## Local Development

Backend:

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Supabase

Run `supabase/schema.sql` in the Supabase SQL editor before using the app.
```

- [ ] **Step 4: Create `render.yaml`**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/render.yaml`:

```yaml
services:
  - type: web
    name: knowledgeops-rag-api
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: python run.py
    envVars:
      - key: OPENAI_BASE_URL
        value: https://api.deepseek.com
      - key: OPENAI_MODEL
        value: deepseek-V4-flash
      - key: DASHSCOPE_BASE_URL
        value: https://dashscope.aliyuncs.com/compatible-mode/v1
      - key: DASHSCOPE_EMBEDDING_MODEL
        value: text-embedding-v4
      - key: DASHSCOPE_EMBEDDING_DIMENSIONS
        value: "1024"
      - key: SUPABASE_STORAGE_BUCKET
        value: knowledgeops-documents
      - key: OPENAI_API_KEY
        sync: false
      - key: DASHSCOPE_API_KEY
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: ALLOWED_ORIGINS
        sync: false
```

- [ ] **Step 5: Create backend `.env.example`**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/.env.example`:

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-V4-flash

DASHSCOPE_API_KEY=
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_EMBEDDING_MODEL=text-embedding-v4
DASHSCOPE_EMBEDDING_DIMENSIONS=1024

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=knowledgeops-documents

ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174
```

- [ ] **Step 6: Create frontend `.env.example`**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/.env.example`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

- [ ] **Step 7: Initialize Git and commit**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG
git init
git branch -M main
git add .
git commit -m "chore: scaffold knowledgeops rag"
```

Expected: initial commit succeeds.

## Task 2: Supabase Schema and Seed Documents

**Files:**
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/supabase/schema.sql`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/supabase/seed_documents/render-deploy-runbook.md`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/supabase/seed_documents/fastapi-api-guide.md`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/supabase/seed_documents/supabase-vector-notes.md`

- [ ] **Step 1: Create Supabase schema**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/supabase/schema.sql`:

```sql
create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  file_type text not null,
  tags text[] not null default '{}',
  status text not null default 'indexed',
  chunk_count integer not null default 0,
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content text not null,
  chunk_index integer not null,
  token_estimate integer not null default 0,
  embedding vector(1024) not null,
  created_at timestamptz not null default now()
);

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_embedding_idx
on document_chunks using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create index if not exists documents_created_at_idx on documents (created_at desc);
create index if not exists chat_messages_created_at_idx on chat_messages (created_at desc);

create or replace function match_document_chunks(
  query_embedding vector(1024),
  match_count int default 5,
  similarity_threshold float default 0.2
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  content text,
  similarity float,
  chunk_index int
)
language sql
stable
as $$
  select
    document_chunks.id as chunk_id,
    documents.id as document_id,
    documents.title as document_title,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity,
    document_chunks.chunk_index
  from document_chunks
  join documents on documents.id = document_chunks.document_id
  where 1 - (document_chunks.embedding <=> query_embedding) >= similarity_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
```

- [ ] **Step 2: Create seed document `render-deploy-runbook.md`**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/supabase/seed_documents/render-deploy-runbook.md`:

```markdown
# Render Deploy Runbook

When a Render deployment fails after a successful build, inspect runtime logs first. Common causes include missing environment variables, an invalid start command, and binding to the wrong port.

Python web services should read the `PORT` environment variable provided by Render. A safe pattern is to start the app from a small Python entrypoint that reads `os.environ.get("PORT", "8000")` and passes it to Uvicorn.

For FastAPI services, verify the health check path returns a 200 response. If the service is on the free plan, remember that cold starts can delay the first request.
```

- [ ] **Step 3: Create seed document `fastapi-api-guide.md`**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/supabase/seed_documents/fastapi-api-guide.md`:

```markdown
# FastAPI API Guide

FastAPI routers should keep request validation, service orchestration, and persistence separated. Use Pydantic models for request and response contracts.

For file upload endpoints, validate file extension, content type, and file size before parsing. Return clear 400 responses for unsupported formats and oversized files.

For AI endpoints, keep API keys on the backend. The frontend should call only the FastAPI service, never the model provider directly.
```

- [ ] **Step 4: Create seed document `supabase-vector-notes.md`**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/supabase/seed_documents/supabase-vector-notes.md`:

```markdown
# Supabase Vector Notes

Supabase Postgres can store embeddings with the pgvector extension. For DashScope text-embedding-v4 with 1024 dimensions, define chunk embeddings as `vector(1024)`.

A retrieval function should accept the query embedding and return the most similar chunks with document titles and similarity scores. Cosine distance can be converted into similarity with `1 - (embedding <=> query_embedding)`.

Keep original documents optional. For lightweight demos, storing chunks and metadata is usually enough. Save raw files to Supabase Storage only when download or audit behavior is needed.
```

- [ ] **Step 5: Commit**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG
git add supabase
git commit -m "feat: add supabase rag schema"
```

Expected: commit succeeds.

## Task 3: Backend Foundation and Health

**Files:**
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/requirements.txt`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/pytest.ini`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/run.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/__init__.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/settings.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/schemas.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/main.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/tests/test_health.py`

- [ ] **Step 1: Create backend dependencies**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/requirements.txt`:

```text
fastapi==0.115.6
uvicorn[standard]==0.34.0
httpx==0.28.1
pydantic-settings==2.7.1
pytest==8.3.4
pytest-asyncio==0.25.2
python-multipart==0.0.20
pypdf==5.1.0
supabase==2.10.0
```

- [ ] **Step 2: Create pytest config**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/pytest.ini`:

```ini
[pytest]
pythonpath = .
```

- [ ] **Step 3: Create health test**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/tests/test_health.py`:

```python
from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_model_and_embedding_settings():
    client = TestClient(app)

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "chat_model": "deepseek-V4-flash",
        "embedding_model": "text-embedding-v4",
        "embedding_dimensions": 1024,
    }
```

- [ ] **Step 4: Run test and verify it fails**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
pytest tests/test_health.py -v
```

Expected: FAIL because `app.main` does not exist.

- [ ] **Step 5: Create settings**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/settings.py`:

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_base_url: str = "https://api.deepseek.com"
    openai_model: str = "deepseek-V4-flash"

    dashscope_api_key: str = ""
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    dashscope_embedding_model: str = "text-embedding-v4"
    dashscope_embedding_dimensions: int = 1024

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "knowledgeops-documents"

    allowed_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174"
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 6: Create schemas**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/schemas.py`:

```python
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    chat_model: str
    embedding_model: str
    embedding_dimensions: int
```

- [ ] **Step 7: Create FastAPI app**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/main.py`:

```python
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import HealthResponse
from app.settings import Settings, get_settings


def create_app() -> FastAPI:
    app = FastAPI(title="KnowledgeOps RAG API")
    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health", response_model=HealthResponse)
    async def health(current: Settings = Depends(get_settings)) -> HealthResponse:
        return HealthResponse(
            status="ok",
            chat_model=current.openai_model,
            embedding_model=current.dashscope_embedding_model,
            embedding_dimensions=current.dashscope_embedding_dimensions,
        )

    return app


app = create_app()
```

- [ ] **Step 8: Create package and Render entrypoint**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/__init__.py`:

```python
```

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/run.py`:

```python
import os

import uvicorn


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
```

- [ ] **Step 9: Run health test**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend
. .venv/bin/activate
pytest tests/test_health.py -v
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG
git add backend
git commit -m "feat: add fastapi foundation"
```

Expected: commit succeeds.

## Task 4: File Validation, Parsing, and Chunking

**Files:**
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/files.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/chunking.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/tests/test_file_validation.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/tests/test_chunking.py`

- [ ] **Step 1: Create file validation tests**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/tests/test_file_validation.py`:

```python
import pytest

from app.files import validate_upload_name


def test_validate_upload_name_accepts_supported_extensions():
    assert validate_upload_name("guide.pdf") == "pdf"
    assert validate_upload_name("notes.txt") == "txt"
    assert validate_upload_name("runbook.md") == "md"
    assert validate_upload_name("manual.markdown") == "markdown"


def test_validate_upload_name_rejects_unsupported_extensions():
    with pytest.raises(ValueError, match="Unsupported file type"):
        validate_upload_name("archive.zip")
```

- [ ] **Step 2: Create chunking tests**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/tests/test_chunking.py`:

```python
from app.chunking import chunk_text


def test_chunk_text_removes_blank_chunks():
    chunks = chunk_text("First paragraph.\\n\\n\\nSecond paragraph.", max_chars=80, overlap=10)

    assert chunks == ["First paragraph.\\nSecond paragraph."]


def test_chunk_text_splits_long_text_with_overlap():
    text = "A" * 120 + "B" * 120

    chunks = chunk_text(text, max_chars=100, overlap=20)

    assert len(chunks) == 3
    assert chunks[0] == "A" * 100
    assert chunks[1].startswith("A" * 20)
    assert chunks[2].endswith("B" * 80)
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend
. .venv/bin/activate
pytest tests/test_file_validation.py tests/test_chunking.py -v
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement file utilities**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/files.py`:

```python
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader


SUPPORTED_EXTENSIONS = {"pdf", "txt", "md", "markdown"}


def validate_upload_name(file_name: str) -> str:
    extension = Path(file_name).suffix.lower().lstrip(".")
    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError("Unsupported file type. Upload PDF, TXT, or Markdown.")
    return extension


def extract_text(file_name: str, content: bytes) -> str:
    extension = validate_upload_name(file_name)
    if extension == "pdf":
        reader = PdfReader(BytesIO(content))
        return "\\n".join(page.extract_text() or "" for page in reader.pages).strip()
    return content.decode("utf-8", errors="ignore").strip()
```

- [ ] **Step 5: Implement chunking**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/chunking.py`:

```python
def normalize_text(text: str) -> str:
    lines = [line.strip() for line in text.replace("\\r\\n", "\\n").split("\\n")]
    return "\\n".join(line for line in lines if line)


def chunk_text(text: str, max_chars: int = 1200, overlap: int = 160) -> list[str]:
    normalized = normalize_text(text)
    if not normalized:
        return []
    if len(normalized) <= max_chars:
        return [normalized]

    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + max_chars, len(normalized))
        chunks.append(normalized[start:end])
        if end == len(normalized):
            break
        start = max(0, end - overlap)
    return chunks
```

- [ ] **Step 6: Run tests**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend
. .venv/bin/activate
pytest tests/test_file_validation.py tests/test_chunking.py -v
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG
git add backend/app/files.py backend/app/chunking.py backend/tests/test_file_validation.py backend/tests/test_chunking.py
git commit -m "feat: add document parsing utilities"
```

Expected: commit succeeds.

## Task 5: Embedding, Chat, Repository, and RAG Service

**Files:**
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/embeddings.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/chat_client.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/supabase_repo.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/rag.py`
- Modify: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/schemas.py`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/tests/test_rag_flow.py`

- [ ] **Step 1: Extend schemas**

Modify `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/schemas.py` to contain:

```python
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    chat_model: str
    embedding_model: str
    embedding_dimensions: int


class DocumentSummary(BaseModel):
    id: str
    title: str
    file_name: str
    file_type: str
    tags: list[str] = Field(default_factory=list)
    status: str
    chunk_count: int
    storage_path: str | None = None


class Citation(BaseModel):
    document_id: str
    document_title: str
    content: str
    similarity: float
    chunk_index: int


class AskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    match_count: int = Field(default=5, ge=1, le=8)


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
```

- [ ] **Step 2: Create RAG flow test with fakes**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/tests/test_rag_flow.py`:

```python
import pytest

from app.rag import RagService


class FakeEmbeddings:
    async def embed_texts(self, texts):
        return [[0.1, 0.2, 0.3] for _ in texts]


class FakeRepo:
    async def match_chunks(self, embedding, match_count, similarity_threshold):
        return [
            {
                "document_id": "doc-1",
                "document_title": "Render Runbook",
                "content": "Check Render logs and verify the start command.",
                "similarity": 0.91,
                "chunk_index": 0,
            }
        ]

    async def save_chat(self, question, answer, citations):
        return None


class FakeChat:
    async def answer(self, question, citations):
        return f"Answer grounded in {citations[0]['document_title']}: {question}"


@pytest.mark.asyncio
async def test_rag_service_returns_answer_and_citations():
    service = RagService(
        embeddings=FakeEmbeddings(),
        repo=FakeRepo(),
        chat=FakeChat(),
    )

    result = await service.answer_question("How do I fix a failed deploy?", match_count=3)

    assert result.answer.startswith("Answer grounded in Render Runbook")
    assert result.citations[0].document_title == "Render Runbook"
    assert result.citations[0].similarity == 0.91
```

- [ ] **Step 3: Run test and verify it fails**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend
. .venv/bin/activate
pytest tests/test_rag_flow.py -v
```

Expected: FAIL because `app.rag` does not exist.

- [ ] **Step 4: Create embedding client**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/embeddings.py`:

```python
import httpx

from app.settings import Settings


class EmbeddingClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not self.settings.dashscope_api_key:
            raise RuntimeError("DASHSCOPE_API_KEY is not configured on the backend.")

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.settings.dashscope_base_url.rstrip('/')}/embeddings",
                headers={"Authorization": f"Bearer {self.settings.dashscope_api_key}"},
                json={
                    "model": self.settings.dashscope_embedding_model,
                    "input": texts,
                    "dimensions": self.settings.dashscope_embedding_dimensions,
                },
            )
            response.raise_for_status()
            payload = response.json()
            return [item["embedding"] for item in payload["data"]]
```

- [ ] **Step 5: Create chat client**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/chat_client.py`:

```python
import httpx

from app.schemas import Citation
from app.settings import Settings


class ChatClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def answer(self, question: str, citations: list[dict]) -> str:
        if not self.settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured on the backend.")

        context = "\\n\\n".join(
            f"Source {index + 1}: {item['document_title']}\\n{item['content']}"
            for index, item in enumerate(citations)
        )
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a technical knowledge base assistant. "
                    "Answer only from the provided sources. If the sources are insufficient, say so clearly."
                ),
            },
            {"role": "user", "content": f"Question: {question}\\n\\nSources:\\n{context}"},
        ]

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self.settings.openai_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {self.settings.openai_api_key}"},
                json={"model": self.settings.openai_model, "messages": messages},
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
```

- [ ] **Step 6: Create Supabase repository**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/supabase_repo.py`:

```python
from supabase import Client, create_client

from app.settings import Settings


class SupabaseRepo:
    def __init__(self, settings: Settings):
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("Supabase URL and service role key are required.")
        self.settings = settings
        self.client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)

    async def match_chunks(
        self,
        embedding: list[float],
        match_count: int = 5,
        similarity_threshold: float = 0.2,
    ) -> list[dict]:
        response = self.client.rpc(
            "match_document_chunks",
            {
                "query_embedding": embedding,
                "match_count": match_count,
                "similarity_threshold": similarity_threshold,
            },
        ).execute()
        return response.data or []

    async def save_chat(self, question: str, answer: str, citations: list[dict]) -> None:
        session = self.client.table("chat_sessions").insert({"title": question[:80]}).execute()
        session_id = session.data[0]["id"]
        self.client.table("chat_messages").insert(
            [
                {"session_id": session_id, "role": "user", "content": question, "citations": []},
                {
                    "session_id": session_id,
                    "role": "assistant",
                    "content": answer,
                    "citations": citations,
                },
            ]
        ).execute()
```

- [ ] **Step 7: Create RAG service**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/rag.py`:

```python
from app.schemas import AskResponse, Citation


class RagService:
    def __init__(self, embeddings, repo, chat):
        self.embeddings = embeddings
        self.repo = repo
        self.chat = chat

    async def answer_question(self, question: str, match_count: int = 5) -> AskResponse:
        query_embedding = (await self.embeddings.embed_texts([question]))[0]
        matches = await self.repo.match_chunks(
            query_embedding,
            match_count=match_count,
            similarity_threshold=0.2,
        )
        if not matches:
            answer = "I do not have enough indexed context to answer that question yet."
            await self.repo.save_chat(question, answer, [])
            return AskResponse(answer=answer, citations=[])

        answer = await self.chat.answer(question, matches)
        citations = [Citation(**item) for item in matches]
        await self.repo.save_chat(question, answer, [citation.model_dump() for citation in citations])
        return AskResponse(answer=answer, citations=citations)
```

- [ ] **Step 8: Run RAG flow test**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend
. .venv/bin/activate
pytest tests/test_rag_flow.py -v
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG
git add backend/app backend/tests/test_rag_flow.py
git commit -m "feat: add rag service clients"
```

Expected: commit succeeds.

## Task 6: Backend API Endpoints

**Files:**
- Modify: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/main.py`
- Modify: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/supabase_repo.py`

- [ ] **Step 1: Add repository document methods**

Modify `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/supabase_repo.py` by adding these methods to `SupabaseRepo`:

```python
    async def list_documents(self) -> list[dict]:
        response = self.client.table("documents").select("*").order("created_at", desc=True).execute()
        return response.data or []

    async def upload_original_file(self, storage_path: str, content: bytes, content_type: str) -> str:
        self.client.storage.from_(self.settings.supabase_storage_bucket).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        return storage_path

    async def create_document_with_chunks(
        self,
        title: str,
        file_name: str,
        file_type: str,
        tags: list[str],
        chunks: list[str],
        embeddings: list[list[float]],
        storage_path: str | None = None,
    ) -> dict:
        document = self.client.table("documents").insert(
            {
                "title": title,
                "file_name": file_name,
                "file_type": file_type,
                "tags": tags,
                "status": "indexed",
                "chunk_count": len(chunks),
                "storage_path": storage_path,
            }
        ).execute()
        document_data = document.data[0]
        rows = [
            {
                "document_id": document_data["id"],
                "content": chunk,
                "chunk_index": index,
                "token_estimate": max(1, len(chunk) // 4),
                "embedding": embedding,
            }
            for index, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]
        if rows:
            self.client.table("document_chunks").insert(rows).execute()
        return {**document_data, "chunk_count": len(chunks)}

    async def delete_document(self, document_id: str) -> None:
        self.client.table("documents").delete().eq("id", document_id).execute()

    async def reset_demo(self) -> None:
        self.client.table("chat_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        self.client.table("documents").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
```

- [ ] **Step 2: Modify `main.py` with API routes**

Modify `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend/app/main.py` to contain:

```python
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.chat_client import ChatClient
from app.chunking import chunk_text
from app.embeddings import EmbeddingClient
from app.files import extract_text, validate_upload_name
from app.rag import RagService
from app.schemas import AskRequest, AskResponse, DocumentSummary, HealthResponse
from app.settings import Settings, get_settings
from app.supabase_repo import SupabaseRepo


def create_app() -> FastAPI:
    app = FastAPI(title="KnowledgeOps RAG API")
    settings = get_settings()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health", response_model=HealthResponse)
    async def health(current: Settings = Depends(get_settings)) -> HealthResponse:
        return HealthResponse(
            status="ok",
            chat_model=current.openai_model,
            embedding_model=current.dashscope_embedding_model,
            embedding_dimensions=current.dashscope_embedding_dimensions,
        )

    @app.get("/api/documents", response_model=list[DocumentSummary])
    async def list_documents(current: Settings = Depends(get_settings)) -> list[DocumentSummary]:
        repo = SupabaseRepo(current)
        return [DocumentSummary(**item) for item in await repo.list_documents()]

    @app.post("/api/documents", response_model=DocumentSummary)
    async def upload_document(
        file: UploadFile = File(...),
        tags: str = Form(default=""),
        save_original: bool = Form(default=False),
        current: Settings = Depends(get_settings),
    ) -> DocumentSummary:
        content = await file.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size must be 5 MB or less.")

        try:
            file_type = validate_upload_name(file.filename or "")
            text = extract_text(file.filename or "", content)
            chunks = chunk_text(text)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if not chunks:
            raise HTTPException(status_code=400, detail="No readable text was found in this file.")
        if len(chunks) > 80:
            raise HTTPException(status_code=400, detail="File produced too many chunks for this public demo.")

        embeddings = await EmbeddingClient(current).embed_texts(chunks)
        repo = SupabaseRepo(current)

        storage_path = None
        if save_original:
            safe_name = (file.filename or "untitled").replace("/", "-")
            storage_path = f"uploads/{safe_name}"
            await repo.upload_original_file(
                storage_path=storage_path,
                content=content,
                content_type=file.content_type or "application/octet-stream",
            )

        document = await repo.create_document_with_chunks(
            title=(file.filename or "Untitled").rsplit(".", 1)[0],
            file_name=file.filename or "untitled",
            file_type=file_type,
            tags=[tag.strip() for tag in tags.split(",") if tag.strip()],
            chunks=chunks,
            embeddings=embeddings,
            storage_path=storage_path,
        )
        return DocumentSummary(**document)

    @app.delete("/api/documents/{document_id}", status_code=204)
    async def delete_document(document_id: str, current: Settings = Depends(get_settings)) -> None:
        repo = SupabaseRepo(current)
        await repo.delete_document(document_id)

    @app.post("/api/reset", status_code=204)
    async def reset_demo(current: Settings = Depends(get_settings)) -> None:
        repo = SupabaseRepo(current)
        await repo.reset_demo()

    @app.post("/api/ask", response_model=AskResponse)
    async def ask(request: AskRequest, current: Settings = Depends(get_settings)) -> AskResponse:
        service = RagService(
            embeddings=EmbeddingClient(current),
            repo=SupabaseRepo(current),
            chat=ChatClient(current),
        )
        return await service.answer_question(request.question, request.match_count)

    return app


app = create_app()
```

- [ ] **Step 3: Add real optional original-file storage**

In `upload_document`, replace the `document = await repo.create_document_with_chunks(...)` block with:

```python
        storage_path = None
        if save_original:
            safe_name = (file.filename or "untitled").replace("/", "-")
            storage_path = f"uploads/{safe_name}"
            await repo.upload_original_file(
                storage_path=storage_path,
                content=content,
                content_type=file.content_type or "application/octet-stream",
            )

        document = await repo.create_document_with_chunks(
            title=(file.filename or "Untitled").rsplit(".", 1)[0],
            file_name=file.filename or "untitled",
            file_type=file_type,
            tags=[tag.strip() for tag in tags.split(",") if tag.strip()],
            chunks=chunks,
            embeddings=embeddings,
            storage_path=storage_path,
        )
```

- [ ] **Step 4: Run backend tests**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend
. .venv/bin/activate
pytest -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG
git add backend/app/main.py backend/app/supabase_repo.py
git commit -m "feat: add rag api endpoints"
```

Expected: commit succeeds.

## Task 7: Frontend Foundation

**Files:**
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/package.json`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/index.html`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/tsconfig.json`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/vite.config.ts`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/netlify.toml`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/vite-env.d.ts`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/test-setup.ts`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/types.ts`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/api.ts`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/mockData.ts`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/main.tsx`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/App.test.tsx`

- [ ] **Step 1: Create package config**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/package.json`:

```json
{
  "name": "knowledgeops-rag-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.21",
    "typescript": "^5.9.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.468.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.9"
  }
}
```

- [ ] **Step 2: Create Vite files**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>KnowledgeOps RAG</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals"]
  },
  "include": ["src"],
  "references": []
}
```

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts'
  }
});
```

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
```

- [ ] **Step 3: Create frontend utility files**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/types.ts`:

```ts
export type DocumentSummary = {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  tags: string[];
  status: string;
  chunk_count: number;
  storage_path?: string | null;
};

export type Citation = {
  document_id: string;
  document_title: string;
  content: string;
  similarity: number;
  chunk_index: number;
};

export type AskResponse = {
  answer: string;
  citations: Citation[];
};
```

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/api.ts`:

```ts
import type { AskResponse, DocumentSummary } from './types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}${path}`, init);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function listDocuments(): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>('/api/documents');
}

export function askQuestion(question: string): Promise<AskResponse> {
  return request<AskResponse>('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question })
  });
}
```

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/mockData.ts`:

```ts
import type { Citation, DocumentSummary } from './types';

export const fallbackDocuments: DocumentSummary[] = [
  {
    id: 'doc-render',
    title: 'Render Deploy Runbook',
    file_name: 'render-deploy-runbook.md',
    file_type: 'md',
    tags: ['deploy', 'render'],
    status: 'indexed',
    chunk_count: 4
  },
  {
    id: 'doc-fastapi',
    title: 'FastAPI API Guide',
    file_name: 'fastapi-api-guide.md',
    file_type: 'md',
    tags: ['api', 'python'],
    status: 'indexed',
    chunk_count: 3
  }
];

export const fallbackCitations: Citation[] = [
  {
    document_id: 'doc-render',
    document_title: 'Render Deploy Runbook',
    content: 'Inspect runtime logs, start command, environment variables, and port binding.',
    similarity: 0.91,
    chunk_index: 0
  }
];
```

- [ ] **Step 4: Create React entrypoint**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Create render test**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;

describe('App', () => {
  it('renders the KnowledgeOps dashboard shell', async () => {
    render(<App />);

    expect(screen.getByText('KnowledgeOps')).toBeInTheDocument();
    expect(screen.getByText('Engineering knowledge base')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload docs/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test and verify it fails**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend
npm install
npm test
```

Expected: FAIL because `App.tsx` and `styles.css` do not exist.

## Task 8: Frontend Console Dashboard UI

**Files:**
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/App.tsx`
- Create: `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/styles.css`

- [ ] **Step 1: Create `App.tsx`**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/App.tsx`:

```tsx
import { Database, FileText, History, MessageSquare, RotateCcw, Search, Upload } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { askQuestion, listDocuments } from './api';
import { fallbackCitations, fallbackDocuments } from './mockData';
import type { AskResponse, DocumentSummary } from './types';

function App() {
  const [documents, setDocuments] = useState<DocumentSummary[]>(fallbackDocuments);
  const [question, setQuestion] = useState('How should we recover when the Render API deployment fails after build?');
  const [answer, setAnswer] = useState<AskResponse>({
    answer: 'Ask a question to retrieve relevant runbook chunks and generate a grounded answer.',
    citations: fallbackCitations
  });
  const [status, setStatus] = useState('demo mode');
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    listDocuments()
      .then((items) => {
        setDocuments(items.length ? items : fallbackDocuments);
        setStatus('api connected');
      })
      .catch(() => setStatus('demo mode'));
  }, []);

  const metrics = useMemo(() => {
    const chunkCount = documents.reduce((sum, item) => sum + item.chunk_count, 0);
    return { docs: documents.length, chunks: chunkCount };
  }, [documents]);

  async function handleAsk(event: FormEvent) {
    event.preventDefault();
    if (!question.trim() || isAsking) return;
    setIsAsking(true);
    try {
      const response = await askQuestion(question.trim());
      setAnswer(response);
      setStatus('answer generated');
    } catch (error) {
      setAnswer({
        answer: error instanceof Error ? error.message : 'Question failed.',
        citations: []
      });
      setStatus('demo mode');
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <strong>KnowledgeOps</strong>
          <span>Technical RAG Demo</span>
        </div>
        <nav>
          <a className="active" href="#ask"><MessageSquare size={16} /> Ask workspace</a>
          <a href="#documents"><FileText size={16} /> Documents</a>
          <a href="#sources"><Database size={16} /> Sources</a>
          <a href="#history"><History size={16} /> History</a>
        </nav>
        <p>Netlify · Render · Supabase · DashScope</p>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>Engineering knowledge base</p>
            <h1>Ask deployment, API, and incident docs.</h1>
          </div>
          <button type="button"><Upload size={17} /> Upload docs</button>
        </header>

        <section className="ask-card" id="ask">
          <form onSubmit={handleAsk}>
            <label htmlFor="question">Ask a technical question</label>
            <textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button type="submit" disabled={isAsking}>
              <Search size={17} /> {isAsking ? 'Asking' : 'Ask'}
            </button>
          </form>
        </section>

        <section className="answer-card">
          <p>Answer preview</p>
          <article>{answer.answer}</article>
        </section>

        <section className="metrics">
          <div><strong>{metrics.docs}</strong><span>documents</span></div>
          <div><strong>{metrics.chunks}</strong><span>chunks</span></div>
          <div><strong>{status}</strong><span>status</span></div>
        </section>
      </section>

      <aside className="right-panel">
        <section>
          <p>Cited sources</p>
          <div className="source-list">
            {answer.citations.map((citation) => (
              <article key={`${citation.document_id}-${citation.chunk_index}`}>
                <strong>{citation.document_title}</strong>
                <span>{Math.round(citation.similarity * 100)}% match</span>
                <p>{citation.content}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="documents">
          <p>Recent documents</p>
          <div className="doc-list">
            {documents.map((document) => (
              <article key={document.id}>
                <strong>{document.title}</strong>
                <span>{document.file_type} · {document.chunk_count} chunks</span>
              </article>
            ))}
          </div>
        </section>

        <button className="reset-button" type="button">
          <RotateCcw size={15} /> Reset demo data
        </button>
      </aside>
    </main>
  );
}

export default App;
```

- [ ] **Step 2: Create `styles.css`**

Create `/Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend/src/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #f7f6f2;
  color: #171614;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 230px minmax(420px, 1fr) 330px;
}

.sidebar {
  background: #171614;
  color: #f7f6f2;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.sidebar strong {
  display: block;
  font-size: 20px;
}

.sidebar span,
.sidebar p {
  color: #b8b2a8;
  font-size: 12px;
}

.sidebar nav {
  display: grid;
  gap: 8px;
}

.sidebar a {
  color: #d8d1c5;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 12px;
  text-decoration: none;
}

.sidebar a.active {
  background: #2b2925;
  border-left: 3px solid #f0c36a;
  color: white;
}

.workspace {
  padding: 26px 30px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.topbar {
  align-items: flex-start;
  border-bottom: 1px solid #d8d4ca;
  display: flex;
  gap: 20px;
  justify-content: space-between;
  padding-bottom: 20px;
}

.topbar p,
.answer-card > p,
.right-panel > section > p {
  color: #746e64;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
  margin: 0 0 8px;
  text-transform: uppercase;
}

.topbar h1 {
  font-size: clamp(32px, 5vw, 54px);
  line-height: 1;
  margin: 0;
  max-width: 720px;
}

.topbar button,
.ask-card button,
.reset-button {
  align-items: center;
  border: 1px solid #171614;
  display: inline-flex;
  gap: 8px;
  font-weight: 800;
  justify-content: center;
  min-height: 42px;
  padding: 0 14px;
}

.topbar button {
  background: #171614;
  color: white;
}

.ask-card,
.answer-card,
.right-panel article {
  background: white;
  border: 1px solid #d8d4ca;
}

.ask-card {
  padding: 18px;
}

.ask-card form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: end;
}

.ask-card label {
  color: #625c52;
  display: grid;
  font-size: 12px;
  font-weight: 800;
  gap: 9px;
  grid-column: 1 / -1;
  text-transform: uppercase;
}

.ask-card textarea {
  border: 1px solid #c9c3b8;
  min-height: 94px;
  padding: 12px;
  resize: vertical;
}

.ask-card button {
  background: #f0c36a;
  color: #171614;
}

.answer-card {
  padding: 18px;
}

.answer-card article {
  line-height: 1.65;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: auto;
}

.metrics div {
  background: #ede9df;
  border: 1px solid #d8d4ca;
  padding: 14px;
}

.metrics strong,
.metrics span {
  display: block;
}

.metrics span {
  color: #777168;
  font-size: 12px;
  margin-top: 4px;
}

.right-panel {
  background: white;
  border-left: 1px solid #d8d4ca;
  display: grid;
  align-content: start;
  gap: 22px;
  padding: 24px;
}

.source-list,
.doc-list {
  display: grid;
  gap: 10px;
}

.right-panel article {
  padding: 13px;
}

.right-panel article strong,
.right-panel article span {
  display: block;
}

.right-panel article span,
.right-panel article p {
  color: #615c53;
  font-size: 12px;
}

.right-panel article p {
  line-height: 1.5;
}

.reset-button {
  background: white;
  color: #171614;
  width: 100%;
}

@media (max-width: 980px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .sidebar {
    min-height: auto;
  }

  .right-panel {
    border-left: 0;
    border-top: 1px solid #d8d4ca;
  }
}

@media (max-width: 620px) {
  .topbar,
  .ask-card form,
  .metrics {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
```

- [ ] **Step 3: Run frontend tests and build**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 4: Commit**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG
git add frontend
git commit -m "feat: add knowledgeops dashboard"
```

Expected: commit succeeds.

## Task 9: Verification, GitHub, Deployment, and Portfolio Link

**Files:**
- Modify after deployment: `/Users/wangmenglong/Desktop/PrivateChat/src/content.ts`

- [ ] **Step 1: Run backend verification**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/backend
. .venv/bin/activate
pytest -v
```

Expected: all backend tests pass.

- [ ] **Step 2: Run frontend verification**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend
npm test
npm run build
```

Expected: frontend tests and build pass.

- [ ] **Step 3: Create GitHub repo and push**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG
gh repo create wml516518/knowledgeops-rag --public --source . --remote origin --push
```

Expected: GitHub repo exists at `https://github.com/wml516518/knowledgeops-rag`.

- [ ] **Step 4: Create Netlify site and deploy frontend**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend
npx netlify sites:create --name knowledgeops-rag-menglong --account-slug wml565868
npx netlify deploy --prod
```

Expected: frontend deploys to `https://knowledgeops-rag-menglong.netlify.app`.

- [ ] **Step 5: Create Render backend service**

Run:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG
render services create --name knowledgeops-rag-api --type web_service --repo https://github.com/wml516518/knowledgeops-rag --branch main --root-directory backend --runtime python --build-command "pip install -r requirements.txt" --start-command "python run.py" --plan free --health-check-path /api/health --env-var OPENAI_BASE_URL=https://api.deepseek.com --env-var OPENAI_MODEL=deepseek-V4-flash --env-var DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 --env-var DASHSCOPE_EMBEDDING_MODEL=text-embedding-v4 --env-var DASHSCOPE_EMBEDDING_DIMENSIONS=1024 --env-var SUPABASE_STORAGE_BUCKET=knowledgeops-documents --env-var ALLOWED_ORIGINS=https://knowledgeops-rag-menglong.netlify.app --output json --confirm
```

Expected: Render service URL is returned.

- [ ] **Step 6: Configure required Render secrets**

In the Render Dashboard for the new service, add:

```env
OPENAI_API_KEY=<DeepSeek API key>
DASHSCOPE_API_KEY=<DashScope API key>
SUPABASE_URL=<Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service role key>
```

Expected: service redeploys successfully after secrets are saved.

- [ ] **Step 7: Connect Netlify to Render API**

Run after Render URL is known:

```bash
cd /Users/wangmenglong/Desktop/KnowledgeOpsRAG/frontend
npx netlify env:set VITE_API_BASE_URL https://knowledgeops-rag-api.onrender.com
npx netlify deploy --prod
```

Expected: deployed frontend connects to deployed backend.

- [ ] **Step 8: Update portfolio project link**

Modify `/Users/wangmenglong/Desktop/PrivateChat/src/content.ts`:

- Set the Knowledge Base Demo status to `Live frontend` or `Live`.
- Set GitHub URL to `https://github.com/wml516518/knowledgeops-rag`.
- Set live URL to the Netlify production URL.
- Update stack to `React`, `FastAPI`, `Supabase`, `pgvector`, `DashScope`, `Render`, `Netlify`.

- [ ] **Step 9: Verify portfolio and deploy**

Run:

```bash
cd /Users/wangmenglong/Desktop/PrivateChat
npm test
npm run build
git add src/content.ts
git commit -m "feat: link knowledgeops rag"
git push
npx netlify deploy --prod
```

Expected: portfolio deploys and includes the RAG project link.

## Self-Review Checklist

- Spec coverage: upload, parsing, chunking, DashScope embeddings, Supabase pgvector, ask flow, citations, delete, reset, optional file storage, deployment, and portfolio link are covered.
- Optional original-file storage is implemented through `repo.upload_original_file` and stores the resulting path on `documents.storage_path`.
- Public demo safety: file size and chunk count limits are included.
- Deployment dependency: Supabase project and secrets must be configured manually before deployed RAG answers can work.
