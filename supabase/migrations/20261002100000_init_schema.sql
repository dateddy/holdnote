-- HoldNote initial schema (spec section 4).
-- Agreed changes vs spec: ante columns on sessions/hands, sessions.currency,
-- user_api_keys.vault_secret_id instead of key_encrypted.
--
-- Every user table is owned via user_id -> auth.users (cascade) and protected by RLS.
-- Composite foreign keys (x_id, user_id) make sure rows can only point at the same user's rows.

-- ============ helpers ============
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Cards like 'Ah', 'K?'; at most max_len of them.
create function public.valid_cards(cards text[], max_len int) returns boolean
language sql immutable set search_path = '' as $$
  select cards is null or (
    coalesce(array_length(cards, 1), 0) <= max_len
    and not exists (select 1 from unnest(cards) c where c !~ '^[2-9TJQKA][shdc?]$')
  )
$$;

-- ============ profiles ============
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale       text not null default 'vi' check (locale in ('vi', 'en', 'zh')),
  currency     text not null default 'VND' check (currency in ('VND', 'USD', 'EUR', 'KRW', 'JPY', 'THB', 'CHIP')),
  display_unit text not null default 'money' check (display_unit in ('money', 'bb')),
  entry_mode   text not null default 'buttons' check (entry_mode in ('buttons', 'shorthand')),
  plan         text not null default 'free' check (plan in ('free', 'byok', 'pro')),
  created_at   timestamptz not null default now()
);

-- Profile row for every new auth user. Locale from sign-up metadata if valid.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name',
             split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'locale' in ('vi', 'en', 'zh')
         then new.raw_user_meta_data ->> 'locale' else 'vi' end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ opponents ============
create table public.opponents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  player_type text check (player_type in ('nit', 'tag', 'lag', 'station', 'maniac', 'unknown')),
  venue       text,
  notes       text,
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index opponents_user_name on public.opponents (user_id, name);

-- ============ sessions ============
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('cash', 'mtt')),
  mode        text not null check (mode in ('live', 'online')),
  venue       text,
  date        date not null default current_date,
  start_at    timestamptz,
  end_at      timestamptz,
  currency    text not null check (currency in ('VND', 'USD', 'EUR', 'KRW', 'JPY', 'THB', 'CHIP')),
  stake_label text,
  sb          numeric(14,2) check (sb >= 0),
  bb          numeric(14,2) check (bb > 0),
  straddle    numeric(14,2) check (straddle > 0),
  ante_mode   text not null default 'none' check (ante_mode in ('none', 'each', 'bb')),
  ante        numeric(14,2) check (ante >= 0),
  seats       smallint check (seats between 2 and 10),
  buyin       numeric(14,2),
  cashout     numeric(14,2),
  stop_loss   numeric(14,2),
  table_read  jsonb not null default '{}',
  self_state  text,
  mtt         jsonb, -- name, type, re-entry, start level, place, entries, prize, bust stage
  summary     jsonb, -- grade, good points, leak_tags[], next rules, notes
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index sessions_user_date on public.sessions (user_id, date desc);

-- Session currency defaults to the profile currency when the client sends none.
create function public.sessions_default_currency() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.currency is null then
    select p.currency into new.currency from public.profiles p where p.id = new.user_id;
  end if;
  return new;
end $$;

create trigger sessions_currency before insert on public.sessions
  for each row execute function public.sessions_default_currency();

-- ============ hands ============
create table public.hands (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id    uuid not null,
  num           integer not null check (num > 0),
  hero_cards    text[] check (public.valid_cards(hero_cards, 2)),
  board         text[] check (public.valid_cards(board, 5)),
  villain_cards text[] check (public.valid_cards(villain_cards, 2)),
  hero_pos      text check (hero_pos in ('UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB')),
  villain_pos   text check (villain_pos in ('UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB')),
  opponent_id   uuid,
  actions       jsonb not null default '[]' check (jsonb_typeof(actions) = 'array'),
  raw_line      text,
  outcome       text check (outcome in ('win', 'lose', 'fold', 'split')),
  result        numeric(14,2),
  pot_final     numeric(14,2),
  hero_stack    numeric(14,2),
  villain_stack numeric(14,2),
  eff_stack     numeric(14,2),
  level_bb      numeric(14,2), -- MTT: bb of this hand's level
  ante_mode     text check (ante_mode in ('none', 'each', 'bb')), -- null = session default
  ante          numeric(14,2) check (ante >= 0),
  players_dealt smallint check (players_dealt between 2 and 10),
  stage         text,
  players_left  integer,
  thought       text,
  question      text,
  flagged       boolean not null default false,
  tags          text[] not null default '{}',
  missing_data  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),
  unique (session_id, num),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade,
  foreign key (opponent_id, user_id) references public.opponents (id, user_id)
    on delete set null (opponent_id)
);
create index hands_user_session on public.hands (user_id, session_id);
create index hands_opponent on public.hands (opponent_id) where opponent_id is not null;

