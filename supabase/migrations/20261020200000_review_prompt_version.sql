-- Task 3.5 (DEC-053): remember which review prompt made an AI review.
-- null = manual review or unknown. The 3 AI reviews that exist were all made with v2.
alter table public.reviews add column prompt_version text check (prompt_version in ('v1', 'v2'));

update public.reviews
   set prompt_version = 'v2'
 where source = 'ai' and created_at >= timestamptz '2026-10-13 12:51:17+00';

-- Same function as before (security invoker, RLS applies) plus the new column.
create or replace function public.replace_current_review(p_hand_id uuid, p_review jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare
  new_id uuid;
begin
  update public.reviews set is_current = false where hand_id = p_hand_id and is_current;

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
