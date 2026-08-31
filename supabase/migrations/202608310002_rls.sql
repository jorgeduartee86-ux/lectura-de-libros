create or replace function public.is_relationship_member(target_relationship uuid, target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.relationship_members
    where relationship_id = target_relationship and user_id = target_user and status = 'active'
  )
$$;

revoke all on function public.is_relationship_member(uuid, uuid) from public;
grant execute on function public.is_relationship_member(uuid, uuid) to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.relationships enable row level security;
alter table public.relationship_members enable row level security;
alter table public.relationship_invites enable row level security;
alter table public.devices enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.message_receipts enable row level security;
alter table public.message_reactions enable row level security;
alter table public.presence enable row level security;
alter table public.settings enable row level security;
alter table public.audit_events enable row level security;
alter table public.rate_limits enable row level security;

create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.relationship_members mine
    join public.relationship_members theirs using (relationship_id)
    where mine.user_id = auth.uid() and mine.status = 'active' and theirs.user_id = profiles.id and theirs.status = 'active'
  )
);
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy relationships_select_member on public.relationships for select to authenticated using (public.is_relationship_member(id));
create policy members_select_relation on public.relationship_members for select to authenticated using (public.is_relationship_member(relationship_id));

create policy devices_select_self on public.devices for select to authenticated using (user_id = auth.uid());
create policy devices_insert_self on public.devices for insert to authenticated with check (user_id = auth.uid());
create policy devices_update_self on public.devices for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy devices_delete_self on public.devices for delete to authenticated using (user_id = auth.uid());

create policy push_select_self on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_insert_self on public.push_subscriptions for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid() and d.revoked_at is null)
);
create policy push_update_self on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_delete_self on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'messages','signals','letters','daily_questions','daily_answers','chapters','chapter_items',
    'shared_stories','story_entries','romantic_challenges','challenge_results','virtual_dates',
    'memories','memory_stars','gifts'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_relationship_member(relationship_id))', table_name || '_select_member', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_relationship_member(relationship_id) and sender_id = auth.uid())', table_name || '_insert_sender', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_relationship_member(relationship_id) and sender_id = auth.uid()) with check (public.is_relationship_member(relationship_id) and sender_id = auth.uid())', table_name || '_update_sender', table_name);
  end loop;
end $$;

create policy receipts_select_member on public.message_receipts for select to authenticated using (public.is_relationship_member(relationship_id));
create policy receipts_insert_self on public.message_receipts for insert to authenticated with check (public.is_relationship_member(relationship_id) and user_id = auth.uid());
create policy receipts_update_self on public.message_receipts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reactions_select_member on public.message_reactions for select to authenticated using (public.is_relationship_member(relationship_id));
create policy reactions_insert_self on public.message_reactions for insert to authenticated with check (public.is_relationship_member(relationship_id) and sender_id = auth.uid());
create policy reactions_update_self on public.message_reactions for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());
create policy reactions_delete_self on public.message_reactions for delete to authenticated using (sender_id = auth.uid());

create policy presence_select_member on public.presence for select to authenticated using (public.is_relationship_member(relationship_id));
create policy presence_insert_self on public.presence for insert to authenticated with check (
  public.is_relationship_member(relationship_id) and user_id = auth.uid() and exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid() and d.revoked_at is null)
);
create policy presence_update_self on public.presence for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy presence_delete_self on public.presence for delete to authenticated using (user_id = auth.uid());

create policy settings_select_self on public.settings for select to authenticated using (user_id = auth.uid() and public.is_relationship_member(relationship_id));
create policy settings_insert_self on public.settings for insert to authenticated with check (user_id = auth.uid() and public.is_relationship_member(relationship_id));
create policy settings_update_self on public.settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy audit_select_member on public.audit_events for select to authenticated using (relationship_id is not null and public.is_relationship_member(relationship_id));

create policy memory_files_read on storage.objects for select to authenticated using (
  bucket_id = 'memories' and public.is_relationship_member((storage.foldername(name))[1]::uuid)
);
create policy memory_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'memories'
  and public.is_relationship_member((storage.foldername(name))[1]::uuid)
  and (storage.foldername(name))[2] = auth.uid()::text
  and lower(storage.extension(name)) = 'bin'
);
create policy memory_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'memories' and (storage.foldername(name))[2] = auth.uid()::text
);

revoke all on public.relationship_invites, public.rate_limits from anon, authenticated;
revoke insert, update, delete on public.relationships, public.relationship_members, public.audit_events from authenticated;