-- ============ reviews ============
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hand_id    uuid not null,
  source     text not null check (source in ('manual', 'ai')),
  model      text,
  range_text text,
  math_text  text,
  line_text  text,
  icm_text   text,
  error_tags text[] not null default '{}',
  ev_verdict text check (ev_verdict in ('correct', 'mistake', 'unsure')),
  lesson     text,
  accepted   boolean not null default false,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (hand_id, user_id) references public.hands (id, user_id) on delete cascade
);
create unique index reviews_one_current on public.reviews (hand_id) where is_current;

-- ============ user_rules ============
create table public.user_rules (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text              text not null,
  source_session_id uuid,
  active            boolean not null default true,
  sort              integer not null default 0,
  foreign key (source_session_id, user_id) references public.sessions (id, user_id)
    on delete set null (source_session_id)
);
create index user_rules_user on public.user_rules (user_id, sort);

-- ============ ai_usage (written by the server only) ============
create table public.ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('hand_review', 'rebuttal', 'session_summary')),
  model      text not null,
  tokens_in  integer not null default 0,
  tokens_out integer not null default 0,
  cost_usd   numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_user_month on public.ai_usage (user_id, created_at desc);

-- ============ user_api_keys (the key itself lives in Vault) ============
create table public.user_api_keys (
  user_id         uuid not null references auth.users (id) on delete cascade,
  provider        text not null check (provider in ('openrouter')),
  vault_secret_id uuid not null,
  created_at      timestamptz not null default now(),
  primary key (user_id, provider)
);

-- ============ updated_at ============
create trigger sessions_updated_at before update on public.sessions
  for each row execute function public.set_updated_at();
create trigger hands_updated_at before update on public.hands
  for each row execute function public.set_updated_at();
create trigger opponents_updated_at before update on public.opponents
  for each row execute function public.set_updated_at();

-- ============ leak view (spec 4.3), runs with the caller's RLS ============
create view public.leak_stats with (security_invoker = true) as
  select h.user_id, h.session_id, s.date as session_date, t.tag,
         'review'::text as source, count(distinct h.id)::int as hand_count
  from public.reviews r
  join public.hands h on h.id = r.hand_id
  join public.sessions s on s.id = h.session_id
  cross join lateral unnest(r.error_tags) as t(tag)
  where r.is_current and t.tag <> 'none'
  group by h.user_id, h.session_id, s.date, t.tag
  union all
  select s.user_id, s.id, s.date, t.tag, 'summary'::text, 0
  from public.sessions s
  cross join lateral jsonb_array_elements_text(coalesce(s.summary -> 'leak_tags', '[]')) as t(tag);

-- ============ RLS ============
alter table public.profiles      enable row level security;
alter table public.opponents     enable row level security;
alter table public.sessions      enable row level security;
alter table public.hands         enable row level security;
alter table public.reviews       enable row level security;
alter table public.user_rules    enable row level security;
alter table public.ai_usage      enable row level security;
alter table public.user_api_keys enable row level security;

create policy profiles_own_read on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy opponents_own on public.opponents for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy sessions_own on public.sessions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy hands_own on public.hands for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reviews_own on public.reviews for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_rules_own on public.user_rules for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_usage_own_read on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_api_keys_own_read on public.user_api_keys for select to authenticated
  using (user_id = (select auth.uid()));

-- ============ grants ============
-- No anonymous access at all (no trial mode).
revoke all on all tables in schema public from anon;
revoke all on public.profiles, public.ai_usage, public.user_api_keys from authenticated;

grant select, insert, update, delete on public.opponents, public.sessions, public.hands,
  public.reviews, public.user_rules to authenticated;
grant select on public.leak_stats, public.ai_usage to authenticated;
-- Users cannot change their own plan.
grant select (id, display_name, locale, currency, display_unit, entry_mode, plan, created_at)
  on public.profiles to authenticated;
grant update (display_name, locale, currency, display_unit, entry_mode)
  on public.profiles to authenticated;
-- The Vault reference never reaches the client.
grant select (user_id, provider, created_at) on public.user_api_keys to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
