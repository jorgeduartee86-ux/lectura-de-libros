-- Supabase environments can grant EXECUTE directly to anon/authenticated by
-- default. Revoking PUBLIC alone does not remove these inherited defaults.
-- Keep this additive migration separate from the already deployed schema.
begin;
revoke all on function
  public.claim_media_deletion(uuid,uuid),
  public.stale_media_candidates(),
  public.count_unread_for_user(uuid,uuid),
  public.claim_push_jobs(uuid),
  public.publish_scheduled_messages(),
  public.consume_rate_limit(text,integer,integer),
  public.join_quick_access(uuid)
from public,anon,authenticated;
grant execute on function
  public.claim_media_deletion(uuid,uuid),
  public.stale_media_candidates(),
  public.count_unread_for_user(uuid,uuid),
  public.claim_push_jobs(uuid),
  public.publish_scheduled_messages(),
  public.consume_rate_limit(text,integer,integer),
  public.join_quick_access(uuid)
to service_role;

revoke all on function public.chat_unread(uuid),
  public.is_relationship_member(uuid,uuid),public.accept_relationship_invite(text)
from public,anon,authenticated;
grant execute on function public.chat_unread(uuid),
  public.is_relationship_member(uuid,uuid),public.accept_relationship_invite(text)
to authenticated,service_role;

-- Trigger functions are invoked by their existing triggers, never through RPC.
revoke all on function public.bind_media_references(),public.check_message_relation(),
  public.enqueue_chat_push(),public.enqueue_tool_push(),public.cancel_read_reminders()
from public,anon,authenticated;
commit;
