-- Spy Pubs : table des publicités mises en favoris par l'utilisateur
create table if not exists public.spy_pub_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ad_id text not null,
  ad_data jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, ad_id)
);

alter table public.spy_pub_favorites enable row level security;

create policy "spy_pub_favorites_own"
  on public.spy_pub_favorites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
