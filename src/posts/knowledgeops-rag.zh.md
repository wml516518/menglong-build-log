---
slug: knowledgeops-rag
language: zh
date: 2026-06-05
title: KnowledgeOps RAG 文档问答
summary: 围绕上传解析、向量检索和可部署服务边界，构建一个完整的文档问答 Demo。
tags:
  - RAG
  - Python
  - Supabase
relatedProject: KnowledgeOps RAG
---

## 从上传到回答

KnowledgeOps RAG 展示从文档上传到基于资料回答的完整路径。流程包括解析上传内容、生成向量、写入 Supabase pgvector、检索相关段落，并将检索结果提供给回答服务。

React 前端会清晰呈现各个阶段，而不是把整个流程隐藏在单一输入框后面。FastAPI 后端负责解析、检索和 AI 服务接入。

## 部署边界

- Netlify 托管前端。
- Render 托管 FastAPI 服务。
- Supabase 提供 PostgreSQL 与 pgvector 存储。
- 在外部服务尚未全部配置时，Demo 降级能力仍可用于检查界面和主要流程。

整体架构刻意保持清晰，让仓库既能展示产品体验，也能说明背后的检索链路。
