# Eat Card Mini Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the native WeChat Mini Program MVP for "今天吃什么卡" with Netlify Functions, Supabase PostgreSQL, and a Netlify-hosted admin UI.

**Architecture:** The mini program and admin UI call Netlify Functions. Functions validate requests, hide Supabase credentials, and access Supabase through the REST API using Node's built-in `fetch`. The MVP avoids user login, payments, storage, and AI so local development and early testing do not require paid resources.

**Tech Stack:** Native WeChat Mini Program, Netlify Functions, Supabase PostgreSQL REST API, static HTML/CSS/JS admin, Vitest, TypeScript test files, Node 18+ runtime.

---

## File Structure

Create a new `eat-card/` workspace without modifying the existing React app except for package scripts if needed later.

```text
eat-card/
  README.md
  docs/
    costs.md
    release-checklist.md
    setup.md
    test-checklist.md
  database/
    schema.sql
    seed.sql
  api/
    _lib/
      env.js
      http.js
      recipes.js
      supabase.js
      validation.js
    recipes-random.js
    recipes-detail.js
    tags.js
    admin-recipes.js
    admin-recipes-status.js
  api-tests/
    helpers.ts
    recipes-random.test.ts
    recipes-detail.test.ts
    tags.test.ts
    admin-recipes.test.ts
  admin/
    index.html
    styles.css
    app.js
    admin.test.ts
  miniprogram/
    app.js
    app.json
    app.wxss
    project.config.json
    sitemap.json
    env.example.js
    utils/
      api.js
      favorites.js
      format.js
    pages/
      home/
        home.js
        home.json
        home.wxml
        home.wxss
      detail/
        detail.js
        detail.json
        detail.wxml
        detail.wxss
      favorites/
        favorites.js
        favorites.json
        favorites.wxml
        favorites.wxss
      about/
        about.js
        about.json
        about.wxml
        about.wxss
```

Responsibilities:

- `database/`: SQL schema and seed content that can be pasted into Supabase SQL editor.
- `api/_lib/`: focused helpers for environment loading, HTTP responses, Supabase REST calls, recipe normalization, and validation.
- `api/*.js`: Netlify Function handlers. Each function should export `handler(event)`.
- `api-tests/`: Vitest coverage for function behavior using mocked `fetch`.
- `admin/`: static admin site served by Netlify. It uses `fetch` to call local/deployed Netlify Functions.
- `miniprogram/`: native WeChat Mini Program source.
- `docs/`: setup, cost triggers, testing, and release documentation.

---

### Task 1: Create Project Skeleton And Cost Docs

**Files:**
- Create: `eat-card/README.md`
- Create: `eat-card/docs/costs.md`
- Create: `eat-card/docs/setup.md`
- Create: `eat-card/docs/test-checklist.md`
- Create: `eat-card/docs/release-checklist.md`

- [ ] **Step 1: Create folders**

Run:

```bash
mkdir -p eat-card/{docs,database,api/_lib,api-tests,admin,miniprogram/utils,miniprogram/pages/{home,detail,favorites,about}}
```

Expected: command exits with status `0`.

- [ ] **Step 2: Write `eat-card/README.md`**

Create:

```markdown
# 今天吃什么卡

Native WeChat Mini Program MVP for drawing a meal card by budget, cook time, servings, and taste tags.

## Apps

- `miniprogram/`: native WeChat Mini Program.
- `api/`: Netlify Functions.
- `admin/`: static admin UI for recipe management.
- `database/`: Supabase schema and seed SQL.
- `docs/`: setup, cost, testing, and release notes.

## MVP Limits

- No AI recipe generation.
- No WeChat Pay.
- No paid recipe packs.
- No user account system.
- No file or image upload.

## Cost Rule

Before enabling any paid resource, payment capability, custom domain, AI API, object storage, or production upgrade, stop and review `docs/costs.md`.
```

- [ ] **Step 3: Write `eat-card/docs/costs.md`**

Create:

```markdown
# Cost Triggers

The MVP should be developed with free-tier resources where possible. Free tiers can change, so verify provider dashboards before production use.

## Supabase

Used for PostgreSQL only.

Stop before paying if:

- Database size exceeds the free plan.
- API traffic or bandwidth exceeds the free plan.
- More projects or production features are needed.
- Supabase Auth or Storage is added.

## Netlify

Used for static admin UI and Functions.

Stop before paying if:

- Build minutes exceed the free plan.
- Bandwidth exceeds the free plan.
- Function calls or runtime exceed the free plan.
- Team features, advanced deploy controls, or paid add-ons are needed.

## WeChat Mini Program

Used for native mini program preview, upload, and release.

Stop before paying if:

- WeChat verification is required.
- WeChat Pay is added.
- A selected service category requires extra qualification.
- A custom domain, ICP filing, or business certificate is required.

## Future Paid Features

Do not add these without a separate review:

- AI recipe generation.
- Image upload or recipe photos.
- Paid recipe packs.
- WeChat Pay.
- Cloud user accounts.
- Advanced analytics.
```

- [ ] **Step 4: Write setup and checklist docs**

Create `eat-card/docs/setup.md`:

```markdown
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
```

Create `eat-card/docs/test-checklist.md`:

```markdown
# Test Checklist

## Mini Program

- Home loads tags.
- Draw with no filters returns a recipe.
- Draw with budget filter returns a recipe within budget.
- Draw with strict filters shows empty state.
- Detail page shows ingredients, steps, and tips.
- Favorite persists after app restart.
- Unfavorite removes a recipe.
- Favorites empty state is visible.
- Share opens a usable detail page.
- API failure shows retry UI.

## API

- Random recipe returns only published recipes.
- Random recipe respects budget.
- Random recipe respects cook time.
- Random recipe respects tags.
- Detail returns 404 for missing recipe.
- Tags are sorted by type and sort order.
- Admin create rejects missing title.
- Admin status rejects invalid token.

## Admin

- Admin can create a draft recipe.
- Admin can edit a recipe.
- Admin can publish a recipe.
- Admin can return a recipe to draft.
- Validation errors are visible.
```

Create `eat-card/docs/release-checklist.md`:

```markdown
# Release Checklist

- Supabase schema is applied.
- Seed recipes are inserted.
- Netlify environment variables are configured.
- Netlify Functions respond from deployed URL.
- Admin UI can create and publish a recipe.
- WeChat request legal domain is configured.
- Mini program points to deployed `API_BASE_URL`.
- Simulator smoke test passes.
- Real-device preview smoke test passes.
- Experience version is uploaded.
- Cost triggers in `docs/costs.md` are reviewed.
- Privacy/about page text is present.
```

- [ ] **Step 5: Commit skeleton docs**

Run:

