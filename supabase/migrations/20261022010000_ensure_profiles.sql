-- Users who signed up before the profiles trigger existed have no profile row,
-- which breaks the group_members -> profiles foreign key.

insert into public.profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

create function public.ensure_profile()
returns void
language sql
security definer set search_path = ''
as $$
  insert into public.profiles (id, display_name)
  select u.id, coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do nothing;
$$;

revoke execute on function public.ensure_profile() from public, anon;

create or replace function public.create_group(group_name text)
returns public.groups
language plpgsql
security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.ensure_profile();
  insert into public.groups (name, created_by) values (group_name, auth.uid()) returning * into g;
  insert into public.group_members (group_id, user_id, role) values (g.id, auth.uid(), 'owner');
  return g;
end;
$$;

create or replace function public.join_group(code text)
returns public.groups
language plpgsql
security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.ensure_profile();
  select * into g from public.groups where invite_code = upper(trim(code));
  if g.id is null then
    raise exception 'No group found for that invite code';
  end if;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid())
  on conflict do nothing;
  return g;
end;
$$;
