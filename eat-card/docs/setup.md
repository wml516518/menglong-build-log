# Setup

## Local Requirements

- Node 18 or newer.
- WeChat Developer Tools.
- Supabase project.
- Netlify site.

## Environment Variables

Netlify Functions require:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_API_TOKEN`

Mini program config uses:

- `API_BASE_URL`

## Supabase

1. Open Supabase SQL editor.
2. Run `database/schema.sql`.
3. Run `database/seed.sql`.

## Netlify

1. Create a Netlify site.
2. Set the base directory to `eat-card`.
3. Set the publish directory to `admin`.
4. Set the functions directory to `api`.
5. If deploying from the repo root without a base directory, use publish directory `eat-card/admin` and functions directory `eat-card/api`.
6. Add environment variables.
7. Deploy.

## WeChat

1. Import `eat-card/miniprogram` in WeChat Developer Tools.
2. Copy `eat-card/miniprogram/env.example.js` to `eat-card/miniprogram/env.js`.
3. Set `API_BASE_URL` to the Netlify Functions base URL.
4. Replace the `touristappid` placeholder in `eat-card/miniprogram/project.config.json` with a real AppID before preview, upload, or team use.
5. Configure the deployed HTTPS domain as a request legal domain in WeChat admin.
