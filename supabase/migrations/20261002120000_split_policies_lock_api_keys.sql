-- RLS audit follow-up (DEC-025, DEC-026).
-- 1. Replace each `for all` owner policy with explicit select/insert/update/delete policies.
--    Same effect, but matches the db-migration checklist and reads clearly in audits.
-- 2. Clients can no longer read user_api_keys at all; the server (secret key) tells the UI
--    whether a key is set.

-- ============ 1. four policies per owned table ============
drop policy opponents_own on public.opponents;
create policy opponents_select_own on public.opponents for select to authenticated
  using (user_id = (select auth.uid()));
create policy opponents_insert_own on public.opponents for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy opponents_update_own on public.opponents for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy opponents_delete_own on public.opponents for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy sessions_own on public.sessions;
create policy sessions_select_own on public.sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy sessions_insert_own on public.sessions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy sessions_update_own on public.sessions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy sessions_delete_own on public.sessions for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy hands_own on public.hands;
create policy hands_select_own on public.hands for select to authenticated
  using (user_id = (select auth.uid()));
create policy hands_insert_own on public.hands for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy hands_update_own on public.hands for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy hands_delete_own on public.hands for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy reviews_own on public.reviews;
create policy reviews_select_own on public.reviews for select to authenticated
  using (user_id = (select auth.uid()));
create policy reviews_insert_own on public.reviews for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy reviews_update_own on public.reviews for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reviews_delete_own on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy user_rules_own on public.user_rules;
create policy user_rules_select_own on public.user_rules for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_rules_insert_own on public.user_rules for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_rules_update_own on public.user_rules for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_rules_delete_own on public.user_rules for delete to authenticated
  using (user_id = (select auth.uid()));

-- ============ 2. user_api_keys: no client access ============
drop policy user_api_keys_own_read on public.user_api_keys;
revoke all on public.user_api_keys from authenticated, anon;
