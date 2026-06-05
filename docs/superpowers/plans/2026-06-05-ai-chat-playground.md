# AI Chat Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent React + FastAPI AI Chat Playground with OpenAI-compatible streaming chat and Netlify/Render deployment configuration.

**Architecture:** The frontend is a static React app that stores conversation state locally and calls a FastAPI backend. The backend proxies OpenAI-compatible chat completion streaming so API keys stay server-side.

**Tech Stack:** React, Vite, TypeScript, Vitest, Python, FastAPI, pytest, httpx, uvicorn, Netlify, Render.

---

## File Structure

- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/README.md`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/render.yaml`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/backend/requirements.txt`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/backend/.env.example`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/backend/app/main.py`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/backend/app/settings.py`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/backend/app/schemas.py`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/backend/app/openai_client.py`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/backend/tests/test_health.py`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/backend/tests/test_chat_validation.py`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/frontend/package.json`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/frontend/index.html`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/frontend/vite.config.ts`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/frontend/tsconfig.json`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/frontend/src/main.tsx`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/frontend/src/App.tsx`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/frontend/src/App.test.tsx`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/frontend/src/chat.ts`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/frontend/src/presets.ts`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/frontend/src/styles.css`
- Create: `/Users/wangmenglong/Desktop/AIChatPlayground/frontend/netlify.toml`

## Tasks

1. Scaffold independent repository and baseline files.
2. Implement FastAPI settings, schemas, health endpoint, and validation tests.
3. Implement OpenAI-compatible streaming proxy.
4. Implement React chat UI with localStorage persistence and preset/settings controls.
5. Add Netlify and Render deployment configuration.
6. Run backend tests, frontend tests, frontend build, and local smoke checks.
7. Initialize Git and prepare GitHub/Netlify/Render deployment.

## Verification Commands

Backend:

```bash
cd /Users/wangmenglong/Desktop/AIChatPlayground/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
pytest
```

Frontend:

```bash
cd /Users/wangmenglong/Desktop/AIChatPlayground/frontend
npm install
npm test
npm run build
```

Smoke:

```bash
cd /Users/wangmenglong/Desktop/AIChatPlayground/backend
. .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
cd /Users/wangmenglong/Desktop/AIChatPlayground/frontend
npm run dev -- --host 127.0.0.1
```

Expected:

- `/api/health` returns configured model `deepseek-V4-flash`.
- Frontend renders chat UI.
- Sending a message without backend API key produces a friendly backend error, not a frontend crash.
