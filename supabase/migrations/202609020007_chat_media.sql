-- Additive upgrade; legacy encrypted rows and Supabase Storage remain readable.
begin;
alter table public.messages add column deleted_at timestamptz;
alter table public.messages add column attachment_ids uuid[] not null default '{}';
alter table public.memories add column attachment_ids uuid[] not null default '{}';
alter table public.message_reactions add column logical_timestamp text;
update public.message_reactions set logical_timestamp = created_at::text where logical_timestamp is null;
alter table public.message_reactions alter column logical_timestamp set not null;

create table public.media_attachments (
  id uuid primary key,
  relationship_id uuid not null references public.relationships(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  kind text not null check (kind in ('image','video','audio','document','sticker')),
  mime text not null check (char_length(mime) < 160),
  plain_size bigint not null check (plain_size between 1 and 104857600),
  encrypted_size bigint not null check (encrypted_size between 17 and 104858000),
  object_key text not null unique,
  upload_id text,
  state text not null default 'uploading' check (state in ('uploading','ready','deleting','deleted','aborted')),
  ciphertext text not null check (octet_length(ciphertext) between 16 and 32768),
  iv text not null check (char_length(iv) between 16 and 64),
  logical_timestamp text not null check (char_length(logical_timestamp) between 20 and 40),
  crypto_version smallint not null default 1 check (crypto_version = 1),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index media_relation_idx on public.media_attachments(relationship_id, created_at desc);
create table public.media_references (
  attachment_id uuid not null references public.media_attachments(id),
  record_id uuid not null,
  table_name text not null check (table_name in ('messages','memories')),
  primary key (attachment_id, record_id, table_name)
);
alter table public.media_attachments enable row level security;
alter table public.media_references enable row level security;
create policy media_read on public.media_attachments for select to authenticated using (
  public.is_relationship_member(relationship_id) and
  (owner_id = auth.uid() or (state = 'ready' and exists(select 1 from public.media_references r where r.attachment_id = id)))
);
create policy media_refs_read on public.media_references for select to authenticated using (
  exists(select 1 from public.messages m where m.id = record_id and table_name = 'messages' and public.is_relationship_member(m.relationship_id))
  or exists(select 1 from public.memories m where m.id = record_id and table_name = 'memories' and public.is_relationship_member(m.relationship_id))
);
revoke all on public.media_attachments, public.media_references from anon, authenticated;
grant select on public.media_attachments, public.media_references to authenticated;
grant all on public.media_attachments, public.media_references to service_role;

create table public.custom_stickers (
  id uuid primary key references public.media_attachments(id),
  relationship_id uuid not null references public.relationships(id),
  user_id uuid not null references auth.users(id),
  favorite boolean not null default false, created_at timestamptz not null default now()
);
alter table public.custom_stickers enable row level security;
create policy stickers_read on public.custom_stickers for select to authenticated using(user_id=auth.uid() and public.is_relationship_member(relationship_id));
create policy stickers_update on public.custom_stickers for update to authenticated using(user_id=auth.uid() and public.is_relationship_member(relationship_id)) with check(user_id=auth.uid() and public.is_relationship_member(relationship_id));
create policy stickers_delete on public.custom_stickers for delete to authenticated using(user_id=auth.uid() and public.is_relationship_member(relationship_id));
revoke all on public.custom_stickers from anon, authenticated;
grant select,delete on public.custom_stickers to authenticated;
grant update(favorite) on public.custom_stickers to authenticated;
grant all on public.custom_stickers to service_role;

-- Lock the asset while testing references: avoids deletion racing a new message.
create function public.claim_media_deletion(p_id uuid,p_owner uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare asset public.media_attachments%rowtype;
begin
  select * into asset from public.media_attachments where id = p_id for update;
  if asset.id is null or asset.owner_id <> p_owner or exists(select 1 from public.media_references where attachment_id=p_id)
    or exists(select 1 from public.custom_stickers where id=p_id) then return false; end if;
  update public.media_attachments set state='deleting' where id=p_id;
  return true;
end $$;
revoke all on function public.claim_media_deletion(uuid,uuid) from public;
grant execute on function public.claim_media_deletion(uuid,uuid) to service_role;

-- Filter references before the batch limit, so old shared files cannot starve
-- cleanup of abandoned uploads. claim_media_deletion rechecks under a row lock.
create function public.stale_media_candidates() returns setof public.media_attachments
language sql stable security definer set search_path = public as $$
  select m.* from public.media_attachments m
  where m.state in ('uploading','ready','deleting') and m.created_at < now() - interval '7 days'
    and not exists(select 1 from public.media_references r where r.attachment_id=m.id)
    and not exists(select 1 from public.custom_stickers s where s.id=m.id)
  order by m.created_at,m.id limit 30
$$;
revoke all on function public.stale_media_candidates() from public;
grant execute on function public.stale_media_candidates() to service_role;

create function public.bind_media_references() returns trigger language plpgsql security definer set search_path = public as $$
declare asset uuid; media public.media_attachments%rowtype;
begin
  if cardinality(new.attachment_ids) > 10 then raise exception 'too_many_attachments'; end if;
  if tg_op = 'UPDATE' and new.attachment_ids is not distinct from old.attachment_ids then return new; end if;
  foreach asset in array new.attachment_ids loop
    select * into media from public.media_attachments where id = asset for update;
    if media.id is null or media.relationship_id <> new.relationship_id or media.owner_id <> new.sender_id or media.state <> 'ready' then
      raise exception 'invalid_attachment';
    end if;
    insert into public.media_references values (asset,new.id,tg_table_name) on conflict do nothing;
  end loop;
  delete from public.media_references where record_id = new.id and table_name = tg_table_name and not(attachment_id = any(new.attachment_ids));
  return new;
end $$;
create trigger messages_media after insert or update of attachment_ids on public.messages for each row execute function public.bind_media_references();
create trigger memories_media after insert or update of attachment_ids on public.memories for each row execute function public.bind_media_references();

-- A receipt/reaction must refer to a message in the same relationship, including on update.
create function public.check_message_relation() returns trigger language plpgsql set search_path = public as $$
begin
  if not exists(select 1 from public.messages m where m.id = new.message_id and m.relationship_id = new.relationship_id) then
    raise exception 'message_relation_mismatch';
  end if;
  return new;
end $$;
create trigger receipts_relation before insert or update on public.message_receipts for each row execute function public.check_message_relation();
create trigger reactions_relation before insert or update on public.message_reactions for each row execute function public.check_message_relation();
drop policy receipts_update_self on public.message_receipts;
create policy receipts_update_self on public.message_receipts for update to authenticated using (user_id = auth.uid() and public.is_relationship_member(relationship_id)) with check (user_id = auth.uid() and public.is_relationship_member(relationship_id));
drop policy reactions_update_self on public.message_reactions;
create policy reactions_update_self on public.message_reactions for update to authenticated using (sender_id = auth.uid() and public.is_relationship_member(relationship_id)) with check (sender_id = auth.uid() and public.is_relationship_member(relationship_id));

create table public.starred_messages (
  message_id uuid not null references public.messages(id) on delete cascade,
  relationship_id uuid not null references public.relationships(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (message_id,user_id)
);
create table public.pinned_messages (
  relationship_id uuid primary key references public.relationships(id),
  message_id uuid not null references public.messages(id),
  user_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.starred_messages enable row level security;
alter table public.pinned_messages enable row level security;
create policy stars_self on public.starred_messages for all to authenticated using(user_id = auth.uid() and public.is_relationship_member(relationship_id)) with check(user_id = auth.uid() and public.is_relationship_member(relationship_id));
create policy pins_read on public.pinned_messages for select to authenticated using(public.is_relationship_member(relationship_id));
create policy pins_insert on public.pinned_messages for insert to authenticated with check(user_id = auth.uid() and public.is_relationship_member(relationship_id));
create policy pins_update on public.pinned_messages for update to authenticated using(public.is_relationship_member(relationship_id)) with check(user_id = auth.uid() and public.is_relationship_member(relationship_id));
create policy pins_delete on public.pinned_messages for delete to authenticated using(public.is_relationship_member(relationship_id));
create trigger stars_relation before insert or update on public.starred_messages for each row execute function public.check_message_relation();
create trigger pins_relation before insert or update on public.pinned_messages for each row execute function public.check_message_relation();
revoke all on public.starred_messages,public.pinned_messages from anon, authenticated;
grant select,insert,update,delete on public.starred_messages,public.pinned_messages to authenticated;
grant all on public.starred_messages,public.pinned_messages to service_role;

create function public.chat_unread(p_relationship uuid) returns table(message_id uuid, created_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select m.id,m.created_at from public.messages m
  where m.relationship_id = p_relationship and m.sender_id <> auth.uid() and m.deleted_at is null
    and m.content_type not like 'message-%'
    and not exists(select 1 from public.message_receipts r where r.message_id = m.id and r.user_id = auth.uid() and r.status = 'read')
  order by m.created_at,m.id
$$;
revoke all on function public.chat_unread(uuid) from public;
grant execute on function public.chat_unread(uuid) to authenticated;

create function public.count_unread_for_user(p_relationship uuid,p_user uuid) returns bigint
language sql stable security definer set search_path=public as $$
  select count(*) from public.messages m where m.relationship_id=p_relationship and m.sender_id<>p_user
    and m.deleted_at is null and m.content_type not like 'message-%'
    and not exists(select 1 from public.message_receipts r where r.message_id=m.id and r.user_id=p_user and r.status='read')
$$;
revoke all on function public.count_unread_for_user(uuid,uuid) from public;
grant execute on function public.count_unread_for_user(uuid,uuid) to service_role;

create table public.user_notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  privacy text not null default 'discreet' check (privacy in ('discreet','medium','direct')),
  sound boolean not null default false,
  vibration boolean not null default false,
  romance boolean not null default true,
  reminder_minutes integer not null default 0 check (reminder_minutes in (0,30,60,180)),
  quiet_start integer check(quiet_start between 0 and 23), quiet_end integer check(quiet_end between 0 and 23),
  timezone text not null default 'America/Bogota' check(char_length(timezone) <= 80),
  kinds text[] not null default array['message','sticker','letter','signal','date','gift'],
  updated_at timestamptz not null default now()
);
alter table public.user_notification_settings enable row level security;
create policy notifications_self on public.user_notification_settings for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
revoke all on public.user_notification_settings from anon, authenticated;
grant select,insert,update,delete on public.user_notification_settings to authenticated;
grant all on public.user_notification_settings to service_role;
alter table public.push_subscriptions add column last_push_at timestamptz;
alter table public.push_subscriptions add column last_error text;
alter table public.push_subscriptions add column platform text;

-- Durable scheduled encrypted messages. Only sender can see them until publication.
create table public.scheduled_messages (
  id uuid primary key,
  relationship_id uuid not null references public.relationships(id),
  sender_id uuid not null references auth.users(id),
  ciphertext text not null check(octet_length(ciphertext) between 16 and 131072),
  iv text not null check(char_length(iv) between 16 and 64),
  crypto_version smallint not null default 1 check(crypto_version = 1),
  content_type text not null default 'message' check(content_type = 'message'),
  logical_timestamp text not null,
  scheduled_at timestamptz not null check(scheduled_at < now() + interval '1 year'),
  created_at timestamptz not null default now(), published_at timestamptz
);
alter table public.scheduled_messages enable row level security;
create policy scheduled_select on public.scheduled_messages for select to authenticated using(sender_id = auth.uid() and public.is_relationship_member(relationship_id));
create policy scheduled_insert on public.scheduled_messages for insert to authenticated with check(sender_id = auth.uid() and public.is_relationship_member(relationship_id) and published_at is null and scheduled_at > now());
create policy scheduled_cancel on public.scheduled_messages for delete to authenticated using(sender_id = auth.uid() and public.is_relationship_member(relationship_id) and published_at is null);
revoke all on public.scheduled_messages from anon, authenticated;
grant select,insert,delete on public.scheduled_messages to authenticated;
grant all on public.scheduled_messages to service_role;

create table public.push_jobs (
  id uuid primary key default gen_random_uuid(), relationship_id uuid not null references public.relationships(id),
  sender_id uuid not null references auth.users(id), recipient_id uuid not null references auth.users(id),
  message_id uuid references public.messages(id), kind text not null default 'message',
  state text not null default 'pending' check(state in ('pending','processing','sent','cancelled','failed')),
  attempts integer not null default 0, due_at timestamptz not null default now(),
  reminder_number integer not null default 0 check(reminder_number between 0 and 2),
  created_at timestamptz not null default now(), sent_at timestamptz,
  unique(message_id,recipient_id,reminder_number)
);
create index push_jobs_due on public.push_jobs(due_at) where state in ('pending','processing');
alter table public.push_jobs enable row level security;
revoke all on public.push_jobs from anon, authenticated;
grant all on public.push_jobs to service_role;
create table public.push_job_deliveries (
  job_id uuid not null references public.push_jobs(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  sent_at timestamptz not null default now(), primary key(job_id,subscription_id)
);
alter table public.push_job_deliveries enable row level security;
revoke all on public.push_job_deliveries from anon, authenticated;
grant all on public.push_job_deliveries to service_role;
create function public.enqueue_chat_push() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.content_type not like 'message-%' then
    insert into public.push_jobs(relationship_id,sender_id,recipient_id,message_id,kind)
    select new.relationship_id,new.sender_id,rm.user_id,new.id,case when new.content_type='sticker' then 'sticker' else 'message' end from public.relationship_members rm
      where rm.relationship_id = new.relationship_id and rm.status = 'active' and rm.user_id <> new.sender_id
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger messages_push after insert on public.messages for each row execute function public.enqueue_chat_push();
create function public.enqueue_tool_push() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.push_jobs(relationship_id,sender_id,recipient_id,kind)
  select new.relationship_id,new.sender_id,rm.user_id,
    case tg_table_name when 'signals' then 'signal' when 'letters' then 'letter' when 'gifts' then 'gift' else 'date' end
  from public.relationship_members rm where rm.relationship_id=new.relationship_id and rm.status='active' and rm.user_id<>new.sender_id;
  return new;
end $$;
create trigger signals_push after insert on public.signals for each row execute function public.enqueue_tool_push();
create trigger letters_push after insert on public.letters for each row execute function public.enqueue_tool_push();
create trigger gifts_push after insert on public.gifts for each row execute function public.enqueue_tool_push();
create trigger dates_push after insert on public.virtual_dates for each row execute function public.enqueue_tool_push();
create function public.cancel_read_reminders() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'read' then
    update public.push_jobs set state = 'cancelled' where message_id = new.message_id and recipient_id = new.user_id and state in ('pending','processing');
  end if;
  return new;
end $$;
create trigger receipts_cancel_reminders after insert on public.message_receipts for each row execute function public.cancel_read_reminders();
create function public.claim_push_jobs(p_message uuid default null) returns setof public.push_jobs
language plpgsql security definer set search_path = public as $$
begin
  return query update public.push_jobs j set state = 'processing', attempts = attempts + 1, due_at = now() + interval '2 minutes'
  where j.id in (select id from public.push_jobs where state in ('pending','processing') and due_at <= now()
    and (p_message is null or message_id = p_message) order by due_at for update skip locked limit 30)
  returning j.*;
end $$;
create function public.publish_scheduled_messages() returns integer language plpgsql security definer set search_path = public as $$
declare item public.scheduled_messages%rowtype; total integer = 0;
begin
  for item in select * from public.scheduled_messages where published_at is null and scheduled_at <= now() for update skip locked limit 50 loop
    if public.is_relationship_member(item.relationship_id,item.sender_id) then
      insert into public.messages(id,relationship_id,sender_id,ciphertext,iv,crypto_version,content_type,logical_timestamp)
      values(item.id,item.relationship_id,item.sender_id,item.ciphertext,item.iv,item.crypto_version,item.content_type,item.logical_timestamp) on conflict do nothing;
    end if;
    update public.scheduled_messages set published_at = now() where id = item.id;
    total = total + 1;
  end loop;
  return total;
end $$;
revoke all on function public.claim_push_jobs(uuid), public.publish_scheduled_messages() from public;
grant execute on function public.claim_push_jobs(uuid), public.publish_scheduled_messages() to service_role;
alter publication supabase_realtime add table public.message_reactions,public.starred_messages,public.pinned_messages,public.media_attachments;
commit;
