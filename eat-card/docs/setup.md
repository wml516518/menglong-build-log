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
2. Set the functions directory to `eat-card/api`.
3. Set the publish directory to `eat-card/admin`.
4. Add environment variables.
5. Deploy.

## WeChat

1. Import `eat-card/miniprogram` in WeChat Developer Tools.
2. Copy `env.example.js` to `env.js`.
3. Set `API_BASE_URL` to the Netlify Functions base URL.
4. Configure the deployed HTTPS domain as a request legal domain in WeChat admin.
