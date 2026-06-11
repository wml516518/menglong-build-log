# 今天吃什么卡

Native WeChat Mini Program MVP for drawing a meal card by budget, cook time, servings, taste tags, and optional DeepSeek AI generation.

## Apps

- `miniprogram/`: native WeChat Mini Program.
- `api/`: reusable serverless-style handlers.
- `server/`: Render Express API wrapper.
- `admin/`: static admin UI for recipe management, deployable on Netlify.
- `database/`: Supabase schema and seed SQL.
- `docs/`: setup, cost, testing, and release notes.

## MVP Limits

- No WeChat Pay.
- No paid recipe packs.
- No user account system.
- No file or image upload.

## Cost Rule

Before enabling any paid resource, payment capability, custom domain, AI API, object storage, or production upgrade, stop and review `docs/costs.md`.
