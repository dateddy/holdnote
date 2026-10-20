-- 5.1c-3: the tournament level a hand was played at (Lv 8 in "Lv 8 · 300/600 (600)").
-- Null for cash hands and for hands saved before levels were tracked.
-- The blind structure itself lives in sessions.mtt.blind_levels (jsonb), no column needed (DEC-045).
-- hands already has RLS (user_id = auth.uid()); a new column is covered by the same policies.
alter table public.hands
  add column level smallint check (level > 0);
