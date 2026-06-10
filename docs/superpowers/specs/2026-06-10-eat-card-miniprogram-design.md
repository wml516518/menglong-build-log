# 今天吃什么卡小程序设计

## Goal

Build a native WeChat Mini Program MVP for "今天吃什么卡". The app helps users pick a meal by budget, cooking time, servings, and taste tags, then shows a recipe card with ingredients and steps.

The goal is to learn the full mini program workflow: native mini program development, API integration, Supabase database setup, Netlify deployment, admin content management, testing, preview, and release.

## Scope

### In Scope

- Native WeChat Mini Program frontend.
- Netlify Functions API layer.
- Supabase PostgreSQL database.
- Netlify-hosted admin site for recipe management.
- Recipe random draw by filters.
- Recipe detail page.
- Local-only favorites in mini program storage.
- Shareable recipe card behavior using WeChat share APIs.
- Manual test checklist for mini program.
- Basic API tests for Netlify Functions.
- Deployment and release documentation.
- Cost trigger checklist before enabling paid resources.

### Out of Scope For MVP

- AI-generated recipes.
- WeChat Pay.
- Paid recipe packs.
- User account system.
- Cloud file/image upload.
- Supabase Storage.
- Complex recommendation ranking.
- Push notifications or subscription messages.

## Architecture

```text
eat-card/
  miniprogram/
    Native WeChat Mini Program

  admin/
    Netlify-hosted static admin UI

  api/
    Netlify Functions

  docs/
    Setup, costs, tests, and release notes
```

Runtime data flow:

```text
WeChat Mini Program
  -> Netlify Functions API
    -> Supabase database

Netlify Admin UI
  -> Netlify Functions API
    -> Supabase database
```

The mini program does not connect directly to Supabase. Netlify Functions hide Supabase credentials, validate input, normalize response shapes, and provide a single request domain for WeChat configuration.

## Platform Choices

### Mini Program

Use native WeChat Mini Program pages, components, WXML, WXSS, and JavaScript.

Reason: the primary learning goal is the real mini program development, preview, upload, audit, and release workflow.

### API

Use Netlify Functions for the MVP.

Reason: the admin site and API can deploy together on Netlify, and the user already uses Netlify. This keeps deployment simple while still teaching a real serverless API layer.

### Database

Use Supabase PostgreSQL.

Reason: Supabase gives a real relational database, dashboard, SQL editor, environment variables, and a clear upgrade path for user accounts and permissions later.

## Mini Program Pages

### Home / Draw Page

Purpose: let the user quickly draw a meal card.

Controls:

- Budget selector: examples `10元以内`, `20元以内`, `40元以内`, `不限`.
- Cooking time selector: examples `10分钟`, `15分钟`, `30分钟`, `不限`.
- Servings selector: examples `一人食`, `两人`, `多人`.
- Taste/tag selector: examples `清淡`, `下饭`, `减脂`, `宿舍`, `懒人`.
- Draw button.

Result:

- Displays one recipe card returned by `GET /.netlify/functions/recipes-random`.
- Shows title, description, budget, cook time, servings, tags, and quick actions.

Error states:

- API failure: show retry message.
- No matching recipe: ask user to loosen filters.
- Loading: show stable loading state without layout shift.

### Recipe Detail Page

Purpose: show the chosen recipe in enough detail to cook.

Content:

- Title.
- Description.
- Budget.
- Cook time.
- Servings.
- Difficulty.
- Tags.
- Ingredient list.
- Step list.
- Tips.

Actions:

- Favorite or unfavorite.
- Share.
- Draw another recipe with same filters.

### Favorites Page

Purpose: let users revisit saved recipes.

Storage:

- Store favorite recipe IDs and compact card snapshots in WeChat local storage.
- Do not require login in MVP.

Behavior:

- List saved recipes.
- Open recipe detail.
- Remove favorite.
- Show empty state when there are no favorites.

### About / Settings Page

Purpose: provide product context and future extensibility.

Content:

