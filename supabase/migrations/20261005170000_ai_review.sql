-- AI review support (tasks 3.1-3.3, DEC-035).
-- 1. ai_usage.billed_to: the free-plan budget counts only what the app pays for.
-- 2. user_api_keys.model: the model a bring-your-own-key user picked (null = default).
-- 3. Vault helpers, callable by the server (service_role) only.
-- 4. replace_current_review: swap the current review atomically, under the caller's RLS.

-- ============ 1. + 2. columns ============
alter table public.ai_usage
  add column billed_to text not null default 'app' check (billed_to in ('app', 'user'));
create index ai_usage_app_month on public.ai_usage (created_at) where billed_to = 'app';

alter table public.user_api_keys add column model text;

-- ============ 3. Vault helpers ============
-- security definer: the vault schema is not reachable by any API role, so the server needs a
-- function that runs as the owner. Execute is limited to service_role below; every function
-- takes the user id explicitly because the server acts with the secret key, not as the user.
create function public.set_user_api_key(p_user uuid, p_key text, p_model text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  existing uuid;
begin
  select vault_secret_id into existing
  from public.user_api_keys where user_id = p_user and provider = 'openrouter';

  if existing is null then
    insert into public.user_api_keys (user_id, provider, vault_secret_id, model)
    values (
      p_user, 'openrouter',
      vault.create_secret(p_key, 'openrouter:' || p_user::text, 'HoldNote user OpenRouter key'),
      p_model
    );
  else
    perform vault.update_secret(existing, p_key);
    update public.user_api_keys set model = p_model
    where user_id = p_user and provider = 'openrouter';
  end if;
end $$;

create function public.get_user_api_key(p_user uuid)
returns table (api_key text, model text) language sql security definer set search_path = '' as $$
  select s.decrypted_secret, k.model
  from public.user_api_keys k
  join vault.decrypted_secrets s on s.id = k.vault_secret_id
  where k.user_id = p_user and k.provider = 'openrouter'
$$;

create function public.delete_user_api_key(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  existing uuid;
begin
  select vault_secret_id into existing
  from public.user_api_keys where user_id = p_user and provider = 'openrouter';
  delete from public.user_api_keys where user_id = p_user and provider = 'openrouter';
  if existing is not null then
    delete from vault.secrets where id = existing;
  end if;
end $$;

revoke execute on function public.set_user_api_key(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.get_user_api_key(uuid) from public, anon, authenticated;
revoke execute on function public.delete_user_api_key(uuid) from public, anon, authenticated;
grant execute on function public.set_user_api_key(uuid, text, text) to service_role;
grant execute on function public.get_user_api_key(uuid) to service_role;
grant execute on function public.delete_user_api_key(uuid) to service_role;

-- ============ 4. replace_current_review ============
-- security invoker (default): RLS applies, so a user can only replace reviews of their own
-- hands. The old current review becomes history; the new one is current.
create function public.replace_current_review(p_hand_id uuid, p_review jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare
  new_id uuid;
begin
  update public.reviews set is_current = false where hand_id = p_hand_id and is_current;

  insert into public.reviews (
    hand_id, source, model, range_text, math_text, line_text, icm_text,
    error_tags, ev_verdict, lesson, accepted, is_current
  ) values (
    p_hand_id,
    p_review ->> 'source',
    p_review ->> 'model',
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

revoke execute on function public.replace_current_review(uuid, jsonb) from public, anon;
grant execute on function public.replace_current_review(uuid, jsonb) to authenticated;
