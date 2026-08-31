create or replace function public.accept_relationship_invite(p_token_hash text)
returns table (relationship_id uuid, pairing_envelope jsonb)
language plpgsql security definer set search_path = public as $$
declare invite public.relationship_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into invite from public.relationship_invites
  where token_hash = p_token_hash for update;
  if invite.id is null or invite.used_at is not null or invite.revoked_at is not null or invite.expires_at <= now() then
    raise exception 'invite_invalid_or_expired';
  end if;
  if invite.created_by = auth.uid() then raise exception 'cannot_accept_own_invite'; end if;
  if exists (select 1 from public.relationship_members where user_id = auth.uid()) then raise exception 'already_linked'; end if;
  insert into public.relationship_members (relationship_id, user_id, status, consented_at)
  values (invite.relationship_id, auth.uid(), 'active', now());
  update public.relationship_invites set used_at = now(), used_by = auth.uid() where id = invite.id;
  update public.relationships set status = 'active' where id = invite.relationship_id;
  insert into public.audit_events (relationship_id, actor_id, event_type) values (invite.relationship_id, auth.uid(), 'invite_accepted');
  return query select invite.relationship_id, invite.pairing_envelope;
end $$;

revoke all on function public.accept_relationship_invite(text) from public;
grant execute on function public.accept_relationship_invite(text) to authenticated;

create or replace function public.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_row public.rate_limits%rowtype;
begin
  insert into public.rate_limits(key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    count = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1 else public.rate_limits.count + 1 end,
    window_start = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now() else public.rate_limits.window_start end
  returning * into current_row;
  return current_row.count <= p_limit;
end $$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
