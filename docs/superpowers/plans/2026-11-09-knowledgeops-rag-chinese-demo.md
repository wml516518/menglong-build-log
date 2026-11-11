# KnowledgeOps RAG Chinese Transparent Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully Chinese public RAG workspace that supports session-isolated document operations, enforces a three-upload limit, and visibly traces real cloud or honest local vector retrieval.

**Architecture:** Introduce a shared response contract for cloud and local-demo RAG, an opaque temporary demo session, and session-scoped document repositories. The backend tries DashScope + Supabase pgvector + DeepSeek first and falls back to a deterministic in-memory vector index; the frontend renders the same Chinese three-column workflow and labels the active mode truthfully.

**Tech Stack:** React 18, TypeScript, Vite 5, FastAPI, Python, Supabase Postgres/pgvector, DashScope embeddings, DeepSeek-compatible chat, Vitest, Testing Library, pytest, Netlify, Render

**Spec:** `/Users/wangmenglong/Desktop/PrivateChat/docs/superpowers/specs/2026-11-09-knowledgeops-rag-chinese-demo-design.md`

## Global Constraints

- Work in `/Users/wangmenglong/Desktop/KnowledgeOpsRAG` on a new `codex/` branch based on latest `origin/main`.
- All page copy, status, errors, sample questions, answers, metadata, and README content must be Chinese.
- Public sample documents are read-only, searchable, and excluded from upload quota.
- Each temporary browser session may own at most 3 uploaded documents; the fourth attempt must show `当前演示最多上传 3 个文件，请先删除已有文件后再上传。` and return `UPLOAD_LIMIT_REACHED` from the backend.
- Delete and reset operations may affect only the current session; public or foreign documents must return 404.
- Cloud mode must use DashScope embeddings, Supabase pgvector retrieval, and DeepSeek-compatible generation.
- Local demo mode must recompute vectors and cosine ranking for each question and must never identify itself as pgvector.
- Both modes must return one trace contract without secrets, raw internal exceptions, service-role tokens, or connection data.
- Upload limits remain 5 MB, 80 chunks, and PDF/TXT/MD/Markdown.
- Frontend and backend tests, production build, desktop/mobile browser flows, two-session isolation, preview deployment, and production smoke tests are required.

---

## File Structure

- `backend/app/schemas.py`: session, document, trace, citation, and error response models.
- `backend/app/demo_sessions.py`: opaque session issuance and expiry validation.
- `backend/app/local_index.py`: deterministic Chinese feature vectors, cosine similarity, session document store, and local traces.
- `backend/app/demo_data.py`: three Chinese public documents and chunks.
- `backend/app/rag.py`: cloud RAG orchestration and trace timing.
- `backend/app/supabase_repo.py`: session-scoped document, slot, vector match, chat, delete, and reset operations.
- `backend/app/main.py`: session-aware endpoints, quota errors, cloud/local fallback, and sanitized public errors.
- `supabase/schema.sql`: demo sessions, document scope/owner/upload slot/expiry, and scoped match RPC.
- `supabase/seed_documents/*.md`: Chinese public sample sources.
- `frontend/src/types.ts`: exact API contract.
- `frontend/src/api.ts`: session header, typed API errors, and session lifecycle.
- `frontend/src/session.ts`: local-storage session persistence and expiry.
- `frontend/src/App.tsx`: Chinese document/question/trace workspace.
- `frontend/src/components/DocumentWorkspace.tsx`: upload count, upload, delete, reset.
- `frontend/src/components/AskWorkspace.tsx`: examples, question, answer, history.
- `frontend/src/components/RagTrace.tsx`: vector/search/match/context/generation stages.
- `frontend/src/styles.css`: responsive three-column operational UI.
- `README.md`, `frontend/index.html`: Chinese docs and metadata.

---

### Task 1: Define Session-Aware API and Trace Contracts

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `frontend/src/types.ts`
- Create: `backend/tests/test_schema_contract.py`

**Interfaces:**
- Produces: matching Python/TypeScript contracts for `DemoSession`, `DocumentSummary`, `AskResponse`, and `RagTrace`.
- Produces: `RagMode = 'cloud' | 'local_demo'`.
- Produces: public document fields `scope` and `deletable`; session documents also have `upload_slot`.

- [ ] **Step 1: Write failing Python contract tests**

Create `backend/tests/test_schema_contract.py`:

```py
from datetime import datetime, timezone

from app.schemas import AskResponse, DemoSession, DocumentSummary, RagTrace


def test_demo_session_and_document_contracts():
    session = DemoSession(
        token="session-token",
        expires_at=datetime(2026, 11, 10, tzinfo=timezone.utc),
        upload_count=2,
        upload_limit=3,
    )
    document = DocumentSummary(
        id="doc-1", title="部署手册", file_name="deploy.md", file_type="md",
        tags=["部署"], status="indexed", chunk_count=2, scope="session",
        deletable=True, upload_slot=2,
    )
    assert session.token == "session-token"
    assert session.expires_at.tzinfo is not None
    assert session.upload_limit == 3
    assert document.scope == "session"
    assert document.deletable is True


def test_ask_response_contains_a_complete_public_trace():
    trace = RagTrace.model_validate({
        "question": {"original": "如何排查部署失败？", "normalized": "如何排查部署失败"},
        "embedding": {"model": "text-embedding-v4", "dimensions": 1024, "preview": [0.1, -0.2], "duration_ms": 12},
        "search": {"backend": "Supabase pgvector", "top_k": 3, "similarity_threshold": 0.2, "duration_ms": 9},
        "matches": [],
        "context": {"character_count": 0, "citation_count": 0, "summary": "未命中上下文"},
        "generation": {"model": "deepseek-V4-flash", "duration_ms": 0},
        "total_duration_ms": 21,
    })
    response = AskResponse(answer="暂无足够资料。", citations=[], mode="cloud", trace=trace)
    assert response.mode == "cloud"
    assert response.trace.embedding.dimensions == 1024
```

- [ ] **Step 2: Run contract tests and confirm RED**

Run: `cd backend && python3 -m pytest tests/test_schema_contract.py -q`

Expected: FAIL because session/trace fields are not defined.

- [ ] **Step 3: Implement Pydantic contracts**

Add these models to `backend/app/schemas.py` using `Literal` and typed nested models:

```py
from datetime import datetime


class DemoSession(BaseModel):
    token: str
    expires_at: datetime
    upload_count: int = Field(ge=0, le=3)
    upload_limit: int = 3

class DocumentSummary(BaseModel):
    id: str
    title: str
    file_name: str
    file_type: str
    tags: list[str] = Field(default_factory=list)
    status: str
    chunk_count: int
    scope: Literal["public", "session"]
    deletable: bool
    upload_slot: int | None = Field(default=None, ge=1, le=3)
    storage_path: str | None = None

class QuestionTrace(BaseModel):
    original: str
    normalized: str

class EmbeddingTrace(BaseModel):
    model: str
    dimensions: int
    preview: list[float]
    duration_ms: int

class SearchTrace(BaseModel):
    backend: str
    top_k: int
    similarity_threshold: float
    duration_ms: int

class MatchTrace(Citation):
    rank: int

class ContextTrace(BaseModel):
    character_count: int
    citation_count: int
    summary: str

class GenerationTrace(BaseModel):
    model: str
    duration_ms: int

class RagTrace(BaseModel):
    question: QuestionTrace
    embedding: EmbeddingTrace
    search: SearchTrace
    matches: list[MatchTrace]
    context: ContextTrace
    generation: GenerationTrace
    total_duration_ms: int

class AskResponse(BaseModel):
    answer: str
    citations: list[Citation]
    mode: Literal["cloud", "local_demo"]
    fallback_reason: str | None = None
    trace: RagTrace
```

- [ ] **Step 4: Mirror the exact types in TypeScript**

Update `frontend/src/types.ts` with `RagMode`, the expanded `DocumentSummary`, nested trace types, and expanded `AskResponse`. Use snake_case for API fields; do not create a second mapping layer. Define the session exactly as:

```ts
export interface DemoSession {
  token: string;
  expires_at: string;
  upload_count: number;
  upload_limit: 3;
}
```

- [ ] **Step 5: Run tests and commit**

Run: `cd backend && python3 -m pytest tests/test_schema_contract.py -q`

Expected: PASS.

```bash
git add backend/app/schemas.py backend/tests/test_schema_contract.py frontend/src/types.ts
git commit -m "feat: define transparent RAG contracts"
```

---

### Task 2: Build the Deterministic Local Vector Demo

**Files:**
- Create: `backend/app/local_index.py`
- Replace: `backend/app/demo_data.py`
- Create: `backend/tests/test_local_index.py`

**Interfaces:**
- Produces: `LocalVectorIndex.create_session()`, `list_documents(session_token)`, `add_document(...)`, `delete_document(...)`, `reset_session(...)`, and `answer_question(...)`.
- Produces: Chinese public documents with immutable scope.
- Uses: deterministic 256-dimension hashed character-bigram vectors and cosine similarity.

- [ ] **Step 1: Write failing local-vector tests**

Create `backend/tests/test_local_index.py` with:

```py
import pytest
from app.local_index import LocalVectorIndex, UploadLimitReached


@pytest.mark.asyncio
async def test_questions_recompute_similarity_and_rank_different_sources():
    index = LocalVectorIndex()
    session = index.create_session()
    deploy = await index.answer_question(session.token, "Render 启动失败应该检查什么？", 3)
    vector = await index.answer_question(session.token, "pgvector 如何计算余弦相似度？", 3)
    assert deploy.mode == "local_demo"
    assert deploy.citations[0].document_title == "Render 部署故障排查手册"
    assert vector.citations[0].document_title == "Supabase pgvector 检索说明"
    assert deploy.trace.embedding.dimensions == 256
    assert deploy.trace.search.backend == "内置演示向量索引"


def test_public_documents_are_visible_and_not_deletable():
    index = LocalVectorIndex()
    session = index.create_session()
    documents = index.list_documents(session.token)
    assert len([item for item in documents if item.scope == "public"]) == 3
    with pytest.raises(KeyError):
        index.delete_document(session.token, documents[0].id)


def test_session_upload_limit_delete_and_reset():
    index = LocalVectorIndex()
    session = index.create_session()
    for number in range(3):
        index.add_document(session.token, f"文档{number}.txt", "txt", [], [f"会话资料 {number}"])
    with pytest.raises(UploadLimitReached):
        index.add_document(session.token, "第四个.txt", "txt", [], ["超出上限"])
    owned = [item for item in index.list_documents(session.token) if item.scope == "session"]
    index.delete_document(session.token, owned[0].id)
    index.add_document(session.token, "替换.txt", "txt", [], ["释放槽位后可上传"])
    index.reset_session(session.token)
    assert not [item for item in index.list_documents(session.token) if item.scope == "session"]
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd backend && python3 -m pytest tests/test_local_index.py -q`