```bash
git add eat-card/README.md eat-card/docs
git commit -m "docs: add eat card project skeleton"
```

Expected: commit succeeds.

---

### Task 2: Add Supabase Schema And Seed Data

**Files:**
- Create: `eat-card/database/schema.sql`
- Create: `eat-card/database/seed.sql`

- [ ] **Step 1: Write `schema.sql`**

Create:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  budget_cents integer not null default 0 check (budget_cents >= 0),
  cook_minutes integer not null default 0 check (cook_minutes >= 0),
  servings integer not null default 1 check (servings > 0),
  difficulty text not null default 'easy' check (difficulty in ('easy', 'normal', 'hard')),
  tags text[] not null default '{}',
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  tips text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null check (type in ('taste', 'scenario', 'diet', 'tool')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

create index if not exists recipes_status_idx on public.recipes (status);
create index if not exists recipes_budget_idx on public.recipes (budget_cents);
create index if not exists recipes_cook_minutes_idx on public.recipes (cook_minutes);
create index if not exists tags_type_sort_idx on public.tags (type, sort_order);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
before update on public.recipes
for each row execute procedure public.set_updated_at();
```

- [ ] **Step 2: Write `seed.sql`**

Create:

```sql
insert into public.tags (name, type, sort_order) values
  ('清淡', 'taste', 10),
  ('下饭', 'taste', 20),
  ('酸甜', 'taste', 30),
  ('微辣', 'taste', 40),
  ('一人食', 'scenario', 10),
  ('两人餐', 'scenario', 20),
  ('宿舍', 'scenario', 30),
  ('懒人', 'scenario', 40),
  ('减脂', 'diet', 10),
  ('高蛋白', 'diet', 20),
  ('电饭煲', 'tool', 10),
  ('空气炸锅', 'tool', 20)
on conflict (name) do update
set type = excluded.type,
    sort_order = excluded.sort_order;

insert into public.recipes
  (title, description, budget_cents, cook_minutes, servings, difficulty, tags, ingredients, steps, tips, status)
values
  (
    '番茄肥牛饭',
    '15分钟的一人食下饭菜，酸甜开胃。',
    2200,
    15,
    1,
    'easy',
    array['一人食', '下饭', '酸甜'],
    '["肥牛卷150g", "番茄1个", "米饭1碗", "生抽1勺", "番茄酱1勺"]'::jsonb,
    '["番茄切块炒软", "加入番茄酱和少量水煮开", "放入肥牛煮熟", "淋在米饭上"]'::jsonb,
    '肥牛可以换成鸡蛋或豆腐。',
    'published'
  ),
  (
    '鸡蛋豆腐盖饭',
    '便宜、柔软、清淡，适合不想做复杂饭的时候。',
    1200,
    12,
    1,
    'easy',
    array['一人食', '清淡', '懒人'],
    '["鸡蛋2个", "嫩豆腐1盒", "米饭1碗", "生抽1勺", "葱花少量"]'::jsonb,
    '["鸡蛋打散", "豆腐切块下锅煎热", "倒入蛋液", "加生抽和少量水焖2分钟", "盖在米饭上"]'::jsonb,
    '想更香可以加一点香油。',
    'published'
  ),
  (
    '空气炸锅鸡腿排',
    '高蛋白、少油，适合减脂餐。',
    2600,
    25,
    1,
    'normal',
    array['高蛋白', '减脂', '空气炸锅'],
    '["去骨鸡腿1块", "黑胡椒", "生抽1勺", "蚝油半勺", "生菜适量"]'::jsonb,
    '["鸡腿用调料腌10分钟", "空气炸锅180度烤18分钟", "翻面再烤5分钟", "搭配生菜"]'::jsonb,
    '没有空气炸锅可以用平底锅小火煎熟。',
    'published'
  ),
  (
    '电饭煲香菇鸡肉饭',
    '把食材丢进电饭煲，适合两人吃。',
    3500,
    35,
    2,
    'easy',
    array['两人餐', '电饭煲', '懒人'],
    '["大米1.5杯", "鸡腿肉200g", "香菇4朵", "胡萝卜半根", "生抽2勺"]'::jsonb,
    '["米洗净加正常水量", "鸡肉和蔬菜切块", "所有食材加调料放入电饭煲", "按煮饭键"]'::jsonb,
    '煮好后焖5分钟再拌匀。',
    'published'
  )
on conflict do nothing;
```

- [ ] **Step 3: Verify SQL text is present**

Run:

```bash
rg -n "create table|番茄肥牛饭|空气炸锅" eat-card/database
```

Expected: output includes `recipes`, `tags`, `番茄肥牛饭`, and `空气炸锅`.

- [ ] **Step 4: Commit database files**

Run:

```bash
git add eat-card/database
git commit -m "feat: add eat card database schema"
```

Expected: commit succeeds.

---

### Task 3: Build Shared API Helpers With Tests

**Files:**
- Create: `eat-card/api/_lib/http.js`
- Create: `eat-card/api/_lib/env.js`
- Create: `eat-card/api/_lib/validation.js`
- Create: `eat-card/api/_lib/recipes.js`
- Create: `eat-card/api-tests/helpers.ts`

- [ ] **Step 1: Write `http.js`**

Create:

```js
export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, x-admin-token',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

export function handleOptions(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }
  return null;
}

export function methodNotAllowed(methods) {
  return json(405, { error: `Method must be ${methods.join(' or ')}` });
}
```

- [ ] **Step 2: Write `env.js`**

Create:

```js
export function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseConfig() {
  return {
    url: getRequiredEnv('SUPABASE_URL').replace(/\/$/, ''),
    serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
  };
}

export function getAdminToken() {
  return getRequiredEnv('ADMIN_API_TOKEN');
}
```

- [ ] **Step 3: Write `validation.js`**

Create:

```js
export function parsePositiveInt(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return number;
}

export function parseTags(value) {
  if (!value) {
    return [];
  }
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parseJsonBody(body) {
  if (!body) {
    return {};
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Body must be valid JSON');
  }
}

export function validateRecipeInput(input) {
  const errors = {};
  if (!input.title || !String(input.title).trim()) {
    errors.title = 'Title is required';
  }
  if (!Array.isArray(input.ingredients) || input.ingredients.length === 0) {
    errors.ingredients = 'At least one ingredient is required';
  }
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    errors.steps = 'At least one step is required';
  }
  if (!['draft', 'published'].includes(input.status)) {
    errors.status = 'Status must be draft or published';
  }
  if (!['easy', 'normal', 'hard'].includes(input.difficulty)) {
    errors.difficulty = 'Difficulty must be easy, normal, or hard';
  }
  if (!Number.isInteger(input.budgetCents) || input.budgetCents < 0) {
    errors.budgetCents = 'Budget must be a non-negative integer';
  }
  if (!Number.isInteger(input.cookMinutes) || input.cookMinutes < 0) {
    errors.cookMinutes = 'Cook minutes must be a non-negative integer';
  }
  if (!Number.isInteger(input.servings) || input.servings <= 0) {
    errors.servings = 'Servings must be a positive integer';
  }
  return errors;
}
```

- [ ] **Step 4: Write `recipes.js`**

Create:

```js
export function toRecipeCard(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    budgetCents: row.budget_cents,
    cookMinutes: row.cook_minutes,
    servings: row.servings,
    difficulty: row.difficulty,
    tags: row.tags || [],
    tips: row.tips
  };
}

