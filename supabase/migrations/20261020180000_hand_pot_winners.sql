-- 5.1c-6b: who won each pot when the cards did not decide it (multiway / side pots).
-- One entry per pot, main pot first: an array of seats (["BTN"], or ["BTN","CO"] for a split),
-- or null while that pot had no winner picked. Empty array = nothing picked (or heads-up).
alter table public.hands
  add column pot_winners jsonb not null default '[]'
    check (jsonb_typeof(pot_winners) = 'array');
