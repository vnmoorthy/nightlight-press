create table if not exists orders (
  id text primary key,
  created_at timestamptz not null default now(),
  kind text not null default 'custom',
  buyer_name text, buyer_email text, buyer_phone text,
  child_name text not null, child_age int, pronoun text not null default 'they', look text,
  favorites text, occasion text, language text not null default 'en', style text not null default 'watercolor',
  read_to_name text, read_to_phone text,
  status text not null default 'ordered',
  paid_mode text, amount_cents int not null default 1900, captured_cents int not null default 0,
  stripe_customer_id text, checkout_session_id text, payment_intent text,
  book_id text, template_book_id text, source text not null default 'web'
);
create table if not exists books (
  id text primary key,
  created_at timestamptz not null default now(),
  order_id text, kind text not null default 'custom',
  title text, dedication text, hero_name text, look text, style text, language text, age int,
  story jsonb, checks jsonb, status text not null default 'writing',
  cover_media_id text, pdf_media_id text, ready_at timestamptz,
  public boolean not null default false, price_cents int not null default 0, blurb text, posted jsonb, revision int not null default 0
);
create table if not exists pages (
  id text primary key, book_id text not null, idx int not null, text text, scene text, prompt text,
  image_media_id text, audio_media_id text, unique(book_id, idx)
);
create table if not exists messages (
  id text primary key, order_id text, channel text not null, direction text not null, counterparty text,
  subject text, body text, provider_id text, created_at timestamptz not null default now()
);
create table if not exists ledger (
  seq bigserial primary key, created_at timestamptz not null default now(), order_id text,
  kind text not null, actor text not null, detail jsonb not null, prev_hash text not null, hash text not null
);
create table if not exists interventions (
  id bigserial primary key, created_at timestamptz not null default now(), order_id text, who text not null, what text not null, why text
);
create table if not exists subscribers (email text primary key, created_at timestamptz not null default now(), source text);
create table if not exists jobs (
  id bigserial primary key, kind text not null, order_id text, book_id text, page_id text,
  status text not null default 'queued', step int not null default 0, ref text,
  payload jsonb not null default '{}', result jsonb, errors int not null default 0, polls int not null default 0,
  next_run_at timestamptz not null default now(), lease_until timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), error text
);
create index if not exists jobs_due on jobs(status, next_run_at);
create table if not exists media (
  id text primary key, order_id text, kind text not null, mime text not null, bytes bytea, url text, naive_file_id text,
  meta jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists agent_runs (
  id text primary key, agent text not null, job_id bigint, order_id text, purpose text,
  started_at timestamptz not null default now(), ended_at timestamptz, status text not null default 'running',
  cost_micro_usd bigint not null default 0, summary text
);
create table if not exists kv (k text primary key, v jsonb, updated_at timestamptz not null default now());
