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
