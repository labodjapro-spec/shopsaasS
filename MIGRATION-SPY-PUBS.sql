-- ============================================================
-- MIGRATION 0023 : Table des favoris Spy Pubs
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists public.spy_pub_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ad_id text not null,
  ad_data jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, ad_id)
);

alter table public.spy_pub_favorites enable row level security;

-- Politique : chaque utilisateur ne voit et modifie que ses propres favoris
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'spy_pub_favorites'
    and policyname = 'spy_pub_favorites_own'
  ) then
    create policy "spy_pub_favorites_own"
      on public.spy_pub_favorites
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;
