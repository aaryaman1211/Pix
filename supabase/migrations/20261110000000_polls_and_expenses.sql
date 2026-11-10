-- Outing polls and split-the-bill. Purely additive: new tables only, no existing table is changed.
-- Same access model as the rest of Pix: everything belongs to a group and is checked with is_group_member().

-- ---------------------------------------------------------------------------
-- Outing polls: someone proposes a few places, the group votes (one vote each, changeable while open).
-- ---------------------------------------------------------------------------
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  status text not null default 'open' check (status in ('open', 'closed')),
  winner_option_id uuid, -- set when the poll is closed
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index polls_group_idx on public.polls (group_id, created_at desc);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  place_id text not null,
  name text not null,
  address text,
  locality text,
  primary_type text,
  types text[] not null default '{}',
  price_level smallint check (price_level between 0 and 4),
  lat double precision,
  lng double precision,
  unique (poll_id, place_id)
);

create index poll_options_poll_idx on public.poll_options (poll_id);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Split the bill: amounts are whole paise (integers) to avoid rounding drift.
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  amount_minor bigint not null check (amount_minor > 0),
  paid_by uuid not null references auth.users (id),
  spent_on date not null default current_date,
  memory_id uuid references public.memories (id) on delete set null,
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index expenses_group_idx on public.expenses (group_id, spent_on desc);

-- What each person owes for an expense (the shares add up to the expense amount).
create table public.expense_shares (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  share_minor bigint not null check (share_minor >= 0),
  primary key (expense_id, user_id)
);

-- "I paid you back": moves the balance between two members.
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user uuid not null references auth.users (id),
  to_user uuid not null references auth.users (id),
  amount_minor bigint not null check (amount_minor > 0),
  created_by uuid not null references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create index settlements_group_idx on public.settlements (group_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlements enable row level security;

-- polls: members read; the creator edits (closes) or deletes
create policy "members read" on public.polls
  for select to authenticated using (public.is_group_member(group_id));
create policy "members insert" on public.polls
  for insert to authenticated with check (public.is_group_member(group_id) and created_by = auth.uid());
create policy "creator updates" on public.polls
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid() and public.is_group_member(group_id));
create policy "creator deletes" on public.polls
  for delete to authenticated using (created_by = auth.uid());

-- poll options: only the poll's creator adds them, to a poll in the same group
create policy "members read" on public.poll_options
  for select to authenticated using (public.is_group_member(group_id));
create policy "creator adds options" on public.poll_options
  for insert to authenticated with check (
    public.is_group_member(group_id)
    and exists (
      select 1 from public.polls p
      where p.id = poll_id and p.group_id = poll_options.group_id and p.created_by = auth.uid()
    )
  );

-- votes: vote as yourself, on an open poll, for one of its options; change or withdraw your own
create policy "members read" on public.poll_votes
  for select to authenticated using (public.is_group_member(group_id));
create policy "vote as self" on public.poll_votes
  for insert to authenticated with check (
    public.is_group_member(group_id)
    and user_id = auth.uid()
    and exists (select 1 from public.polls p where p.id = poll_id and p.group_id = poll_votes.group_id and p.status = 'open')
    and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = poll_votes.poll_id)
  );
create policy "change own vote" on public.poll_votes
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.polls p where p.id = poll_id and p.status = 'open')
    and exists (select 1 from public.poll_options o where o.id = option_id and o.poll_id = poll_votes.poll_id)
  );
create policy "withdraw own vote" on public.poll_votes
  for delete to authenticated using (user_id = auth.uid());

-- expenses: members read and add; whoever added one can delete it
create policy "members read" on public.expenses
  for select to authenticated using (public.is_group_member(group_id));
create policy "members insert" on public.expenses
  for insert to authenticated with check (
    public.is_group_member(group_id)
    and created_by = auth.uid()
    and exists (select 1 from public.group_members m where m.group_id = expenses.group_id and m.user_id = paid_by)
  );
create policy "creator deletes" on public.expenses
  for delete to authenticated using (created_by = auth.uid());

create policy "members read" on public.expense_shares
  for select to authenticated using (public.is_group_member(group_id));
create policy "creator adds shares" on public.expense_shares
  for insert to authenticated with check (
    public.is_group_member(group_id)
    and exists (select 1 from public.group_members m where m.group_id = expense_shares.group_id and m.user_id = expense_shares.user_id)
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id and e.group_id = expense_shares.group_id and e.created_by = auth.uid()
    )
  );

-- settlements: you record your own payments
create policy "members read" on public.settlements
  for select to authenticated using (public.is_group_member(group_id));
create policy "pay as self" on public.settlements
  for insert to authenticated with check (
    public.is_group_member(group_id)
    and created_by = auth.uid()
    and from_user = auth.uid()
    and exists (select 1 from public.group_members m where m.group_id = settlements.group_id and m.user_id = to_user)
  );
create policy "creator deletes" on public.settlements
  for delete to authenticated using (created_by = auth.uid());
