---
slug: portfolio-homepage
draft: false
coverImage: ''
date: 2026-06-05
title: 个人主页和公开构建日志
summary: 围绕清晰内容、简单部署和真实开发记录，构建一个中英双语的个人作品入口。
tags:
  - 作品集
  - React
  - Netlify
relatedProject: 个人主页 + 构建日志
---

## 为什么要做这个网站

第一阶段的目标不是构建一个庞大的平台，而是为项目、简历、工程决策和联系方式提供一个稳定、统一的入口。

网站使用 React、Vite 和 TypeScript。个人资料和简历继续用 TypeScript 保存结构化数据，较长的构建日志则使用 Markdown，方便日常编写和审阅。

## 保持简单的几个决定

- 首次访问默认显示英文，并在本地保存用户选择的语言。
- 使用 Netlify 托管静态生产版本。
- 合并代码前由 GitHub Actions 自动运行测试和生产构建。
- 视觉上以清晰排版、细分隔线和克制装饰为主。

这套基础结构能够持续承载真实项目记录，同时避免把个人主页本身变成一个复杂的内容管理项目。
