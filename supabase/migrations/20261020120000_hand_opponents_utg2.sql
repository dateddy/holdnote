-- 5.1c-5: tables of 2-10 players need the seat UTG+2, and a hand can follow several opponents.
-- hands already has RLS (user_id = auth.uid()); a new column needs no new policy.

-- Drop the old position checks (names are generated), then add ones that include 'UTG+2'.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
    where con.conrelid = 'public.hands'::regclass
      and con.contype = 'c'
      and a.attname in ('hero_pos', 'villain_pos')
  loop
    execute format('alter table public.hands drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.hands
  add constraint hands_hero_pos_check check (
    hero_pos in ('UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB')
  ),
  add constraint hands_villain_pos_check check (
    villain_pos in ('UTG', 'UTG+1', 'UTG+2', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB')
  );

-- Opponents followed in the hand, in the order they were picked, main opponent included:
-- [{ "pos": "BTN", "stack": 20000, "opponent_id": "<uuid>" }]. villain_* keep the main opponent.
alter table public.hands
  add column opponents jsonb not null default '[]'
    check (jsonb_typeof(opponents) = 'array');
