-- Group activity push notifications.
--
-- Phones register an Expo push token in push_tokens. When something happens in a group (a place
-- is added or visited, a memory or date is added, someone joins), a trigger pings the `notify`
-- edge function with the row's key. The function re-reads the row with the service role, so the
-- ping carries no trust: it can only cause the one notification that row warrants, once (see
-- notified_events).

create extension if not exists pg_net with schema extensions;

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  platform text,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
create policy "own tokens read" on public.push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "own tokens insert" on public.push_tokens
  for insert to authenticated with check (user_id = auth.uid());
create policy "own tokens update" on public.push_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tokens delete" on public.push_tokens
  for delete to authenticated using (user_id = auth.uid());

-- One row per event already notified. Only the service role touches it.
create table public.notified_events (
  key text primary key,
  created_at timestamptz not null default now()
);
alter table public.notified_events enable row level security;

-- The project's public anon key (the same one every copy of the app ships with). It only gets the
-- ping past the edge function's JWT check; the function itself trusts nothing in the request.
create function public.ping_notify()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://qcpactekxpufewanpenh.supabase.co/functions/v1/notify',
    body := jsonb_build_object('table', tg_table_name, 'op', tg_op, 'record', to_jsonb(new)),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcGFjdGVreHB1ZmV3YW5wZW5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NDM2OTEsImV4cCI6MjEwODIxOTY5MX0._60PcDtiQeMEUhEX3gHt0VXFRlwtUxQcyiV8Ls12ZRs'
    )
  );
  return new;
end;
$$;

create trigger notify_place_added after insert on public.saved_places
  for each row execute function public.ping_notify();
create trigger notify_place_visited after update of status on public.saved_places
  for each row when (old.status = 'want' and new.status = 'visited') execute function public.ping_notify();
create trigger notify_memory_added after insert on public.memories
  for each row execute function public.ping_notify();
create trigger notify_date_added after insert on public.important_dates
  for each row execute function public.ping_notify();
create trigger notify_member_joined after insert on public.group_members
  for each row execute function public.ping_notify();
