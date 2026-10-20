-- ai_usage.failed: a model call that returned nothing usable (DEC-057).
-- The row still carries its cost, so ai_app_spend_since (every billed_to = 'app' row) counts it
-- toward the free-plan budget. Allowance and hourly counts skip failed rows.
alter table public.ai_usage add column failed boolean not null default false;
