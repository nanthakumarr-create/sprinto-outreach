-- Sprinto outreach pipeline schema (Supabase "universal" project, prefixed sprinto_)
create table if not exists sprinto_rubric (
  id serial primary key,
  version int not null,
  active boolean not null default true,
  config jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists sprinto_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  domains text[] not null,
  auto_send boolean not null default true,
  status text not null default 'running',
  rubric_version int
);
create table if not exists sprinto_companies (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references sprinto_runs(id) on delete cascade,
  domain text not null,
  status text not null default 'queued',
  current_step text,
  name text,
  scrape jsonb,
  facts jsonb,
  qualification jsonb,
  score numeric,
  decision text,
  contact jsonb,
  pains jsonb,
  email jsonb,
  sent_at timestamptz,
  message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sprinto_companies_run_idx on sprinto_companies(run_id);
create table if not exists sprinto_events (
  id bigserial primary key,
  company_id uuid references sprinto_companies(id) on delete cascade,
  step text not null,
  level text not null default 'info',
  message text not null,
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sprinto_events_company_idx on sprinto_events(company_id);
create table if not exists sprinto_contact_cache (
  domain text primary key,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table sprinto_rubric enable row level security;
alter table sprinto_runs enable row level security;
alter table sprinto_companies enable row level security;
alter table sprinto_events enable row level security;
alter table sprinto_contact_cache enable row level security;
