-- DEC-064: a hand can keep its AI review and the student's own review side by side.
-- "Current" is now per kind: at most one current AI review and one current manual review per hand.
drop index public.reviews_one_current;
create unique index reviews_one_current on public.reviews (hand_id, source) where is_current;

-- Same function as before (security invoker, RLS applies), but it retires only the current review
-- of the kind it is saving, so running the AI never replaces what the student wrote.
create or replace function public.replace_current_review(p_hand_id uuid, p_review jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare
  new_id uuid;
begin
  update public.reviews set is_current = false
   where hand_id = p_hand_id and is_current and source = p_review ->> 'source';

  insert into public.reviews (
    hand_id, source, model, prompt_version, range_text, math_text, line_text, icm_text,
    error_tags, ev_verdict, lesson, accepted, is_current
  ) values (
    p_hand_id,
    p_review ->> 'source',
    p_review ->> 'model',
    p_review ->> 'prompt_version',
    p_review ->> 'range_text',
    p_review ->> 'math_text',
    p_review ->> 'line_text',
    p_review ->> 'icm_text',
    coalesce(array(select jsonb_array_elements_text(p_review -> 'error_tags')), '{}'),
    p_review ->> 'ev_verdict',
    p_review ->> 'lesson',
    coalesce((p_review ->> 'accepted')::boolean, false),
    true
  ) returning id into new_id;

  return new_id;
end $$;

-- The leak table counts one review per hand: the student's own when there is one, else the AI's.
create or replace view public.leak_stats with (security_invoker = true) as
  select h.user_id, h.session_id, s.date as session_date, t.tag,
         'review'::text as source, count(distinct h.id)::int as hand_count
  from public.reviews r
  join public.hands h on h.id = r.hand_id
  join public.sessions s on s.id = h.session_id
  cross join lateral unnest(r.error_tags) as t(tag)
  where r.is_current and t.tag <> 'none'
    and (r.source = 'manual'
         or not exists (
           select 1 from public.reviews m
            where m.hand_id = r.hand_id and m.is_current and m.source = 'manual'))
  group by h.user_id, h.session_id, s.date, t.tag
  union all
  select s.user_id, s.id, s.date, t.tag, 'summary'::text, 0
  from public.sessions s
  cross join lateral jsonb_array_elements_text(coalesce(s.summary -> 'leak_tags', '[]')) as t(tag);
