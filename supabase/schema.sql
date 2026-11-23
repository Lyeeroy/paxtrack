-- Tracker cloud-sync schema for Supabase.
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste
-- this file -> Run. It is idempotent, so running it again is safe.

create table if not exists public.tracked_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  data jsonb not null,
  updated_at bigint not null,
  server_ts bigint not null default 0,
  deleted boolean not null default false,
  primary key (user_id, item_id)
);

comment on table public.tracked_items is
  'One row per tracked title per user. data is the full client-side Item JSON.';

-- The client pulls changes ordered by server_ts.
create index if not exists tracked_items_user_server_ts_idx
  on public.tracked_items (user_id, server_ts);

-- server_ts is a server-assigned cursor in microseconds. Clients never send
-- it, and it changes on every write so other devices can pull the row.
create or replace function public.set_tracked_item_server_ts()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.server_ts := (extract(epoch from clock_timestamp()) * 1000000)::bigint;
  return new;
end;
$$;

drop trigger if exists tracked_items_server_ts on public.tracked_items;
create trigger tracked_items_server_ts
  before insert or update on public.tracked_items
  for each row
  execute function public.set_tracked_item_server_ts();

-- Last-write-wins per title. Two devices can push at the same time; an
-- upsert that is not newer than the stored row is ignored instead of
-- overwriting a newer edit with a stale one.
create or replace function public.ignore_stale_tracked_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.updated_at <= old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists tracked_items_lww on public.tracked_items;
create trigger tracked_items_lww
  before update on public.tracked_items
  for each row
  execute function public.ignore_stale_tracked_item();

alter table public.tracked_items enable row level security;

drop policy if exists "Users can read their own tracked items" on public.tracked_items;
create policy "Users can read their own tracked items"
  on public.tracked_items
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own tracked items" on public.tracked_items;
create policy "Users can insert their own tracked items"
  on public.tracked_items
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own tracked items" on public.tracked_items;
create policy "Users can update their own tracked items"
  on public.tracked_items
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own tracked items" on public.tracked_items;
create policy "Users can delete their own tracked items"
  on public.tracked_items
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Belt and braces: signed-out visitors have no access at all.
revoke all on table public.tracked_items from anon;
grant select, insert, update, delete on table public.tracked_items to authenticated;

-- PostgREST caches the schema. Force it to see the table immediately so the
-- app doesn't fail with PGRST205 after this script is run.
notify pgrst, 'reload schema';
