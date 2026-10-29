-- Tambola schema for Supabase. Paste into: Supabase Dashboard > SQL Editor > Run.
-- All access happens server-side with the service role key; RLS is enabled with
-- no policies so the public (anon) key cannot read or write anything.

create extension if not exists "pgcrypto";

-- ---------- Player user IDs: acc001, acc002, ... acc999, acc1000 ----------
create sequence if not exists player_seq start 1;

create or replace function next_user_id() returns text
language sql as $$
  select 'acc' || (
    select case when n < 1000 then lpad(n::text, 3, '0') else n::text end
    from (select nextval('player_seq') as n) s
  );
$$;

-- ---------- Tables ----------
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null unique default next_user_id(),
  name        text not null,
  email       text not null,
  phone       text,
  num_tickets int  not null check (num_tickets between 1 and 3),
  success_sent_email_1 boolean not null default false,  -- ticked once the registration e-mail (user-id) was sent
  created_at  timestamptz not null default now()
);

-- Existing databases: the old `email_sent` column becomes `success_sent_email_1` (keeps the ticks already set).
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'players' and column_name = 'email_sent')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'players' and column_name = 'success_sent_email_1') then
    alter table players rename column email_sent to success_sent_email_1;
  end if;
end $$;
alter table players add column if not exists success_sent_email_1 boolean not null default false;

create table if not exists tickets (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  ticket_no  int  not null,
  grid       jsonb not null,            -- 3 rows x 9 cols, 0 = blank cell
  signature  text not null unique,      -- guarantees no two tickets are identical
  marked     int[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists tickets_player_idx on tickets(player_id);

-- Prize titles won in a round. First to cross wins; once taken a title is closed for everyone else.
-- Only full_house has up to 3 winning tickets (positions 1..3); every other title has a single winner.
create table if not exists claims (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (title in ('early_five','top_line','middle_line','bottom_line','full_house')),
  position   int  not null check (position between 1 and 3),
  player_id  uuid not null references players(id) on delete cascade,
  ticket_id  uuid not null references tickets(id) on delete cascade,
  at_call    int  not null default 0,   -- how many numbers had been called when it was won
  created_at timestamptz not null default now(),
  unique (title, position),             -- a slot can only be taken once (race-safe)
  unique (title, ticket_id),            -- a ticket can win a title only once
  check (title = 'full_house' or position = 1)
);

create table if not exists game_state (
  id             int primary key default 1 check (id = 1),
  status         text not null default 'waiting' check (status in ('waiting','running','finished')),
  called_numbers int[] not null default '{}',
  current_number int,
  updated_at     timestamptz not null default now()
);
insert into game_state (id) values (1) on conflict do nothing;

-- ---------- Atomic number draw ----------
create or replace function draw_number() returns int
language plpgsql as $$
declare
  st game_state%rowtype;
  remaining int[];
  n int;
begin
  select * into st from game_state where id = 1 for update;
  if st.status = 'finished' then
    raise exception 'Game is finished';
  end if;

  select array_agg(x) into remaining
  from generate_series(1, 90) x
  where x <> all (st.called_numbers);

  if remaining is null then
    raise exception 'All 90 numbers have been drawn';
  end if;

  n := remaining[1 + floor(random() * array_length(remaining, 1))::int];

  update game_state
     set called_numbers = called_numbers || n,
         current_number = n,
         status = 'running',
         updated_at = now()
   where id = 1;
  return n;
end $$;

-- ---------- Lock everything down ----------
alter table players    enable row level security;
alter table tickets    enable row level security;
alter table game_state enable row level security;
alter table claims     enable row level security;

revoke all on function draw_number()  from public, anon, authenticated;
revoke all on function next_user_id() from public, anon, authenticated;
grant execute on function draw_number()  to service_role;
grant execute on function next_user_id() to service_role;
