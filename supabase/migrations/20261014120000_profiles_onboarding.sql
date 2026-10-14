-- Task 5.1 onboarding (DEC-042): remember that onboarding was finished or skipped, and what the
-- player mostly plays (pre-fills the first session). Existing users are not back-filled: they see
-- onboarding once and can skip it.

alter table public.profiles
  add column onboarded_at timestamptz,
  add column play_mode    text check (play_mode in ('live', 'online')),
  add column play_kind    text check (play_kind in ('cash', 'mtt'));

-- profiles uses column grants (users cannot change their own plan): add the new columns.
grant select (onboarded_at, play_mode, play_kind) on public.profiles to authenticated;
grant update (onboarded_at, play_mode, play_kind) on public.profiles to authenticated;