Expected: FAIL because `local_index.py` does not exist.

- [ ] **Step 3: Create Chinese public demo data**

Replace `backend/app/demo_data.py` with three public document definitions. Each contains 2-4 Chinese chunks covering distinctive terms for Render start commands/logs/ports, FastAPI validation/CORS/health endpoints, and Supabase pgvector embeddings/cosine/RPC/topK.

- [ ] **Step 4: Implement deterministic vectors and cosine**

In `backend/app/local_index.py`:

- normalize Unicode text and remove whitespace/punctuation;
- generate single-character and character-bigram tokens;
- hash each token with `hashlib.sha256` into one of 256 dimensions and use one digest bit for sign;
- L2-normalize vectors;
- compute cosine with `sum(left[i] * right[i] for i in range(256))`;
- store public/session documents and chunks in process memory;
- assign the first available slot from 1, 2, 3;
- define `UploadLimitReached` and `SessionNotFound` exceptions;
- build `AskResponse(mode="local_demo")` with sorted matches and complete trace;
- build the answer from the highest-ranked chunks and citation numbers, never from a fixed citation.

- [ ] **Step 5: Run focused tests and commit**

Run: `cd backend && python3 -m pytest tests/test_local_index.py tests/test_chunking.py -q`

Expected: PASS for distinct ranking, public immutability, 3-file limit, delete slot release, and reset.

```bash
git add backend/app/local_index.py backend/app/demo_data.py backend/tests/test_local_index.py
git commit -m "feat: add local Chinese vector demo"
```

---

### Task 3: Add Session Scope and Upload Slots to Supabase

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `backend/app/supabase_repo.py`
- Create: `backend/tests/test_supabase_scope.py`

**Interfaces:**
- Produces: `demo_sessions`, scoped documents, upload slots, expiry, and `match_document_chunks(..., current_session_id)`.
- Produces repository methods that require `session_id` for mutable and private operations.
- Preserves public documents with `scope='public'`, `owner_session_id=null`, `upload_slot=null`.

- [ ] **Step 1: Write repository-scope tests with a fake Supabase client**

Create `backend/tests/test_supabase_scope.py` and use a recording fake client to assert:

```py
import asyncio

import pytest

from app.local_index import UploadLimitReached
from app.supabase_repo import SupabaseRepo


@pytest.mark.asyncio
async def test_match_rpc_receives_current_session_scope():
    session_id = "11111111-1111-4111-8111-111111111111"
    repo = SupabaseRepo(settings, client=fake_client)
    await repo.match_chunks([0.1] * 1024, session_id=session_id, match_count=3, similarity_threshold=0.2)
    assert fake_client.last_rpc == ("match_document_chunks", {
        "query_embedding": [0.1] * 1024,
        "current_session_id": session_id,
        "match_count": 3,
        "similarity_threshold": 0.2,
    })

@pytest.mark.asyncio
async def test_delete_and_reset_include_owner_session_id():
    session_id = "11111111-1111-4111-8111-111111111111"
    repo = SupabaseRepo(settings, client=fake_client)
    await repo.delete_document(session_id, "doc-a")
    await repo.reset_demo(session_id)
    assert fake_client.filters_include("owner_session_id", session_id)

@pytest.mark.asyncio
async def test_four_concurrent_slot_requests_allocate_only_three_slots():
    session_id = "11111111-1111-4111-8111-111111111111"
    repo = SupabaseRepo(settings, client=fake_client)
    results = await asyncio.gather(*[
        repo.reserve_upload_slot(session_id) for _ in range(4)
    ], return_exceptions=True)
    assert sorted(result for result in results if isinstance(result, int)) == [1, 2, 3]
    assert sum(isinstance(result, UploadLimitReached) for result in results) == 1
```

The fake must implement only `rpc`, `table`, `select`, `insert`, `delete`, `eq`, `is_`, `or_`, `order`, and `execute`, and record operations for assertions.

- [ ] **Step 2: Run and confirm RED**

Run: `cd backend && python3 -m pytest tests/test_supabase_scope.py -q`

Expected: FAIL because constructor injection/session arguments are absent.

- [ ] **Step 3: Extend the SQL schema safely**

In `supabase/schema.sql`:

- create `demo_sessions(id uuid primary key, token_hash text unique not null, expires_at timestamptz not null, created_at timestamptz not null default now())`;
- add document columns `scope text not null default 'public' check (scope in ('public', 'session'))`, `owner_session_id uuid references demo_sessions(id) on delete cascade`, `upload_slot smallint check (upload_slot between 1 and 3)`, `expires_at timestamptz`;
- add a partial unique index on `(owner_session_id, upload_slot) where owner_session_id is not null`;
- require `check ((scope = 'public' and owner_session_id is null and upload_slot is null) or (scope = 'session' and owner_session_id is not null and upload_slot is not null))`;
- add `owner_session_id` to chat sessions;
- replace `match_document_chunks` so it accepts `current_session_id uuid` and filters `(documents.scope='public' or documents.owner_session_id=current_session_id)`;
- add a SQL function that atomically assigns the first free upload slot or raises `UPLOAD_LIMIT_REACHED`.
- add `cleanup_expired_demo_sessions()` to delete expired session rows and rely on `on delete cascade` for owned documents/chunks/history; document a daily Supabase Cron invocation.

Use idempotent `alter table ... add column if not exists` and `create or replace function` statements so an existing deployment can apply the file.

- [ ] **Step 4: Scope repository methods**

Update `SupabaseRepo` to accept an optional injected `client`, require session IDs for list/create/delete/reset/match/save methods, call the atomic slot RPC before creating a session document, and return `scope`, `deletable`, and `upload_slot` fields.

Deletion must query/delete with both document ID and owner session. If no row is returned, raise `KeyError` so the API emits 404.

- [ ] **Step 5: Run focused tests and commit**

Run: `cd backend && python3 -m pytest tests/test_supabase_scope.py -q`

Expected: PASS with session ID in every private operation.

```bash
git add supabase/schema.sql backend/app/supabase_repo.py backend/tests/test_supabase_scope.py
git commit -m "feat: scope Supabase demo data by session"
```

---

### Task 4: Add Demo Sessions and Session-Isolated Document APIs

**Files:**
- Create: `backend/app/demo_sessions.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/files.py`
- Create: `backend/tests/test_demo_sessions.py`
- Create: `backend/tests/test_document_api.py`

**Interfaces:**
- Produces: `POST /api/demo-sessions`.
- Consumes: `X-Demo-Session` header on document, ask, delete, and reset endpoints.
- Produces: 409 `{ code: 'UPLOAD_LIMIT_REACHED', message: exact Chinese copy }`.
- Falls back to `LocalVectorIndex` for session document operations when cloud storage is unavailable.

- [ ] **Step 1: Write session and document API tests**

Create `backend/tests/test_demo_sessions.py` and `backend/tests/test_document_api.py` with these assertions:

```py
def create_session(client):
    response = client.post("/api/demo-sessions")
    assert response.status_code == 201
    return response.json()["token"]

def test_two_sessions_cannot_see_or_delete_each_others_uploads(client):
    first = create_session(client)
    second = create_session(client)
    upload = client.post("/api/documents", headers={"X-Demo-Session": first}, files={"file": ("a.txt", b"first private document")})
    document_id = upload.json()["id"]
    assert document_id in [item["id"] for item in client.get("/api/documents", headers={"X-Demo-Session": first}).json()]
    assert document_id not in [item["id"] for item in client.get("/api/documents", headers={"X-Demo-Session": second}).json()]
    assert client.delete(f"/api/documents/{document_id}", headers={"X-Demo-Session": second}).status_code == 404

def test_fourth_upload_is_rejected_and_delete_releases_slot(client):
    session = create_session(client)
    ids = []
    for number in range(3):
        response = client.post("/api/documents", headers={"X-Demo-Session": session}, files={"file": (f"{number}.txt", f"content {number}".encode())})
        assert response.status_code == 200
        ids.append(response.json()["id"])
    fourth = client.post("/api/documents", headers={"X-Demo-Session": session}, files={"file": ("fourth.txt", b"content")})
    assert fourth.status_code == 409
    assert fourth.json()["detail"]["code"] == "UPLOAD_LIMIT_REACHED"
    assert fourth.json()["detail"]["message"] == "当前演示最多上传 3 个文件，请先删除已有文件后再上传。"
    assert client.delete(f"/api/documents/{ids[0]}", headers={"X-Demo-Session": session}).status_code == 204
    assert client.post("/api/documents", headers={"X-Demo-Session": session}, files={"file": ("replacement.txt", b"replacement")}).status_code == 200

def test_reset_only_removes_current_session_documents(client):
    first = create_session(client)
    second = create_session(client)
    first_doc = client.post("/api/documents", headers={"X-Demo-Session": first}, files={"file": ("first.txt", b"first session")}).json()["id"]
    second_doc = client.post("/api/documents", headers={"X-Demo-Session": second}, files={"file": ("second.txt", b"second session")}).json()["id"]
    assert client.post("/api/reset", headers={"X-Demo-Session": first}).status_code == 204
    first_ids = {item["id"] for item in client.get("/api/documents", headers={"X-Demo-Session": first}).json()}
    second_ids = {item["id"] for item in client.get("/api/documents", headers={"X-Demo-Session": second}).json()}
    assert first_doc not in first_ids
    assert second_doc in second_ids

def test_invalid_session_and_file_validation_are_public_errors(client, public_document_id):
    assert client.get("/api/documents").status_code == 401
    assert client.get("/api/documents", headers={"X-Demo-Session": "malformed"}).status_code == 401
    session = create_session(client)
    assert client.delete(f"/api/documents/{public_document_id}", headers={"X-Demo-Session": session}).status_code == 404
    too_large = b"x" * (5 * 1024 * 1024 + 1)
    assert client.post("/api/documents", headers={"X-Demo-Session": session}, files={"file": ("large.txt", too_large)}).status_code == 400
    assert client.post("/api/documents", headers={"X-Demo-Session": session}, files={"file": ("bad.exe", b"text")}).status_code == 400
    assert client.post("/api/documents", headers={"X-Demo-Session": session}, files={"file": ("empty.txt", b"")}).status_code == 400

def test_expired_session_and_chunk_limit(client, expired_token, chunker_81):
    assert client.get("/api/documents", headers={"X-Demo-Session": expired_token}).status_code == 410
    session = create_session(client)
    app.dependency_overrides[get_chunker] = lambda: chunker_81
    response = client.post("/api/documents", headers={"X-Demo-Session": session}, files={"file": ("many.txt", b"valid text")})
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "TOO_MANY_CHUNKS"
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd backend && python3 -m pytest tests/test_demo_sessions.py tests/test_document_api.py -q`