export function toRecipeDetail(row) {
  return {
    ...toRecipeCard(row),
    ingredients: row.ingredients || [],
    steps: row.steps || [],
    status: row.status
  };
}

export function fromRecipeInput(input) {
  return {
    title: String(input.title).trim(),
    description: String(input.description || '').trim(),
    budget_cents: input.budgetCents,
    cook_minutes: input.cookMinutes,
    servings: input.servings,
    difficulty: input.difficulty,
    tags: Array.isArray(input.tags) ? input.tags : [],
    ingredients: input.ingredients,
    steps: input.steps,
    tips: String(input.tips || '').trim(),
    status: input.status
  };
}
```

- [ ] **Step 5: Write `helpers.ts`**

Create:

```ts
export function parseBody(response: { body?: string }) {
  return response.body ? JSON.parse(response.body) : undefined;
}

export function event({
  method = 'GET',
  query = {},
  body,
  headers = {}
}: {
  method?: string;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
} = {}) {
  return {
    httpMethod: method,
    queryStringParameters: query,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  };
}

export function mockFetchJson(data: unknown, ok = true, status = 200) {
  global.fetch = vi.fn(async () => ({
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data)
  })) as unknown as typeof fetch;
}
```

- [ ] **Step 6: Commit API helpers**

Run:

```bash
git add eat-card/api/_lib eat-card/api-tests/helpers.ts
git commit -m "feat: add eat card api helpers"
```

Expected: commit succeeds.

---

### Task 4: Implement Supabase REST Helper

**Files:**
- Create: `eat-card/api/_lib/supabase.js`
- Test: `eat-card/api-tests/recipes-random.test.ts`

- [ ] **Step 1: Write a failing test for random recipe URL construction**

Create `eat-card/api-tests/recipes-random.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { event, mockFetchJson, parseBody } from './helpers';
import { handler } from '../api/recipes-random.js';

describe('recipes-random function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  it('returns a published recipe that matches filters', async () => {
    mockFetchJson([
      {
        id: 'recipe-1',
        title: '番茄肥牛饭',
        description: '15分钟的一人食下饭菜',
        budget_cents: 2200,
        cook_minutes: 15,
        servings: 1,
        difficulty: 'easy',
        tags: ['一人食', '下饭'],
        tips: '肥牛可以换成鸡蛋'
      }
    ]);

    const response = await handler(event({
      query: {
        maxBudgetCents: '2500',
        maxCookMinutes: '20',
        servings: '1',
        tags: '一人食,下饭'
      }
    }) as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).recipe.title).toBe('番茄肥牛饭');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/recipes'),
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'service-key',
          authorization: 'Bearer service-key'
        })
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run eat-card/api-tests/recipes-random.test.ts
```

Expected: FAIL because `../api/recipes-random.js` does not exist.

- [ ] **Step 3: Write `supabase.js`**

Create:

```js
import { getSupabaseConfig } from './env.js';

export async function supabaseRequest(path, { method = 'GET', body } = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.hint || `Supabase request failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}
```

- [ ] **Step 4: Write minimal `recipes-random.js`**

Create:

```js
import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { parsePositiveInt, parseTags } from './_lib/validation.js';
import { toRecipeCard } from './_lib/recipes.js';
import { supabaseRequest } from './_lib/supabase.js';

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET']);

  try {
    const params = event.queryStringParameters || {};
    const maxBudgetCents = parsePositiveInt(params.maxBudgetCents, 'maxBudgetCents');
    const maxCookMinutes = parsePositiveInt(params.maxCookMinutes, 'maxCookMinutes');
    const servings = parsePositiveInt(params.servings, 'servings');
    const tags = parseTags(params.tags);

    const query = new URLSearchParams();
    query.set('select', 'id,title,description,budget_cents,cook_minutes,servings,difficulty,tags,tips');
    query.set('status', 'eq.published');
    if (maxBudgetCents !== undefined) query.set('budget_cents', `lte.${maxBudgetCents}`);
    if (maxCookMinutes !== undefined) query.set('cook_minutes', `lte.${maxCookMinutes}`);
    if (servings !== undefined) query.set('servings', `eq.${servings}`);
    for (const tag of tags) {
      query.append('tags', `cs.{${tag}}`);
    }

    const rows = await supabaseRequest(`recipes?${query.toString()}`);
    if (!Array.isArray(rows) || rows.length === 0) {
      return json(404, { error: 'No matching recipe found' });
    }

    const index = Math.floor(Math.random() * rows.length);
    return json(200, { recipe: toRecipeCard(rows[index]) });
  } catch (error) {
    return json(400, { error: error.message });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npx vitest run eat-card/api-tests/recipes-random.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit random recipe API**

Run:

```bash
git add eat-card/api eat-card/api-tests/recipes-random.test.ts
git commit -m "feat: add random recipe function"
```

Expected: commit succeeds.

---

### Task 5: Add Public Detail And Tags APIs

**Files:**
- Create: `eat-card/api/recipes-detail.js`
- Create: `eat-card/api/tags.js`
- Create: `eat-card/api-tests/recipes-detail.test.ts`
- Create: `eat-card/api-tests/tags.test.ts`

- [ ] **Step 1: Write detail API tests**

Create `eat-card/api-tests/recipes-detail.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { event, mockFetchJson, parseBody } from './helpers';
import { handler } from '../api/recipes-detail.js';

describe('recipes-detail function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  it('returns recipe detail for a published recipe', async () => {
    mockFetchJson([
      {
        id: 'recipe-1',
        title: '鸡蛋豆腐盖饭',
        description: '便宜清淡',
        budget_cents: 1200,
        cook_minutes: 12,
        servings: 1,
        difficulty: 'easy',
        tags: ['清淡'],
        ingredients: ['鸡蛋2个'],
        steps: ['鸡蛋打散'],
        tips: '加香油',
        status: 'published'
      }
    ]);

    const response = await handler(event({ query: { id: 'recipe-1' } }) as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).recipe.ingredients).toEqual(['鸡蛋2个']);
  });

  it('returns 404 when recipe is missing', async () => {
    mockFetchJson([]);

    const response = await handler(event({ query: { id: 'missing' } }) as never);

    expect(response.statusCode).toBe(404);
  });
});
```

- [ ] **Step 2: Write tags API tests**

Create `eat-card/api-tests/tags.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { event, mockFetchJson, parseBody } from './helpers';
import { handler } from '../api/tags.js';

