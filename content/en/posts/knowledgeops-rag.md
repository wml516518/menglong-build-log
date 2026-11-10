---
_translation:
  policyVersion: 1
  sourceHash: 83808c888610eecd2085436de96135e1eaf0208aefce124863a10942ef9ac06f
coverImage: ''
date: '2026-06-05'
draft: false
relatedProject: KnowledgeOps RAG
slug: knowledgeops-rag
summary: 'Structuring a document Q&A demo around upload parsing, vector retrieval, and deployable service boundaries.'
tags:
  - RAG
  - Python
  - Supabase
title: KnowledgeOps RAG document Q&A
---

## From upload to answer

KnowledgeOps RAG demonstrates the complete path from a document upload to a grounded answer. The planned flow parses uploaded content, creates embeddings, stores vectors in Supabase pgvector, retrieves relevant passages, and supplies them to the answer service.

The React frontend makes each stage understandable instead of hiding the workflow behind one input box. The FastAPI backend owns parsing, retrieval, and AI provider integration.

## Deployment boundaries

- Netlify hosts the frontend.
- Render hosts the FastAPI service.
- Supabase provides PostgreSQL and pgvector storage.
- A demo fallback keeps the interface reviewable before every external service is configured.

The architecture is deliberately explicit so the repository can show both the product experience and the retrieval pipeline behind it.