Expected: FAIL because session endpoint/header and local upload support are absent.

- [ ] **Step 3: Implement opaque demo sessions**

In `demo_sessions.py`, issue 32-byte URL-safe tokens with `secrets.token_urlsafe(32)`, store only `sha256(token)` beside an internal UUID in the cloud repository, and return the raw token once. Local sessions use the same token format with an in-memory expiry. Default expiry is 24 hours.

Provide `SessionContext(id: UUID, token: str, expires_at: datetime)` and `resolve_session(token: str) -> SessionContext`. Use `SessionContext.id` for Supabase ownership and RPC filtering, and `SessionContext.token` for the local in-memory index. Reject missing/invalid/expired tokens before mutable operations.

- [ ] **Step 4: Implement session-aware routes and sanitized errors**

Refactor `create_app` to receive optional service/repository factories for tests. Add session header dependency, local index singleton, exact quota error response, scoped list/upload/delete/reset, and cloud-first/local fallback.

Upload order must be: validate size/name/text/chunks, check/reserve slot, embed/store. On failure after reservation, release the slot and avoid a partial document.

- [ ] **Step 5: Run backend API tests and commit**

Run: `cd backend && python3 -m pytest tests/test_demo_sessions.py tests/test_document_api.py tests/test_file_validation.py tests/test_cors.py -q`

Expected: PASS for session creation, isolation, quota, release, reset, validation, and CORS.

```bash
git add backend/app/demo_sessions.py backend/app/main.py backend/app/files.py backend/tests/test_demo_sessions.py backend/tests/test_document_api.py
git commit -m "feat: add isolated public document sessions"
```

---

### Task 5: Trace Cloud RAG and Integrate Honest Fallback

**Files:**
- Modify: `backend/app/rag.py`
- Modify: `backend/app/chat_client.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_rag_flow.py`
- Modify: `backend/tests/test_demo_fallback.py`

**Interfaces:**
- Consumes: expanded schemas and session-scoped repositories.
- Produces: complete `AskResponse` in both `cloud` and `local_demo` modes.
- Produces: sanitized `fallback_reason` values such as `云端向量服务暂不可用，已切换到本地演示检索。`.

- [ ] **Step 1: Expand cloud RAG tests**

Update fake clients to record the query embedding, session ID, topK, threshold, context, and model. Assert:

```py
session_id = "11111111-1111-4111-8111-111111111111"
result = await service.answer_question(session_id, "如何排查 Render 启动失败？", match_count=3)
assert result.mode == "cloud"
assert result.trace.embedding.model == "text-embedding-v4"
assert result.trace.embedding.dimensions == 3
assert result.trace.search.backend == "Supabase pgvector"
assert result.trace.search.top_k == 3
assert result.trace.matches[0].rank == 1
assert result.trace.context.citation_count == 1
assert result.trace.generation.model == "deepseek-V4-flash"
assert result.trace.total_duration_ms >= 0
```

Update fallback tests to ask two distinct Chinese questions and assert different top citations, `mode == 'local_demo'`, nonempty Chinese fallback reason, and no internal exception text.

- [ ] **Step 2: Run and confirm RED**

Run: `cd backend && python3 -m pytest tests/test_rag_flow.py tests/test_demo_fallback.py -q`

Expected: FAIL because existing responses lack mode/trace and fallback is fixed.

- [ ] **Step 3: Instrument cloud RAG**

Use `time.perf_counter()` around normalization, embedding, repository match, context assembly, and generation. Limit embedding preview to the first 8 rounded values. Build ranked `MatchTrace` rows from citations. Pass `session_id` through match and save operations.