- App version.
- Short data/source note.
- Feedback placeholder.
- Privacy note explaining that MVP favorites are stored locally.

## Admin Site

### Admin Login

MVP uses a simple admin token checked by Netlify Functions.

The admin UI asks for this token and sends it in an `x-admin-token` header. The token value is stored in Netlify environment variables and is never committed to the repository. The design intentionally avoids public registration. Only the developer/admin edits recipes.

### Recipe List

Features:

- Search recipes by title.
- Filter by status.
- Filter by tag.
- Show budget, cook time, servings, and status.
- Open edit form.
- Toggle `draft` / `published`.

### Recipe Edit Form

Fields:

- Title.
- Description.
- Budget in cents.
- Cook minutes.
- Servings.
- Difficulty.
- Tags.
- Ingredients.
- Steps.
- Tips.
- Status.

Validation:

- Title is required.
- At least one ingredient is required.
- At least one step is required.
- Budget and cook minutes must be non-negative numbers.
- Status must be `draft` or `published`.

## Database Design

### `recipes`

```text
id uuid primary key
title text not null
description text not null default ''
budget_cents integer not null default 0
cook_minutes integer not null default 0
servings integer not null default 1
difficulty text not null default 'easy'
tags text[] not null default '{}'
ingredients jsonb not null default '[]'
steps jsonb not null default '[]'
tips text not null default ''
status text not null default 'draft'
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

Constraints:

- `status` must be `draft` or `published`.
- `difficulty` should use `easy`, `normal`, or `hard`.
- Public recipe APIs only return `published` recipes.

### `tags`

```text
id uuid primary key
name text not null unique
type text not null
sort_order integer not null default 0
created_at timestamptz not null default now()
```

Tag types:

- `taste`
- `scenario`
- `diet`
- `tool`

### `admin_users`

```text
id uuid primary key
email text not null unique
role text not null default 'admin'
created_at timestamptz not null default now()
```

MVP may not need a full admin user login flow. This table exists so the schema can later support Supabase Auth or a proper admin permission model without redesigning the database.

## API Design

Base path depends on Netlify deployment:

```text
https://<site>.netlify.app/.netlify/functions
```

### `GET /recipes-random`

Query parameters:

- `maxBudgetCents`
- `maxCookMinutes`
- `servings`
- `tags`

Behavior:

- Filters `published` recipes.
- Applies budget, cook time, servings, and tag filters when provided.
- Selects one random result.
- Returns `404` with a clear message when there is no match.

Response:

```json
{
  "recipe": {
    "id": "uuid",
    "title": "番茄肥牛饭",
    "description": "15分钟的一人食下饭菜",
    "budgetCents": 2000,
    "cookMinutes": 15,
    "servings": 1,
    "difficulty": "easy",
    "tags": ["一人食", "下饭"],
    "tips": "肥牛可换成鸡蛋"
  }
}
```

### `GET /recipes-detail`

Query parameters:

- `id`

Behavior:

- Returns a single published recipe by ID.
- Returns `404` if the recipe does not exist or is not published.

### `GET /tags`

Behavior:

- Returns tags sorted by `type` and `sort_order`.

### `POST /admin-recipes`

Purpose:

- Create or update recipes from the admin site.

Auth:

- Requires an admin token in an HTTP header.
- The token is stored in Netlify environment variables.

Behavior:

- Validates input.
- Creates a new recipe if `id` is absent.
- Updates the existing recipe if `id` is present.
- Returns validation errors with field names.

### `POST /admin-recipes-status`

Purpose:

- Toggle recipe status between `draft` and `published`.

Auth:

- Requires admin token.

## Security

- Supabase service role key must only exist in Netlify environment variables.
- Mini program must never contain Supabase service keys.
- Admin endpoints require a server-side admin token.
- Public APIs only expose `published` recipes.
- API validates numeric query values to prevent malformed database queries.
- CORS allows the deployed admin origin and mini program requests.

## Costs And Paid Resource Triggers

MVP is designed to stay within free tiers when traffic and data are small, but no provider free tier should be treated as guaranteed forever.

### Supabase

Used for:

- PostgreSQL database.
- Recipe and tag records.

Not used in MVP:

- Supabase Storage.
- Supabase Edge Functions.
- Supabase Auth for public users.

Possible cost triggers:

- Database size grows beyond the free plan.
- API traffic or bandwidth exceeds plan limits.
- Project needs higher availability or production features.
- More active projects are needed than the account plan allows.

### Netlify

Used for:

- Admin static site.
- Netlify Functions API.
- Environment variables.

Possible cost triggers:

- Build minutes exceed the free tier.
- Bandwidth exceeds the free tier.
- Function invocation count or runtime exceeds the free tier.
- Team/collaboration features are needed.
- Custom domain or advanced deployment features are added.

### WeChat Mini Program

Used for:

- Native mini program development, preview, upload, and release.

Possible cost triggers:

- WeChat verification/认证 is required.
- Payment capability is added.
- A business category requires extra qualification.
- A custom HTTPS domain is required and cannot use a free/default domain.

### Domain

MVP first attempts to use the Netlify default HTTPS domain for API requests.

Possible cost triggers:

- WeChat does not accept the default domain for the mini program request domain.
- A custom domain is needed.
- Domain registration, DNS, ICP filing, or certificate configuration is required.

### Future Features

These are intentionally not part of MVP and require an explicit cost review before implementation:

- AI recipe generation.
- Image upload and recipe photos.
- Paid recipe packs.
- WeChat Pay.
- User accounts and cloud favorites.
- Analytics beyond basic platform dashboards.

## Testing Plan

### Mini Program Manual Tests

- Home loads tags from API.
- Drawing with no filters returns a recipe.
- Drawing with filters returns a matching recipe.
- Empty match state appears when filters are too strict.
- API error state shows retry UI.
- Detail page displays ingredients and steps.
- Favorite persists after app restart.
- Unfavorite removes the item.
- Favorites empty state displays correctly.
- Share entry opens a usable recipe detail page.

### API Tests

- `GET /recipes-random` returns a published recipe.
- `GET /recipes-random` respects budget filter.
- `GET /recipes-random` respects cook time filter.
- `GET /recipes-random` respects tags filter.
- `GET /recipes-random` returns `404` for no match.
- `GET /recipes-detail` returns `404` for missing ID.
- `GET /tags` returns a stable array grouped by type.
- Admin create rejects missing title.
- Admin create rejects invalid status.
- Admin status update rejects invalid token.

### Admin Tests

- Admin can create a draft recipe.
- Admin can edit an existing recipe.
- Admin can publish a recipe.
- Admin can hide a recipe by switching it back to draft.
- Required field errors are visible and understandable.

## Release Flow

1. Create Supabase project.
2. Run SQL schema.
3. Insert seed tags and seed recipes.
4. Create Netlify site.
5. Configure Netlify environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_API_TOKEN`
6. Deploy admin site and Netlify Functions.
7. Test API endpoints against seed data.
8. Configure WeChat request legal domain using the deployed Netlify HTTPS domain.
9. Import `miniprogram/` into WeChat Developer Tools.
10. Configure API base URL in mini program environment file.
11. Run simulator tests.
12. Run real-device preview.
13. Upload trial/experience version.
14. Run release checklist.
15. Submit for review when ready.

## Implementation Order

1. Create repository folders under `eat-card/`.
2. Add Supabase SQL schema and seed data.
3. Build Netlify Functions API.
4. Add API tests.
5. Build mini program pages with mock data.
6. Connect mini program to API.
7. Add local favorites.
8. Build admin site.
9. Connect admin site to API.
10. Write setup, cost, test, and release docs.
11. Run verification.

## Success Criteria

- A user can open the mini program, choose filters, draw a recipe, view details, favorite it, and share it.
- An admin can add or edit a recipe from the Netlify-hosted admin site.
- The mini program reads published recipes from Supabase through Netlify Functions.
- No paid feature is required for local development.
- All cost-triggering steps are documented before they are needed.
- The project has clear test and release checklists.
