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
  email_sent  boolean not null default false,
  created_at  timestamptz not null default now()
);

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

revoke all on function draw_number()  from public, anon, authenticated;
revoke all on function next_user_id() from public, anon, authenticated;
grant execute on function draw_number()  to service_role;
grant execute on function next_user_id() to service_role;