Update `ChatClient` system prompt to require Chinese, numbered citations, source-only answers, and an explicit insufficient-context statement.

- [ ] **Step 4: Route failures to local vector RAG**

In `/api/ask`, catch cloud dependency exceptions, log only server-side, call `LocalVectorIndex.answer_question`, set the exact public fallback reason, and return 200. Input/session/validation errors must not be converted to fallback success.

- [ ] **Step 5: Run the backend suite and commit**

Run: `cd backend && python3 -m pytest -q`

Expected: all cloud trace, local ranking, session, document, CORS, validation, and existing tests pass.

```bash
git add backend/app/rag.py backend/app/chat_client.py backend/app/main.py backend/tests/test_rag_flow.py backend/tests/test_demo_fallback.py
git commit -m "feat: expose cloud and local RAG traces"
```

---

### Task 6: Implement Frontend Session and Typed API Client

**Files:**
- Create: `frontend/src/session.ts`
- Modify: `frontend/src/api.ts`
- Create: `frontend/src/api.test.ts`

**Interfaces:**
- Produces: `getOrCreateSession(): Promise<DemoSession>` and `clearStoredSession()`.
- Produces: `withSessionRecovery<T>(operation: (token: string) => Promise<T>): Promise<T>` with at most one retry after a 410 response.
- Produces: `ApiError` with `status`, `code`, and Chinese `message`.
- All private API functions consume an explicit session token and send `X-Demo-Session`.

- [ ] **Step 1: Write failing session/API tests**

Create `frontend/src/api.test.ts` with mocked `fetch` response bodies and direct call assertions:

```ts
it('creates, stores, and reuses an unexpired session token', async () => {
  vi.setSystemTime(new Date('2026-11-09T00:00:00Z'));
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
    token: 'token-a', expires_at: '2026-11-10T00:00:00Z', upload_count: 0, upload_limit: 3
  }, 201));
  vi.stubGlobal('fetch', fetchMock);
  expect((await getOrCreateSession()).token).toBe('token-a');
  expect((await getOrCreateSession()).token).toBe('token-a');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('sends the token on every scoped request', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(jsonResponse([]))
    .mockResolvedValueOnce(jsonResponse(localAnswer))
    .mockResolvedValueOnce(jsonResponse(sessionDocument))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 })));
  await listDocuments('token-a');
  await askQuestion('token-a', '如何检索？');
  await uploadDocument('token-a', new File(['正文'], '资料.txt'), '检索');
  await deleteDocument('token-a', 'doc-a');
  await resetDemoData('token-a');
  for (const [, options] of vi.mocked(fetch).mock.calls) {
    expect(new Headers(options?.headers).get('X-Demo-Session')).toBe('token-a');
  }
});

it('preserves the exact upload-limit error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
    detail: { code: 'UPLOAD_LIMIT_REACHED', message: '当前演示最多上传 3 个文件，请先删除已有文件后再上传。' }
  }, 409)));
  await expect(uploadDocument('token-a', new File(['4'], 'fourth.txt'), '')).rejects.toMatchObject({
    status: 409,
    code: 'UPLOAD_LIMIT_REACHED',
    message: '当前演示最多上传 3 个文件，请先删除已有文件后再上传。'
  });
});
```

Add a 410 test that seeds an expired stored token, returns 410 once, then returns a new session; assert storage is cleared and session creation is retried exactly once.

```ts
it('replaces an expired server session exactly once', async () => {
  localStorage.setItem('knowledgeops-demo-session-v1', JSON.stringify({
    token: 'expired-token', expires_at: '2026-11-10T00:00:00Z', upload_count: 0, upload_limit: 3
  }));
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(jsonResponse({ detail: { code: 'SESSION_EXPIRED', message: '演示会话已过期，请重试。' } }, 410))
    .mockResolvedValueOnce(jsonResponse({ token: 'token-b', expires_at: '2026-11-11T00:00:00Z', upload_count: 0, upload_limit: 3 }, 201))
    .mockResolvedValueOnce(jsonResponse(publicDocuments)));
  await expect(withSessionRecovery(listDocuments)).resolves.toEqual(publicDocuments);
  expect(JSON.parse(localStorage.getItem('knowledgeops-demo-session-v1')!).token).toBe('token-b');
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd frontend && npm test -- --run src/api.test.ts`

Expected: FAIL because session helpers and typed errors do not exist.

- [ ] **Step 3: Implement session storage**

Use storage key `knowledgeops-demo-session-v1`. Store `{ token, expires_at, upload_count, upload_limit }`. Parse dates and recreate if expiry is within 60 seconds. Never log the token.

- [ ] **Step 4: Implement typed API methods**

Provide:

```ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function listDocuments(sessionToken: string): Promise<DocumentSummary[]>;
export function askQuestion(sessionToken: string, question: string): Promise<AskResponse>;
export function uploadDocument(sessionToken: string, file: File, tags: string): Promise<DocumentSummary>;
export function deleteDocument(sessionToken: string, documentId: string): Promise<void>;
export function resetDemoData(sessionToken: string): Promise<void>;
```

