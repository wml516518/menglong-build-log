# Setup

## Local Requirements

- Node 18 or newer.
- WeChat Developer Tools.
- Supabase project.
- Netlify site for admin frontend.
- Render Web Service for API backend.

## Environment Variables

Render API backend requires:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_API_TOKEN`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL` (optional, defaults to `deepseek-v4-flash`)
- `DEEPSEEK_BASE_URL` (optional, defaults to `https://api.deepseek.com`)

Netlify admin frontend config uses:

- `EAT_CARD_API_BASE_URL`

Mini program config uses:

- `API_BASE_URL`

## Supabase

1. Open Supabase SQL editor.
2. Run `database/schema.sql`.
3. Run `database/seed.sql`.

## Render API Backend

Preferred Blueprint setup:

1. Push the repository to GitHub.
2. In Render, create a new Blueprint from this repository.
3. Render will read `render.yaml` and create the `eat-card-api` Web Service.
4. Add the secret environment variables when Render asks for them:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_API_TOKEN`
   - `DEEPSEEK_API_KEY`
5. Deploy and confirm `/health` returns `{ "ok": true }`.
6. Confirm the AI endpoint accepts requests only through the Render backend; never put the DeepSeek key in mini program or Netlify frontend files.

Manual Web Service setup, if not using Blueprint:

1. Create a Render Web Service from the GitHub repository.
2. Set root directory to `eat-card`.
3. Set runtime to Node.
4. Set build command to `npm install`.
5. Set start command to `npm start`.
6. Set health check path to `/health`.
7. Add the same environment variables listed above.

## Netlify Admin Frontend

1. Create a Netlify static site.
2. Set the base directory to `eat-card/admin`.
3. Leave the publish directory as `.` or the admin directory itself, depending on the Netlify UI.
4. Copy `eat-card/admin/config.example.js` to `eat-card/admin/config.js`.
5. Set `EAT_CARD_API_BASE_URL` inside `config.js` to your Render API base URL, for example `https://your-render-service.onrender.com/api`.
6. Deploy the static admin site.

## WeChat

1. Import `eat-card/miniprogram` in WeChat Developer Tools.
2. Copy `eat-card/miniprogram/env.example.js` to `eat-card/miniprogram/env.js`.
3. Set `API_BASE_URL` to the Render API base URL, for example `https://your-render-service.onrender.com/api`.
4. Replace the `touristappid` placeholder in `eat-card/miniprogram/project.config.json` with a real AppID before preview, upload, or team use.
5. Configure the deployed Render HTTPS domain as a request legal domain in WeChat admin.

## Local API Testing

Run focused Vitest suites from the repository root:

```bash
npx vitest run eat-card/api-tests
```

For Netlify local development, run from `eat-card/` after installing Netlify CLI:

```bash
netlify dev
```

For Render-style local API development, run from `eat-card/`:

```bash
npm install
npm start
```

Do not install or use paid services without reviewing `docs/costs.md`.
