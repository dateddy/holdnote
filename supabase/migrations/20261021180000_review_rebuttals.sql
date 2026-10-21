-- Rebuttals (task 5.1e): the student's argument against an AI review and the AI's answer.
-- The AI keeps its conclusion (outcome 'kept', no new review) or revises it (outcome 'revised':
-- the new review is current, the disputed one goes to history through replace_current_review).
-- Written by the server only, like ai_usage: a row the user could delete would hand back the
-- free rebuttal. The user reads their own rows.

-- Lets review_rebuttals point at reviews of the same user only (repo convention: composite keys).
create unique index reviews_id_user on public.reviews (id, user_id);

create table public.review_rebuttals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  hand_id       uuid not null,
  -- The review one run of "AI review" made. Revised reviews keep the thread of the one they
  -- replace, so one analysis = one thread = one free rebuttal.
  thread_id     uuid not null,
  review_id     uuid not null,
  new_review_id uuid,
  reason        text not null check (char_length(reason) between 3 and 600),
  outcome       text not null check (outcome in ('kept', 'revised')),
  reply         text not null check (char_length(reply) <= 1200),
  free          boolean not null default false,
  created_at    timestamptz not null default now(),
  check ((outcome = 'revised') = (new_review_id is not null)),
  foreign key (hand_id, user_id) references public.hands (id, user_id) on delete cascade,
  foreign key (thread_id, user_id) references public.reviews (id, user_id) on delete cascade,
  foreign key (review_id, user_id) references public.reviews (id, user_id) on delete cascade,
  foreign key (new_review_id, user_id) references public.reviews (id, user_id)
    on delete set null (new_review_id)
);
create index review_rebuttals_hand on public.review_rebuttals (hand_id, created_at);
-- At most one free rebuttal per analysis, even when two requests race.
create unique index review_rebuttals_one_free on public.review_rebuttals (thread_id) where free;

alter table public.review_rebuttals enable row level security;
create policy review_rebuttals_own_read on public.review_rebuttals for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.review_rebuttals from anon, authenticated;
grant select on public.review_rebuttals to authenticated;

-- The free rebuttal is logged with its own kind: its cost counts toward the app budget
-- (ai_app_spend_since sums every billed_to = 'app' row) but not toward the monthly allowance.
alter table public.ai_usage drop constraint ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check
  check (kind in ('hand_review', 'rebuttal', 'rebuttal_free', 'session_summary'));
