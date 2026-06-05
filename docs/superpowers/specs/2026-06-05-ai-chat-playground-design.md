# AI Chat Playground Design

Date: 2026-06-05

## Goal

Build an independent full-stack AI Chat Playground project that demonstrates React frontend engineering, Python FastAPI backend API design, OpenAI-compatible model integration, and free-tier deployment to Netlify and Render.

## Repository

The project should live in a separate GitHub repository:

- Repository name: `ai-chat-playground`
- Local project directory: `/Users/wangmenglong/Desktop/AIChatPlayground`

This keeps the personal homepage lightweight and lets the AI project stand alone as a portfolio item.

## Technology

- Frontend: React, Vite, TypeScript
- Backend: Python, FastAPI
- Model API: OpenAI-compatible Chat Completions
- Frontend deployment: Netlify Free
- Backend deployment: Render Free

## Default Model Configuration

Use OpenAI-compatible environment variables:

```env
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-V4-flash
ALLOWED_ORIGINS=
```

The backend should not hard-code API keys. The frontend must never receive the model API key.

## Directory Structure

```text
ai-chat-playground/
  frontend/
  backend/
  docs/
  README.md
  render.yaml
```

## Frontend Features

- Chat interface with user and assistant messages
- Streaming assistant response display
- Prompt preset selector
- Temperature control
- Max token control
- Clear conversation action
- Local conversation persistence using `localStorage`
- API health indicator
- API base URL configured through `VITE_API_BASE_URL`

## Backend Features

- `GET /api/health`
- `POST /api/chat`
- Server-sent event streaming response
- OpenAI-compatible request format
- CORS controlled by `ALLOWED_ORIGINS`
- Environment-based model configuration
- Friendly error responses when the model API key is missing or upstream API fails

## Prompt Presets

Initial presets:

- General Assistant
- Code Reviewer
- Resume Optimizer
- Product Brainstormer

## Deployment

### Netlify

- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `frontend/dist`

### Render

- Service type: Web Service
- Runtime: Python
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## Personal Homepage Integration

After deploying this project:

- Update the personal homepage `Projects` section.
- Add GitHub link: `https://github.com/wml516518/ai-chat-playground`
- Add Netlify frontend demo link.
- Mention that the backend is hosted on Render.

## Non-Goals For V1

- User accounts
- Database persistence
- Billing
- Team collaboration
- File upload
- RAG document search

These can become later portfolio projects.
