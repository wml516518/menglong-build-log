---
slug: portfolio-homepage
draft: false
coverImage: ''
date: 2026-06-05
title: Portfolio homepage and public build log
summary: Building a bilingual portfolio around clear content, simple deployment, and an honest public record of the work.
tags:
  - Portfolio
  - React
  - Netlify
relatedProject: Personal Homepage + Build Log
---

## Why this site exists

The first goal was not to build a large platform. It was to create one dependable place for my projects, resume, engineering decisions, and contact information.

The site uses React, Vite, and TypeScript. Profile and resume data remain structured in TypeScript, while longer Build Log entries live in Markdown so they are easier to write and review.

## Decisions that kept it simple

- English is the first-visit default and the selected language is stored locally.
- Netlify serves the production build as a static site.
- GitHub Actions runs tests and a production build before changes are merged.
- The visual system uses strong typography, thin rules, and limited decoration.

This foundation leaves room for real project notes without turning the homepage into a content management project of its own.
