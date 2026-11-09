---
slug: ai-chat-playground
language: zh
date: 2026-06-05
title: 支持模型切换的 AI Chat Playground
summary: 规划一个包含 Prompt 预设、模型控制和轻量 API 边界的可部署聊天界面。
tags:
  - AI
  - 对话
  - FastAPI
relatedProject: AI Chat Playground
---

## 产品方向

AI Chat Playground 的定位是一个用于比较 Prompt 和模型表现的专注环境，而不是再做一个通用聊天产品。

前端负责会话状态、Prompt 预设、模型选择和清晰的流式反馈；轻量 FastAPI 服务将模型凭据保留在浏览器之外，并为后续接入不同模型提供稳定边界。

## 工程重点

- 将模型供应商的具体细节隔离在后端 API 中。
- 让 Prompt 和模型切换对用户清晰可见。
- 当付费模型服务不可用时，前端 Demo 仍然可以展示核心体验。
- 前后端分别通过 Netlify 和 Render 部署。

项目范围被控制在可以完整解释、测试和部署的程度，适合作为一个独立的作品案例。
