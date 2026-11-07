-- Run in the Supabase SQL editor. Row Level Security keeps each student's logs private.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  training_consent boolean not null default false,   -- off until the student turns it on
  updated_at timestamptz not null default now()
);

create table if not exists public.interactions (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  ts timestamptz not null default now(),
  kind text not null,                 -- model_output | student_input | feedback
  provider text not null,             -- gemini | own_model | human
  model text default '',
  task text default '',
  prompt text default '',
  response text default '',
  consent boolean not null default false,
  source_rights text not null default 'unknown',
  source_ref text default '',
  feedback text,
  latency_ms int default 0,
  meta jsonb not null default '{}',
  policy_version int not null default 1
);
create index if not exists interactions_user_ts on public.interactions (user_id, ts desc);

alter table public.profiles enable row level security;
alter table public.interactions enable row level security;

create policy "own profile" on public.profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "read own logs" on public.interactions for select using (user_id = auth.uid());
create policy "delete own logs" on public.interactions for delete using (user_id = auth.uid());
-- Inserts come from the server with the service key, never from the browser.
