-- Email Summary is isolated from the clinical learning data.
-- The app accesses these tables only from server routes with the service role key.
create table if not exists public.email_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'gmail' check (provider = 'gmail'),
  email_address text not null unique,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_summaries (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.email_connections(id) on delete cascade,
  summary_date date not null,
  generated_at timestamptz not null default now(),
  source_messages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_messages) = 'array'),
  summary_json jsonb not null
    check (jsonb_typeof(summary_json) = 'object'),
  unique (connection_id)
);

create index if not exists email_summaries_connection_generated_idx
  on public.email_summaries (connection_id, generated_at desc);

alter table public.email_connections enable row level security;
alter table public.email_summaries enable row level security;

-- No browser role may read tokens or saved message snippets.
revoke all on public.email_connections from anon, authenticated;
revoke all on public.email_summaries from anon, authenticated;
grant select, insert, update, delete on public.email_connections to service_role;
grant select, insert, update, delete on public.email_summaries to service_role;
