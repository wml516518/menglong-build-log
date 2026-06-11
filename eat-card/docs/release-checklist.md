# Release Checklist

- Supabase schema is applied.
- Seed recipes are inserted.
- Render environment variables are configured.
- Render API responds from `/health`.
- Admin UI can create and publish a recipe.
- WeChat request legal domain is configured.
- Mini program points to deployed `API_BASE_URL`.
- Simulator smoke test passes.
- Real-device preview smoke test passes.
- Experience version is uploaded.
- Cost triggers in `docs/costs.md` are reviewed.
- Privacy/about page text is present.

## Before Submitting To WeChat Review

- Confirm the request domain works on a real device.
- Confirm no Supabase service key appears in mini program source.
- Confirm admin token is not committed.
- Confirm `eat-card/admin/config.js` does not contain secrets; it should only contain the public Render API base URL.
- Confirm the app category does not require paid verification for the current MVP.