Parse FastAPI `detail` whether it is a string or `{ code, message }`. Unknown failures map to `请求失败，请稍后重试。`.

- [ ] **Step 5: Run tests and commit**

Run: `cd frontend && npm test -- --run src/api.test.ts`

Expected: PASS.

```bash
git add frontend/src/session.ts frontend/src/api.ts frontend/src/api.test.ts
git commit -m "feat: add frontend demo session client"
```

---

### Task 7: Build the Chinese Document, Ask, and Trace Workspace

**Files:**
- Create: `frontend/src/components/DocumentWorkspace.tsx`
- Create: `frontend/src/components/AskWorkspace.tsx`
- Create: `frontend/src/components/RagTrace.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Replace: `frontend/src/mockData.ts`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Consumes: session/API client and expanded response types.
- Produces: three-column Chinese workspace with mobile views.
- Enforces: frontend 3-file selection guard before network upload.

- [ ] **Step 1: Write failing Chinese workspace tests**

Mock the API module, not `fetch`, and add direct Testing Library assertions such as:

```ts
it('blocks a fourth upload locally and frees a slot after delete', async () => {
  vi.mocked(api.listDocuments)
    .mockResolvedValueOnce([...publicDocuments, ...ownedDocuments])
    .mockResolvedValueOnce([...publicDocuments, ...ownedDocuments.slice(1)]);
  render(<App />);
  expect(await screen.findByText('已上传 3/3')).toBeInTheDocument();
  await userEvent.upload(screen.getByLabelText('选择文档'), new File(['4'], 'fourth.txt'));
  expect(screen.getByRole('alert')).toHaveTextContent('当前演示最多上传 3 个文件，请先删除已有文件后再上传。');
  expect(api.uploadDocument).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: '删除 文档一' }));
  expect(await screen.findByText('已上传 2/3')).toBeInTheDocument();
  await userEvent.upload(screen.getByLabelText('选择文档'), new File(['new'], 'replacement.txt'));
  await userEvent.click(screen.getByRole('button', { name: '上传文档' }));
  expect(api.uploadDocument).toHaveBeenCalledTimes(1);
});

it('renders the honest local retrieval trace and restores it from history', async () => {
  vi.mocked(api.askQuestion).mockResolvedValue(localAnswer);
  render(<App />);
  await userEvent.type(screen.getByLabelText('问题'), 'pgvector 如何检索？');
  await userEvent.click(screen.getByRole('button', { name: '开始检索' }));
  expect(await screen.findByText('本地演示检索')).toBeInTheDocument();
  expect(screen.getByText('256 维')).toBeInTheDocument();
  expect(screen.getByText('内置演示向量索引')).toBeInTheDocument();
  expect(screen.getByText(localAnswer.fallback_reason!)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '查看历史：pgvector 如何检索？' }));
  expect(screen.getByText(localAnswer.answer)).toBeInTheDocument();
});

it('shows cloud mode and links citations to the ranked chunk', async () => {
  vi.mocked(api.askQuestion).mockResolvedValue(cloudAnswer);
  render(<App />);
  await userEvent.type(screen.getByLabelText('问题'), '如何排查部署失败？');
  await userEvent.click(screen.getByRole('button', { name: '开始检索' }));
  expect(await screen.findByText('云端 RAG')).toBeInTheDocument();
  expect(screen.getByText('Supabase pgvector')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '引用 1' }));
  expect(document.activeElement).toHaveAttribute('id', 'trace-match-doc-1-0');
});
```

Complete the same file with explicit public/reset/trace assertions:

```ts
it('keeps public samples read-only and resets only current-session data', async () => {
  vi.mocked(api.listDocuments)
    .mockResolvedValueOnce([...publicDocuments, ownedDocuments[0]])
    .mockResolvedValueOnce(publicDocuments);
  render(<App />);
  for (const title of ['Render 部署故障排查手册', 'FastAPI 接口开发指南', 'Supabase pgvector 检索说明']) {
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `删除 ${title}` })).not.toBeInTheDocument();
  }
  await userEvent.click(screen.getByRole('button', { name: '重置演示数据' }));
  expect(screen.getByRole('dialog')).toHaveTextContent('仅清除当前浏览器会话');
  await userEvent.click(screen.getByRole('button', { name: '确认重置' }));
  expect(api.resetDemoData).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('已上传 0/3')).toBeInTheDocument();
});