describe('tags function', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  it('returns tags in a stable shape', async () => {
    mockFetchJson([
      { id: 'tag-1', name: '清淡', type: 'taste', sort_order: 10 },
      { id: 'tag-2', name: '一人食', type: 'scenario', sort_order: 10 }
    ]);

    const response = await handler(event() as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).tags).toEqual([
      { id: 'tag-1', name: '清淡', type: 'taste', sortOrder: 10 },
      { id: 'tag-2', name: '一人食', type: 'scenario', sortOrder: 10 }
    ]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npx vitest run eat-card/api-tests/recipes-detail.test.ts eat-card/api-tests/tags.test.ts
```

Expected: FAIL because the function files do not exist.

- [ ] **Step 4: Implement `recipes-detail.js`**

Create:

```js
import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { toRecipeDetail } from './_lib/recipes.js';
import { supabaseRequest } from './_lib/supabase.js';

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET']);

  const id = event.queryStringParameters?.id;
  if (!id) {
    return json(400, { error: 'id is required' });
  }

  try {
    const query = new URLSearchParams();
    query.set('select', '*');
    query.set('id', `eq.${id}`);
    query.set('status', 'eq.published');
    query.set('limit', '1');
    const rows = await supabaseRequest(`recipes?${query.toString()}`);
    if (!Array.isArray(rows) || rows.length === 0) {
      return json(404, { error: 'Recipe not found' });
    }
    return json(200, { recipe: toRecipeDetail(rows[0]) });
  } catch (error) {
    return json(400, { error: error.message });
  }
}
```

- [ ] **Step 5: Implement `tags.js`**

Create:

```js
import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { supabaseRequest } from './_lib/supabase.js';

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET']);

  try {
    const query = new URLSearchParams();
    query.set('select', 'id,name,type,sort_order');
    query.set('order', 'type.asc,sort_order.asc,name.asc');
    const rows = await supabaseRequest(`tags?${query.toString()}`);
    return json(200, {
      tags: rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        sortOrder: row.sort_order
      }))
    });
  } catch (error) {
    return json(400, { error: error.message });
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run:

```bash
npx vitest run eat-card/api-tests/recipes-detail.test.ts eat-card/api-tests/tags.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit public APIs**

Run:

```bash
git add eat-card/api/recipes-detail.js eat-card/api/tags.js eat-card/api-tests
git commit -m "feat: add recipe detail and tags functions"
```

Expected: commit succeeds.

---

### Task 6: Add Admin APIs

**Files:**
- Create: `eat-card/api/admin-recipes.js`
- Create: `eat-card/api/admin-recipes-status.js`
- Create: `eat-card/api-tests/admin-recipes.test.ts`

- [ ] **Step 1: Write admin API tests**

Create `eat-card/api-tests/admin-recipes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { event, mockFetchJson, parseBody } from './helpers';
import { handler as saveRecipe } from '../api/admin-recipes.js';
import { handler as updateStatus } from '../api/admin-recipes-status.js';

const validRecipe = {
  title: '番茄肥牛饭',
  description: '15分钟的一人食下饭菜',
  budgetCents: 2200,
  cookMinutes: 15,
  servings: 1,
  difficulty: 'easy',
  tags: ['一人食'],
  ingredients: ['肥牛卷150g'],
  steps: ['番茄切块炒软'],
  tips: '肥牛可以换成鸡蛋',
  status: 'draft'
};

describe('admin recipe functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.ADMIN_API_TOKEN = 'admin-secret';
  });

  it('rejects invalid admin token', async () => {
    const response = await saveRecipe(event({
      method: 'POST',
      headers: { 'x-admin-token': 'wrong' },
      body: validRecipe
    }) as never);

    expect(response.statusCode).toBe(401);
  });

  it('rejects missing title with field errors', async () => {
    const response = await saveRecipe(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: { ...validRecipe, title: '' }
    }) as never);

    expect(response.statusCode).toBe(422);
    expect(parseBody(response).errors.title).toBe('Title is required');
  });

  it('creates a valid recipe', async () => {
    mockFetchJson([{ id: 'recipe-1', title: '番茄肥牛饭' }]);

    const response = await saveRecipe(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: validRecipe
    }) as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).recipe.id).toBe('recipe-1');
  });

  it('updates recipe status', async () => {
    mockFetchJson([{ id: 'recipe-1', status: 'published' }]);

    const response = await updateStatus(event({
      method: 'POST',
      headers: { 'x-admin-token': 'admin-secret' },
      body: { id: 'recipe-1', status: 'published' }
    }) as never);

    expect(response.statusCode).toBe(200);
    expect(parseBody(response).recipe.status).toBe('published');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run eat-card/api-tests/admin-recipes.test.ts
```

Expected: FAIL because admin function files do not exist.

- [ ] **Step 3: Implement `admin-recipes.js`**

Create:

```js
import { getAdminToken } from './_lib/env.js';
import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { fromRecipeInput } from './_lib/recipes.js';
import { supabaseRequest } from './_lib/supabase.js';
import { parseJsonBody, validateRecipeInput } from './_lib/validation.js';

function isAuthorized(event) {
  return event.headers?.['x-admin-token'] === getAdminToken();
}

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST']);
  if (!isAuthorized(event)) return json(401, { error: 'Unauthorized' });

  try {
    const input = parseJsonBody(event.body);
    const errors = validateRecipeInput(input);
    if (Object.keys(errors).length > 0) {
      return json(422, { errors });
    }

    const row = fromRecipeInput(input);
    const result = input.id
      ? await supabaseRequest(`recipes?id=eq.${input.id}`, { method: 'PATCH', body: row })
      : await supabaseRequest('recipes', { method: 'POST', body: row });

    return json(200, { recipe: result[0] });
  } catch (error) {
    return json(400, { error: error.message });
  }
}
```

- [ ] **Step 4: Implement `admin-recipes-status.js`**

Create:

```js
import { getAdminToken } from './_lib/env.js';
import { handleOptions, json, methodNotAllowed } from './_lib/http.js';
import { supabaseRequest } from './_lib/supabase.js';
import { parseJsonBody } from './_lib/validation.js';

function isAuthorized(event) {
  return event.headers?.['x-admin-token'] === getAdminToken();
}

export async function handler(event) {
  const options = handleOptions(event);
  if (options) return options;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST']);
  if (!isAuthorized(event)) return json(401, { error: 'Unauthorized' });

  try {
    const input = parseJsonBody(event.body);
    if (!input.id) return json(422, { errors: { id: 'id is required' } });
    if (!['draft', 'published'].includes(input.status)) {
      return json(422, { errors: { status: 'Status must be draft or published' } });
    }

    const result = await supabaseRequest(`recipes?id=eq.${input.id}`, {
      method: 'PATCH',
      body: { status: input.status }
    });

    return json(200, { recipe: result[0] });
  } catch (error) {
    return json(400, { error: error.message });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
npx vitest run eat-card/api-tests/admin-recipes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit admin APIs**

Run:

```bash
git add eat-card/api/admin-recipes.js eat-card/api/admin-recipes-status.js eat-card/api-tests/admin-recipes.test.ts
git commit -m "feat: add admin recipe functions"
```

Expected: commit succeeds.

---

### Task 7: Build Mini Program Skeleton With Mock Data

**Files:**
- Create: `eat-card/miniprogram/app.js`
- Create: `eat-card/miniprogram/app.json`
- Create: `eat-card/miniprogram/app.wxss`
- Create: `eat-card/miniprogram/project.config.json`
- Create: `eat-card/miniprogram/sitemap.json`
- Create: `eat-card/miniprogram/env.example.js`
- Create: `eat-card/miniprogram/pages/home/home.*`
- Create: `eat-card/miniprogram/pages/detail/detail.*`
- Create: `eat-card/miniprogram/pages/favorites/favorites.*`
- Create: `eat-card/miniprogram/pages/about/about.*`

- [ ] **Step 1: Create mini program config files**

Create `eat-card/miniprogram/app.js`:

```js
App({
  globalData: {
    appName: '今天吃什么卡'
  }
});
```

Create `eat-card/miniprogram/app.json`:

```json
{
  "pages": [
    "pages/home/home",
    "pages/detail/detail",
    "pages/favorites/favorites",
    "pages/about/about"
  ],
  "window": {
    "navigationBarTitleText": "今天吃什么卡",
    "navigationBarBackgroundColor": "#ffffff",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#f6f7f4"
  },
  "tabBar": {
    "color": "#6b746f",
    "selectedColor": "#2f8067",
    "backgroundColor": "#ffffff",
    "borderStyle": "black",
    "list": [
      { "pagePath": "pages/home/home", "text": "抽卡" },
      { "pagePath": "pages/favorites/favorites", "text": "收藏" },
      { "pagePath": "pages/about/about", "text": "关于" }
    ]
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

Create `eat-card/miniprogram/app.wxss`:

```css
page {
  background: #f6f7f4;
  color: #1f2a26;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.page {
  min-height: 100vh;
  padding: 28rpx;
  box-sizing: border-box;
}

.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 12rpx 30rpx rgba(31, 42, 38, 0.08);
}

.muted {
  color: #6b746f;
}
```

Create `eat-card/miniprogram/project.config.json`:

```json
{
  "description": "今天吃什么卡",
  "packOptions": {
    "ignore": []
  },
  "setting": {
    "urlCheck": true,
    "es6": true,
    "enhance": true,
    "postcss": true,
    "minified": true
  },
  "compileType": "miniprogram",
  "libVersion": "latest",
  "appid": "touristappid",
  "projectname": "eat-card",
  "condition": {}
}
```

Create `eat-card/miniprogram/sitemap.json`:

```json
{
  "rules": [
    {
      "action": "allow",
      "page": "*"
    }
  ]
}
```

Create `eat-card/miniprogram/env.example.js`:

```js
module.exports = {
  API_BASE_URL: 'https://your-site.netlify.app/.netlify/functions'
};
```

- [ ] **Step 2: Create mock home page**

Create `eat-card/miniprogram/pages/home/home.json`:

```json
{
  "navigationBarTitleText": "今天吃什么卡"
}
```

Create `eat-card/miniprogram/pages/home/home.js`:

```js
const mockRecipe = {
  id: 'mock-1',
  title: '番茄肥牛饭',
  description: '15分钟的一人食下饭菜',
  budgetCents: 2200,
  cookMinutes: 15,
  servings: 1,
  difficulty: 'easy',
  tags: ['一人食', '下饭'],
  tips: '肥牛可以换成鸡蛋'
};

Page({
  data: {
    budgetOptions: [
      { label: '不限', value: '' },
      { label: '20元以内', value: '2000' },
      { label: '40元以内', value: '4000' }
    ],
    timeOptions: [
      { label: '不限', value: '' },
      { label: '15分钟', value: '15' },
      { label: '30分钟', value: '30' }
    ],
    selectedBudgetIndex: 0,
    selectedTimeIndex: 0,
    recipe: mockRecipe,
    loading: false,
    error: ''
  },
  onBudgetChange(event) {
    this.setData({ selectedBudgetIndex: Number(event.detail.value) });
  },
  onTimeChange(event) {
    this.setData({ selectedTimeIndex: Number(event.detail.value) });
  },
  drawRecipe() {
    this.setData({ recipe: mockRecipe, error: '' });
  },
  openDetail() {
    wx.navigateTo({ url: `/pages/detail/detail?id=${this.data.recipe.id}` });
  }
});
```

Create `eat-card/miniprogram/pages/home/home.wxml`:

```xml
<view class="page">
  <view class="hero">
    <text class="eyebrow">今天吃什么卡</text>
    <text class="title">不知道吃什么，就抽一张。</text>
  </view>

  <view class="card controls">
    <view class="field">
      <text>预算</text>
      <picker mode="selector" range="{{budgetOptions}}" range-key="label" value="{{selectedBudgetIndex}}" bindchange="onBudgetChange">
        <view class="picker">{{budgetOptions[selectedBudgetIndex].label}}</view>
      </picker>
    </view>
    <view class="field">
      <text>耗时</text>
      <picker mode="selector" range="{{timeOptions}}" range-key="label" value="{{selectedTimeIndex}}" bindchange="onTimeChange">
        <view class="picker">{{timeOptions[selectedTimeIndex].label}}</view>
      </picker>
    </view>
    <button class="draw" bindtap="drawRecipe" loading="{{loading}}">抽一张</button>
  </view>

  <view wx:if="{{error}}" class="error">{{error}}</view>

  <view wx:if="{{recipe}}" class="card recipe" bindtap="openDetail">
    <text class="recipe-title">{{recipe.title}}</text>
    <text class="muted">{{recipe.description}}</text>
    <view class="meta">
      <text>{{recipe.budgetCents / 100}}元</text>
      <text>{{recipe.cookMinutes}}分钟</text>
      <text>{{recipe.servings}}人</text>
    </view>
    <view class="tags">
      <text wx:for="{{recipe.tags}}" wx:key="*this" class="tag">{{item}}</text>
    </view>
  </view>
</view>
```

Create `eat-card/miniprogram/pages/home/home.wxss`:

```css
.hero {
  margin-bottom: 24rpx;
}

.eyebrow {
  display: block;
  color: #2f8067;
  font-size: 26rpx;
  margin-bottom: 10rpx;
}

.title {
  display: block;
  font-size: 44rpx;
  font-weight: 700;
  line-height: 1.25;
}

.controls {
  margin-bottom: 24rpx;
}

.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
  font-size: 30rpx;
}

.picker {
  color: #2f8067;
  font-weight: 600;
}

.draw {
  background: #2f8067;
  color: #ffffff;
  border-radius: 12rpx;
}

.error {
  color: #b44444;
  margin-bottom: 20rpx;
}

.recipe-title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  margin-bottom: 10rpx;
}

