-- Pix: shared places, memories and important dates for couples and friend groups.
-- Everything except profiles belongs to a group; access is checked with is_group_member().

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Groups and membership
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  search_radius_m integer not null default 5000 check (search_radius_m between 500 and 50000),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- security definer so policies on group_members can call it without recursing into themselves
create function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create function public.create_group(group_name text)
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
  insert into public.groups (name, created_by) values (group_name, auth.uid()) returning * into g;
  insert into public.group_members (group_id, user_id, role) values (g.id, auth.uid(), 'owner');
  return g;
end;
$$;

create function public.join_group(code text)
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
  select * into g from public.groups where invite_code = upper(trim(code));
  if g.id is null then
    raise exception 'No group found for that invite code';
  end if;
  insert into public.group_members (group_id, user_id) values (g.id, auth.uid())
  on conflict do nothing;
  return g;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saved places (the shared wishlist)
-- Only the Google place_id is the durable key; the other place fields are a
-- display snapshot that should be refreshed from Google periodically.
-- ---------------------------------------------------------------------------
create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  place_id text not null,
  name text not null,
  address text,
  primary_type text,
  types text[] not null default '{}',
  price_level smallint check (price_level between 0 and 4),
  lat double precision,
  lng double precision,
  status text not null default 'want' check (status in ('want', 'visited')),
  notes text,
  added_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (group_id, place_id)
);

create index saved_places_group_idx on public.saved_places (group_id, status);

-- ---------------------------------------------------------------------------
-- Memories (any date, optionally tied to a place) and their photos
-- ---------------------------------------------------------------------------
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  happened_on date not null default current_date,
  notes text,
  place_id text,
  place_name text,
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index memories_group_idx on public.memories (group_id, happened_on desc);

create table public.memory_photos (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  storage_path text not null unique,
  width integer,
  height integer,
  -- camera-roll identifier on the uploader's device, so they can open the original
  local_asset_id text,
  uploaded_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index memory_photos_memory_idx on public.memory_photos (memory_id);

-- ---------------------------------------------------------------------------
-- Per-person ratings of a place (one per person per place per group)
-- ---------------------------------------------------------------------------
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  place_id text not null,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  unique (group_id, user_id, place_id)
);

-- ---------------------------------------------------------------------------
-- Important dates
-- ---------------------------------------------------------------------------
create table public.important_dates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  date date not null,
  repeats_yearly boolean not null default true,
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index important_dates_group_idx on public.important_dates (group_id);

-- ---------------------------------------------------------------------------
-- Interaction log: training data for the recommendation model.
-- Place features are copied in so the log stays usable after places change.
-- ---------------------------------------------------------------------------
create table public.interactions (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) default auth.uid(),
  place_id text not null,
  action text not null check (action in ('shown', 'view', 'save', 'unsave', 'dismiss', 'visit', 'rate')),
  source text check (source in ('search', 'recommend', 'list')),
  value real,
  place_types text[] not null default '{}',
  price_level smallint,
  google_rating real,
  distance_m real,
  created_at timestamptz not null default now()
);

create index interactions_group_idx on public.interactions (group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.saved_places enable row level security;
alter table public.memories enable row level security;
alter table public.memory_photos enable row level security;
alter table public.ratings enable row level security;
alter table public.important_dates enable row level security;
alter table public.interactions enable row level security;

-- profiles: see yourself and anyone you share a group with
create policy "profiles visible to self and group mates" on public.profiles
  for select to authenticated using (
    id = auth.uid() or exists (
      select 1 from public.group_members a
      join public.group_members b on a.group_id = b.group_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- groups: created via create_group(), joined via join_group()
create policy "members read group" on public.groups
  for select to authenticated using (public.is_group_member(id));
create policy "members update group" on public.groups
  for update to authenticated using (public.is_group_member(id)) with check (public.is_group_member(id));
create policy "owner deletes group" on public.groups
  for delete to authenticated using (created_by = auth.uid());

create policy "members read membership" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));
create policy "leave group" on public.group_members
  for delete to authenticated using (user_id = auth.uid());

-- group-owned content: any member can read and write
create policy "members read" on public.saved_places
  for select to authenticated using (public.is_group_member(group_id));
create policy "members insert" on public.saved_places
  for insert to authenticated with check (public.is_group_member(group_id) and added_by = auth.uid());
create policy "members update" on public.saved_places
  for update to authenticated using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy "members delete" on public.saved_places
  for delete to authenticated using (public.is_group_member(group_id));

create policy "members read" on public.memories
  for select to authenticated using (public.is_group_member(group_id));
create policy "members insert" on public.memories
  for insert to authenticated with check (public.is_group_member(group_id) and created_by = auth.uid());
create policy "members update" on public.memories
  for update to authenticated using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy "members delete" on public.memories
  for delete to authenticated using (public.is_group_member(group_id));

create policy "members read" on public.memory_photos
  for select to authenticated using (public.is_group_member(group_id));
create policy "members insert" on public.memory_photos
  for insert to authenticated with check (public.is_group_member(group_id) and uploaded_by = auth.uid());
create policy "members delete" on public.memory_photos
  for delete to authenticated using (public.is_group_member(group_id));

create policy "members read" on public.ratings
  for select to authenticated using (public.is_group_member(group_id));
create policy "rate as self" on public.ratings
  for insert to authenticated with check (public.is_group_member(group_id) and user_id = auth.uid());
create policy "update own rating" on public.ratings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members read" on public.important_dates
  for select to authenticated using (public.is_group_member(group_id));
create policy "members insert" on public.important_dates
  for insert to authenticated with check (public.is_group_member(group_id) and created_by = auth.uid());
create policy "members update" on public.important_dates
  for update to authenticated using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));
create policy "members delete" on public.important_dates
  for delete to authenticated using (public.is_group_member(group_id));

create policy "members read" on public.interactions
  for select to authenticated using (public.is_group_member(group_id));
create policy "log as self" on public.interactions
  for insert to authenticated with check (public.is_group_member(group_id) and user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Photo storage: private bucket, objects stored at {group_id}/{memory_id}/{file}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-photos', 'memory-photos', false, 5242880, array['image/jpeg']);

create policy "members read photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'memory-photos' and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );
create policy "members upload photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'memory-photos' and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );
create policy "members delete photos" on storage.objects
  for delete to authenticated using (
    bucket_id = 'memory-photos' and public.is_group_member(((storage.foldername(name))[1])::uuid)
  );
