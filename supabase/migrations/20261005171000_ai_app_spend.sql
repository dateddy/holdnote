-- Total app-paid AI spend since a date, for the free-plan hard budget (spec 5.5).
-- Summed in the database: one call rather than paging through every usage row.
-- security invoker (default): only the server, acting as service_role, can read all rows.
create function public.ai_app_spend_since(p_since timestamptz)
returns numeric language sql stable set search_path = '' as $$
  select coalesce(sum(cost_usd), 0) from public.ai_usage
  where billed_to = 'app' and created_at >= p_since
$$;

revoke execute on function public.ai_app_spend_since(timestamptz) from public, anon, authenticated;
grant execute on function public.ai_app_spend_since(timestamptz) to service_role;
