# KnowledgeOps RAG Design

## Summary

KnowledgeOps RAG is a public technical-team knowledge base demo. It lets visitors upload PDF, TXT, and Markdown documents, index them into a Supabase pgvector store, and ask questions against the indexed knowledge base.

The project is intended for MengLong Wang's portfolio. It should feel like a small SaaS console rather than a toy demo: clean sidebar navigation, a focused ask workspace, visible document indexing status, answer citations, and simple data cleanup controls.

## Product Scope

### In Scope

- Public demo with no login.
- Console dashboard layout with sidebar navigation.
- Upload PDF, TXT, and Markdown files.
- Optional "save original file" mode using Supabase Storage.
- Parse uploaded files into plain text.
- Split text into chunks suitable for retrieval.
- Generate embeddings with DashScope `text-embedding-v4`.
- Store metadata and chunks in Supabase Postgres with pgvector.
- Ask questions against indexed documents.
- Return answer text plus cited source chunks.
- Save recent question history.
- Delete a single document, including chunks and optional stored file.
- Reset demo data, including documents, chunks, and chat history.
- Seed 2-3 example technical-team documents.

### Out of Scope

- Authentication.
- Multi-tenant workspaces.
- Role-based permissions.
- Billing.
- Long-term production data retention.
- Render-hosted database storage.
- Persistent local file storage on Render.
- Complex admin console.

## User Experience

The main interface uses the approved Console Dashboard direction:

- Left sidebar: product name, navigation, stack labels.
- Main area: page heading, upload action, ask form, answer panel, document metrics.
- Right panel: cited sources, index status, recent documents.
- Documents page: upload area, document table, tags, status, chunk count, delete action.
- History page: recent questions with answers and citations.

The visual language should be restrained and product-like: dense enough for an operations tool, but still polished for a portfolio viewer. Avoid marketing hero layouts; the first screen should be the usable application.

## Architecture

```text
Netlify
React + Vite + TypeScript frontend

Render
Python FastAPI backend

Supabase
Postgres + pgvector
Optional Supabase Storage for original files

DeepSeek / OpenAI-compatible chat API
Default model: deepseek-V4-flash

DashScope embedding API
Embedding model: text-embedding-v4
Embedding dimensions: 1024
```

## Backend Responsibilities

The FastAPI backend owns all privileged operations and external API calls:

- Validate uploaded files.
- Extract text from PDF, TXT, and Markdown.
- Split text into chunks.
- Call DashScope embeddings API.
- Insert documents and chunks into Supabase.
- Call Supabase RPC for vector search.
- Call the chat completion API for final answers.
- Store chat history.
- Delete documents and reset demo data.

The frontend must never receive Supabase service keys, DashScope keys, or chat API keys.

## Frontend Responsibilities

The React frontend owns application state and user interaction:

- Dashboard metrics and status.
- File upload form.
- Optional save-original-file toggle.
- Document list and filters.
- Ask workspace.
- Citation rendering.
- Recent history display.
- Delete and reset confirmation flows.
- Error and loading states.

## Data Model

### `documents`

- `id uuid primary key`
- `title text`
- `file_name text`
- `file_type text`
- `tags text[]`
- `status text`
- `chunk_count integer`
- `storage_path text null`
- `created_at timestamptz`
- `updated_at timestamptz`

### `document_chunks`

- `id uuid primary key`
- `document_id uuid references documents(id) on delete cascade`
- `content text`
- `chunk_index integer`
- `token_estimate integer`
- `embedding vector(1024)`
- `created_at timestamptz`

### `chat_sessions`

- `id uuid primary key`
- `title text`
- `created_at timestamptz`

### `chat_messages`

- `id uuid primary key`
- `session_id uuid references chat_sessions(id) on delete cascade`
- `role text`
- `content text`
- `citations jsonb`
- `created_at timestamptz`

## Supabase RPC

Create a `match_document_chunks` SQL function that accepts:

- query embedding vector
- match count
- similarity threshold

It returns:

- chunk id
- document id
- document title
- content
- similarity score
- chunk index

The backend calls this RPC during question answering.

## File Handling

Supported file types:

- `.pdf`
- `.txt`
- `.md`
- `.markdown`

Default behavior:

- Parse and index the file.
- Do not store the original file.

Optional behavior:

- If the user enables "save original file", upload the raw file to Supabase Storage and store the path on `documents.storage_path`.

Limits for the public demo:

- Single file size limit: 5 MB.
- Accepted MIME/type checks on the backend.
- Reasonable chunk cap per document to protect free-tier quotas.

## RAG Flow

### Indexing

```text
Upload file
-> Extract text
-> Normalize text
-> Split into chunks
-> Generate embeddings with DashScope
-> Insert document metadata
-> Insert chunks and vectors
-> Return indexed document summary
```

### Question Answering

```text
Question
-> Generate question embedding with DashScope
-> Retrieve top chunks from Supabase pgvector
-> Build grounded prompt with citations
-> Call DeepSeek-compatible chat completion
-> Save user and assistant messages
-> Return answer plus citations
```

## Environment Variables

Backend:

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

ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Frontend:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Deployment

- Frontend deploys to Netlify free tier.
- Backend deploys to Render free web service.
- Database and optional file storage use Supabase free tier.
- The project should be created as a separate GitHub repository and linked from the existing portfolio homepage after deployment.

## Error Handling

- Show clear upload validation errors for unsupported file types and oversized files.
- Show indexing failures per document status.
- If no chunks match a question, return a friendly "not enough context" answer.
- If API keys are missing, return a clear backend configuration error.
- Protect destructive actions with confirmations.
- Reset demo data should be explicit and not hidden behind a small accidental button.

## Testing

Backend:

- Health endpoint.
- File type validation.
- Text chunking.
- Embedding client request formatting with mocks.
- Supabase repository behavior with mocks.
- RAG answer flow with mocked retrieval and chat API.
- Delete/reset behavior.

Frontend:

- App renders main dashboard.
- Upload form validation states.
- Document list renders statuses.
- Ask flow renders answer and citations.
- Delete/reset confirmations.

Manual verification:

- Local backend health.
- Local frontend render.
- Upload a sample Markdown/TXT file.
- Ask a question and see citations.
- Verify deployed Netlify frontend connects to Render backend.

## Open Decisions Resolved

- Scenario: technical-team knowledge base.
- Layout: refined Console Dashboard.
- Upload support: PDF, TXT, Markdown.
- Visibility: public demo, no login.
- Vector store: Supabase Postgres + pgvector.
- Chat model: DeepSeek-compatible `deepseek-V4-flash`.
- Embedding model: DashScope `text-embedding-v4`, 1024 dimensions.
- Original files: optional Supabase Storage.
- Cleanup: both delete document and reset demo data.
