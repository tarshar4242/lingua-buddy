create table if not exists public.learning_states (
  owner_id text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.learning_states enable row level security;

drop policy if exists "single owner read" on public.learning_states;
drop policy if exists "single owner write" on public.learning_states;
drop policy if exists "single owner update" on public.learning_states;

create policy "single owner read"
on public.learning_states
for select
to anon
using (owner_id = 'my-phone-learning');

create policy "single owner write"
on public.learning_states
for insert
to anon
with check (owner_id = 'my-phone-learning');

create policy "single owner update"
on public.learning_states
for update
to anon
using (owner_id = 'my-phone-learning')
with check (owner_id = 'my-phone-learning');