it('renders all stages and descending match scores', async () => {
  vi.mocked(api.askQuestion).mockResolvedValue(localAnswer);
  render(<App />);
  await userEvent.type(screen.getByLabelText('问题'), '向量检索如何工作？');
  await userEvent.click(screen.getByRole('button', { name: '开始检索' }));
  for (const stage of ['问题处理', '向量化', '相似度检索', '命中文档', '上下文构建', '回答生成']) {
    expect(await screen.findByRole('heading', { name: stage })).toBeInTheDocument();
  }
  const scores = screen.getAllByTestId('match-score').map((node) => Number(node.textContent?.replace('%', '')));
  expect(scores).toEqual([...scores].sort((left, right) => right - left));
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd frontend && npm test -- --run src/App.test.tsx`

Expected: FAIL because the current workspace is English and lacks trace/quota/session UI.

- [ ] **Step 3: Build focused components**

`DocumentWorkspace` receives documents, `uploadCount`, `uploadLimit`, and action callbacks. It renders public and session sections, keeps the file selector actionable so a fourth attempt can show the required message, guards both selection and submission at 3 with exact copy, and marks public rows non-deletable.

`AskWorkspace` receives question/answer/history and action callbacks. Use these example questions:

- `Render 构建成功但服务启动失败时，应该先检查什么？`
- `FastAPI 如何处理请求参数校验和跨域？`
- `Supabase pgvector 如何根据问题找到相似文档片段？`

`RagTrace` renders the six specified stages and match elements with stable IDs `trace-match-${document_id}-${chunk_index}` for answer citation links.

- [ ] **Step 4: Refactor App into orchestration only**

`App` creates/restores a session, refreshes documents, owns history, coordinates API calls, shows Chinese mode and quota status, and passes focused props to the three components. It must not contain duplicate document/trace rendering logic.

Replace English fallback mocks with complete Chinese cloud/local response fixtures matching `AskResponse`.

- [ ] **Step 5: Implement operational responsive styling**

Desktop: `230px minmax(440px, 1fr) minmax(320px, 380px)`. Mobile below 900px: one column with a compact view switch. Use max 8px radii, no cards inside cards, stable progress/match dimensions, `min-width: 0`, visible focus, `overflow-wrap`, and reduced-motion media query.

- [ ] **Step 6: Run frontend tests/build and commit**

Run:

```bash
cd frontend && npm test -- --run
npm run build
```

Expected: all Chinese workspace, quota, mode, trace, citation, history, and API tests pass; build exits 0.

```bash
git add frontend/src/components frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/mockData.ts frontend/src/styles.css
git commit -m "feat: build Chinese transparent RAG workspace"
```

---

### Task 8: Finish Chinese Metadata, Samples, Documentation, and End-to-End Verification

**Files:**
- Modify: `frontend/index.html`
- Replace: `supabase/seed_documents/render-deploy-runbook.md`
- Replace: `supabase/seed_documents/fastapi-api-guide.md`
- Replace: `supabase/seed_documents/supabase-vector-notes.md`
- Modify: `README.md`
- Verify: all backend/frontend/deployment files

**Interfaces:**
- Produces: Chinese metadata, source documents, and repository instructions.
- Produces: browser and deployment evidence for public operations and both RAG modes.

- [ ] **Step 1: Update exact page metadata**

Set:

```html
<html lang="zh-CN">
<meta name="description" content="一个可上传文档并展示问题向量化、相似度检索、上下文构建和引用回答过程的中文 RAG 演示。" />
<title>KnowledgeOps RAG｜向量检索知识库演示</title>
```

- [ ] **Step 2: Replace seed documents with useful Chinese sources**

Write 400-800 Chinese characters per document with headings and concrete procedures. Ensure each source includes the terms needed by the three example questions and no secrets or environment-specific credentials.

- [ ] **Step 3: Rewrite README in Chinese**

Document architecture, cloud/local mode distinction, three-file/session limit, 24-hour ephemeral scope, supported files, upload/delete/reset behavior, trace fields, Supabase migration/seed steps, environment variables, local commands, tests, Netlify/Render deployment, and security boundaries.

- [ ] **Step 4: Run fresh full verification**

Run:

```bash
cd backend && python3 -m pytest -q
cd ../frontend && npm test -- --run && npm run build
git diff --check
```

Expected: all commands exit 0 with no application warnings.

- [ ] **Step 5: Run local end-to-end browser tests**

Use Playwright at 1440×900 and 390×844. Execute:

1. create session A;
2. upload three unique TXT/MD files;
3. attempt fourth and verify exact limit message and no document added;
4. ask a question that ranks one uploaded file first and inspect all six trace stages;
5. delete one document, upload a replacement, and confirm `3/3`;
6. create isolated browser session B and confirm A's uploads are invisible;
7. reset A and confirm public samples remain while A uploads/history clear;
8. force cloud fakes for cloud-mode UI and disable cloud dependencies for local-mode UI;
9. check citations, keyboard access, mobile layout, console errors, unexpected 404s, and horizontal overflow.

Capture named screenshots for desktop cloud/local trace, quota error, isolation, and mobile.

- [ ] **Step 6: Commit final documentation and sample data**

```bash
git add frontend/index.html supabase/seed_documents README.md
git commit -m "docs: finish Chinese RAG demo"
```

- [ ] **Step 7: Push, open PR, and validate preview deployment**

Push the feature branch, open a Pull Request against `main`, attach it to the task, and wait for GitHub CI. Validate Netlify Deploy Preview against the preview/API CORS origin and verify Render health.

If Supabase migration or secrets are not configured in production, keep the page in clearly labeled local-demo mode; report the missing external configuration rather than claiming cloud pgvector success. After explicit merge authorization, run production smoke tests for Chinese question/trace, 3-file quota, delete/reset, and session isolation.