.meta,
.tags {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.meta text,
.tag {
  background: #eef5f1;
  color: #2f8067;
  padding: 8rpx 12rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
}
```

- [ ] **Step 3: Create simple detail, favorites, and about pages**

Create the remaining page files with stable placeholders that compile:

`eat-card/miniprogram/pages/detail/detail.json`

```json
{ "navigationBarTitleText": "菜谱详情" }
```

`eat-card/miniprogram/pages/detail/detail.js`

```js
Page({
  data: {
    recipe: {
      title: '番茄肥牛饭',
      ingredients: ['肥牛卷150g', '番茄1个', '米饭1碗'],
      steps: ['番茄切块炒软', '放入肥牛煮熟', '淋在米饭上'],
      tips: '肥牛可以换成鸡蛋'
    }
  },
  onShareAppMessage() {
    return {
      title: this.data.recipe.title,
      path: '/pages/home/home'
    };
  }
});
```

`eat-card/miniprogram/pages/detail/detail.wxml`

```xml
<view class="page">
  <view class="card">
    <text class="title">{{recipe.title}}</text>
    <text class="section">食材</text>
    <text wx:for="{{recipe.ingredients}}" wx:key="*this" class="line">{{item}}</text>
    <text class="section">步骤</text>
    <text wx:for="{{recipe.steps}}" wx:key="*this" class="line">{{index + 1}}. {{item}}</text>
    <text class="section">小提示</text>
    <text class="line">{{recipe.tips}}</text>
  </view>
</view>
```

`eat-card/miniprogram/pages/detail/detail.wxss`

```css
.title,
.section,
.line {
  display: block;
}

.title {
  font-size: 40rpx;
  font-weight: 700;
  margin-bottom: 24rpx;
}

.section {
  color: #2f8067;
  font-weight: 700;
  margin: 24rpx 0 12rpx;
}

.line {
  color: #46534f;
  line-height: 1.7;
}
```

Create matching simple pages for favorites/about:

`eat-card/miniprogram/pages/favorites/favorites.json`

```json
{ "navigationBarTitleText": "收藏" }
```

`eat-card/miniprogram/pages/favorites/favorites.js`

```js
Page({
  data: {
    favorites: []
  }
});
```

`eat-card/miniprogram/pages/favorites/favorites.wxml`

```xml
<view class="page">
  <view class="card">
    <text wx:if="{{favorites.length === 0}}" class="muted">还没有收藏的菜谱。</text>
  </view>
</view>
```

`eat-card/miniprogram/pages/favorites/favorites.wxss`

```css
```

`eat-card/miniprogram/pages/about/about.json`

```json
{ "navigationBarTitleText": "关于" }
```

`eat-card/miniprogram/pages/about/about.js`

```js
Page({});
```

`eat-card/miniprogram/pages/about/about.wxml`

```xml
<view class="page">
  <view class="card">
    <text class="title">今天吃什么卡</text>
    <text class="line">一个帮你快速决定吃什么的小工具。</text>
    <text class="line">MVP 版本的收藏数据只保存在本机。</text>
  </view>
</view>
```

`eat-card/miniprogram/pages/about/about.wxss`

```css
.title,
.line {
  display: block;
}

.title {
  font-size: 36rpx;
  font-weight: 700;
  margin-bottom: 18rpx;
}

.line {
  color: #46534f;
  line-height: 1.7;
}
```

- [ ] **Step 4: Verify files exist**

Run:

```bash
rg --files eat-card/miniprogram
```

Expected: output lists app files and all four page folders.

- [ ] **Step 5: Commit mini program skeleton**

Run:

```bash
git add eat-card/miniprogram
git commit -m "feat: add eat card mini program skeleton"
```

Expected: commit succeeds.

---

### Task 8: Connect Mini Program To API And Local Favorites

**Files:**
- Create: `eat-card/miniprogram/utils/api.js`
- Create: `eat-card/miniprogram/utils/favorites.js`
- Create: `eat-card/miniprogram/utils/format.js`
- Modify: `eat-card/miniprogram/pages/home/home.js`
- Modify: `eat-card/miniprogram/pages/detail/detail.js`
- Modify: `eat-card/miniprogram/pages/favorites/favorites.js`

- [ ] **Step 1: Write `utils/api.js`**

Create:

```js
const env = require('../env.js');

function request(path, data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${env.API_BASE_URL}${path}`,
      method: 'GET',
      data,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data);
        } else {
          reject(new Error(response.data?.error || '请求失败'));
        }
      },
      fail() {
        reject(new Error('网络连接失败'));
      }
    });
  });
}

function getRandomRecipe(filters) {
  return request('/recipes-random', filters);
}

function getRecipeDetail(id) {
  return request('/recipes-detail', { id });
}

function getTags() {
  return request('/tags');
}

module.exports = {
  getRandomRecipe,
  getRecipeDetail,
  getTags
};
```

- [ ] **Step 2: Write `utils/favorites.js`**

Create:

```js
const KEY = 'eat-card:favorites';

function getFavorites() {
  return wx.getStorageSync(KEY) || [];
}

function saveFavorites(favorites) {
  wx.setStorageSync(KEY, favorites);
}

function isFavorite(id) {
  return getFavorites().some((item) => item.id === id);
}

function addFavorite(recipe) {
  const favorites = getFavorites().filter((item) => item.id !== recipe.id);
  favorites.unshift({
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    budgetCents: recipe.budgetCents,
    cookMinutes: recipe.cookMinutes,
    servings: recipe.servings,
    tags: recipe.tags || []
  });
  saveFavorites(favorites);
}

function removeFavorite(id) {
  saveFavorites(getFavorites().filter((item) => item.id !== id));
}

module.exports = {
  getFavorites,
  isFavorite,
  addFavorite,
  removeFavorite
};
```

- [ ] **Step 3: Write `utils/format.js`**

Create:

```js
function yuan(cents) {
  return Math.round(cents / 100);
}

module.exports = {
  yuan
};
```

- [ ] **Step 4: Update home page to call API**

Replace `eat-card/miniprogram/pages/home/home.js` with:

```js
const api = require('../../utils/api.js');

Page({
  data: {
    budgetOptions: [
      { label: '不限', value: '' },
      { label: '20元以内', value: '2000' },
      { label: '40元以内', value: '4000' }
    ],
    timeOptions: [
      { label: '不限', value: '' },
      { label: '15分钟', value: '15' },
      { label: '30分钟', value: '30' }
    ],
    selectedBudgetIndex: 0,
    selectedTimeIndex: 0,
    recipe: null,
    loading: false,
    error: ''
  },
  onBudgetChange(event) {
    this.setData({ selectedBudgetIndex: Number(event.detail.value) });
  },
  onTimeChange(event) {
    this.setData({ selectedTimeIndex: Number(event.detail.value) });
  },
  async drawRecipe() {
    const budget = this.data.budgetOptions[this.data.selectedBudgetIndex].value;
    const time = this.data.timeOptions[this.data.selectedTimeIndex].value;
    this.setData({ loading: true, error: '' });
    try {
      const data = await api.getRandomRecipe({
        maxBudgetCents: budget,
        maxCookMinutes: time
      });
      this.setData({ recipe: data.recipe });
    } catch (error) {
      this.setData({ error: error.message || '抽卡失败，请稍后重试' });
    } finally {
      this.setData({ loading: false });
    }
  },
  openDetail() {
    if (!this.data.recipe) return;
    wx.navigateTo({ url: `/pages/detail/detail?id=${this.data.recipe.id}` });
  },
  onShareAppMessage() {
    return {
      title: this.data.recipe ? `今天吃：${this.data.recipe.title}` : '今天吃什么卡',
      path: '/pages/home/home'
    };
  }
});
```

- [ ] **Step 5: Update detail page to fetch API and favorite**

Replace `eat-card/miniprogram/pages/detail/detail.js` with:

```js
const api = require('../../utils/api.js');
const favorites = require('../../utils/favorites.js');

Page({
  data: {
    id: '',
    recipe: null,
    loading: true,
    error: '',
    favorite: false
  },
  async onLoad(options) {
    const id = options.id;
    this.setData({ id, loading: true, error: '' });
    try {
      const data = await api.getRecipeDetail(id);
      this.setData({
        recipe: data.recipe,
        favorite: favorites.isFavorite(id)
      });
    } catch (error) {
      this.setData({ error: error.message || '加载失败' });
    } finally {
      this.setData({ loading: false });
    }
  },
  toggleFavorite() {
    if (!this.data.recipe) return;
    if (this.data.favorite) {
      favorites.removeFavorite(this.data.recipe.id);
      this.setData({ favorite: false });
    } else {
      favorites.addFavorite(this.data.recipe);
      this.setData({ favorite: true });
    }
  },
  onShareAppMessage() {
    return {
      title: this.data.recipe ? `今天吃：${this.data.recipe.title}` : '今天吃什么卡',
      path: this.data.recipe ? `/pages/detail/detail?id=${this.data.recipe.id}` : '/pages/home/home'
    };
  }
});
```

Add a favorite button to `eat-card/miniprogram/pages/detail/detail.wxml` under the title:

```xml
<button class="favorite" bindtap="toggleFavorite">{{favorite ? '取消收藏' : '收藏'}}</button>
```

- [ ] **Step 6: Update favorites page**

Replace `eat-card/miniprogram/pages/favorites/favorites.js` with:

```js
const favorites = require('../../utils/favorites.js');

Page({
  data: {
    favorites: []
  },
  onShow() {
    this.setData({ favorites: favorites.getFavorites() });
  },
  openDetail(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },
  removeFavorite(event) {
    favorites.removeFavorite(event.currentTarget.dataset.id);
    this.setData({ favorites: favorites.getFavorites() });
  }
});
```

Replace `eat-card/miniprogram/pages/favorites/favorites.wxml` with:

```xml
<view class="page">
  <view wx:if="{{favorites.length === 0}}" class="card">
    <text class="muted">还没有收藏的菜谱。</text>
  </view>
  <view wx:for="{{favorites}}" wx:key="id" class="card favorite-card">
    <view bindtap="openDetail" data-id="{{item.id}}">
      <text class="title">{{item.title}}</text>
      <text class="muted">{{item.description}}</text>
    </view>
    <button size="mini" data-id="{{item.id}}" bindtap="removeFavorite">移除</button>
  </view>
</view>
```

- [ ] **Step 7: Verify static references**

Run:

```bash
rg -n "getRandomRecipe|getRecipeDetail|getFavorites|toggleFavorite" eat-card/miniprogram
```

Expected: output includes home, detail, favorites, and utility files.

- [ ] **Step 8: Commit mini program API connection**

Run:

```bash
git add eat-card/miniprogram
git commit -m "feat: connect mini program to recipe api"
```

Expected: commit succeeds.

---

### Task 9: Build Static Admin UI

**Files:**
- Create: `eat-card/admin/index.html`
- Create: `eat-card/admin/styles.css`
- Create: `eat-card/admin/app.js`
- Create: `eat-card/admin/admin.test.ts`

- [ ] **Step 1: Write admin helper tests**

Create `eat-card/admin/admin.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildRecipePayload } from './app.js';

describe('admin recipe payload', () => {
  it('converts textarea lines into arrays', () => {
    const payload = buildRecipePayload({
      title: '番茄肥牛饭',
      description: '下饭菜',
      budgetCents: '2200',
      cookMinutes: '15',
      servings: '1',
      difficulty: 'easy',
      tags: '一人食,下饭',
      ingredients: '肥牛卷150g\n番茄1个',
      steps: '番茄切块\n肥牛煮熟',
      tips: '可换鸡蛋',
      status: 'draft'
    });

    expect(payload.ingredients).toEqual(['肥牛卷150g', '番茄1个']);
    expect(payload.tags).toEqual(['一人食', '下饭']);
    expect(payload.budgetCents).toBe(2200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run eat-card/admin/admin.test.ts
```

Expected: FAIL because `admin/app.js` does not exist.

- [ ] **Step 3: Write `admin/app.js`**

Create:

```js
export function buildRecipePayload(values) {
  return {
    title: values.title,
    description: values.description,
    budgetCents: Number(values.budgetCents),
    cookMinutes: Number(values.cookMinutes),
    servings: Number(values.servings),
    difficulty: values.difficulty,
    tags: splitList(values.tags, ','),
    ingredients: splitList(values.ingredients, '\n'),
    steps: splitList(values.steps, '\n'),
    tips: values.tips,
    status: values.status
  };
}

function splitList(value, separator) {
  return String(value || '')
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function submitRecipe(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const token = document.querySelector('#adminToken').value;
  const status = document.querySelector('#status');
  const values = Object.fromEntries(new FormData(form).entries());
  const payload = buildRecipePayload(values);

  status.textContent = '保存中...';

  const response = await fetch('/.netlify/functions/admin-recipes', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': token
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    status.textContent = data.errors ? JSON.stringify(data.errors) : data.error;
    return;
  }

  status.textContent = `已保存：${data.recipe.title || payload.title}`;
  form.reset();
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#recipeForm');
  if (form) {
    form.addEventListener('submit', submitRecipe);
  }
}
```

- [ ] **Step 4: Write `admin/index.html`**

Create:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>今天吃什么卡 Admin</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <h1>今天吃什么卡 Admin</h1>
    <label>
      Admin Token
      <input id="adminToken" type="password" autocomplete="off" />
    </label>
    <form id="recipeForm">
      <label>标题<input name="title" required /></label>
      <label>描述<textarea name="description"></textarea></label>
      <label>预算分<input name="budgetCents" type="number" min="0" value="2000" required /></label>
      <label>耗时分钟<input name="cookMinutes" type="number" min="0" value="15" required /></label>
      <label>人数<input name="servings" type="number" min="1" value="1" required /></label>
      <label>难度
        <select name="difficulty">
          <option value="easy">easy</option>
          <option value="normal">normal</option>
          <option value="hard">hard</option>
        </select>
      </label>
      <label>标签，逗号分隔<input name="tags" value="一人食,下饭" /></label>
      <label>食材，每行一个<textarea name="ingredients" required></textarea></label>
      <label>步骤，每行一个<textarea name="steps" required></textarea></label>
      <label>提示<textarea name="tips"></textarea></label>
      <label>状态
        <select name="status">
          <option value="draft">draft</option>
          <option value="published">published</option>
        </select>
      </label>
      <button type="submit">保存菜谱</button>
    </form>
    <p id="status" role="status"></p>
  </main>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Write `admin/styles.css`**

Create:

```css
body {
  margin: 0;
  background: #f6f7f4;
  color: #1f2a26;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

main {
  width: min(720px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 32px 0;
}

h1 {
  font-size: 28px;
}

form,
label {
  display: grid;
  gap: 8px;
}

form {
  gap: 16px;
  margin-top: 24px;
}

input,
textarea,
select {
  border: 1px solid #d9dfda;
  border-radius: 8px;
  padding: 10px 12px;
  font: inherit;
}

textarea {
  min-height: 84px;
}

button {
  border: 0;
  border-radius: 8px;
  padding: 12px 14px;
  background: #2f8067;
  color: #fff;
  font: inherit;
  font-weight: 700;
}

#status {
  color: #2f8067;
  min-height: 24px;
}
```

- [ ] **Step 6: Run admin test**

Run:

```bash
npx vitest run eat-card/admin/admin.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit admin UI**

Run:

```bash
git add eat-card/admin
git commit -m "feat: add eat card admin ui"
```

Expected: commit succeeds.

---

### Task 10: Add Netlify Configuration And Final Docs

**Files:**
- Create: `eat-card/netlify.toml`
- Modify: `eat-card/docs/setup.md`
- Modify: `eat-card/docs/release-checklist.md`

- [ ] **Step 1: Write `eat-card/netlify.toml`**

Create:

```toml
[build]
  publish = "admin"
  functions = "api"

[functions]
  node_bundler = "esbuild"
```

- [ ] **Step 2: Add local development note to setup docs**

Append to `eat-card/docs/setup.md`:

```markdown

## Local API Testing

Run focused Vitest suites from the repository root:

```bash
npx vitest run eat-card/api-tests
```

For Netlify local development, run from `eat-card/` after installing Netlify CLI:

```bash
netlify dev
```

Do not install or use paid services without reviewing `docs/costs.md`.
```

- [ ] **Step 3: Add final release note**

Append to `eat-card/docs/release-checklist.md`:

```markdown

## Before Submitting To WeChat Review

- Confirm the request domain works on a real device.
- Confirm no Supabase service key appears in mini program source.
- Confirm admin token is not committed.
- Confirm the app category does not require paid verification for the current MVP.
```

- [ ] **Step 4: Run full tests**

Run:

```bash
npm test -- eat-card
```

Expected: all `eat-card` Vitest tests pass.

- [ ] **Step 5: Run status check**

Run:

```bash
git status --short
```

Expected: only intended `eat-card/` files are modified or untracked.

- [ ] **Step 6: Commit configuration and docs**

Run:

```bash
git add eat-card/netlify.toml eat-card/docs
git commit -m "docs: add eat card deployment notes"
```

Expected: commit succeeds.

---

### Task 11: Manual Verification In WeChat Developer Tools

**Files:**
- No code files required unless manual testing reveals a defect.

- [ ] **Step 1: Prepare mini program environment**

Copy `eat-card/miniprogram/env.example.js` to `eat-card/miniprogram/env.js` and set the deployed or local API base URL:

```js
module.exports = {
  API_BASE_URL: 'https://your-site.netlify.app/.netlify/functions'
};
```

Do not commit `env.js` if it contains a real deployment URL that should stay local.

- [ ] **Step 2: Import into WeChat Developer Tools**

Open WeChat Developer Tools and import:

```text
eat-card/miniprogram
```

Expected: project opens without page registration errors.

- [ ] **Step 3: Run mini program smoke test**

Verify:

- Home page loads.
- Tap `抽一张`.
- Recipe card appears.
- Tap recipe card.
- Detail page loads.
- Tap favorite.
- Open Favorites tab.
- Favorite appears.
- Remove favorite.
- Favorites empty state appears.

- [ ] **Step 4: Update checklist**

If all manual checks pass, mark the corresponding items in `eat-card/docs/test-checklist.md` during implementation or note results in the final response.

---

## Plan Self-Review

- Spec coverage: The plan covers folder structure, Supabase schema/seed, Netlify Functions, admin UI, native mini program pages, local favorites, setup docs, cost triggers, tests, and release checklist.
- Scope control: The plan avoids AI, payment, cloud storage, user accounts, and paid packs.
- Paid resources: The plan requires cost review before paid providers, custom domain, payment, storage, or AI.
- Type consistency: API response names use `budgetCents`, `cookMinutes`, `servings`, `difficulty`, `tags`, and `tips` across functions, mini program, and admin.
- Known manual dependency: WeChat Developer Tools verification is manual and cannot be fully automated in this repository.
