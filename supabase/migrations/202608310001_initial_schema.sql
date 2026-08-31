create extension if not exists pgcrypto;

create type public.relationship_status as enum ('pending', 'active', 'unlinked');
create type public.member_status as enum ('pending_consent', 'active', 'revoked');
create type public.receipt_status as enum ('sent', 'delivered', 'read');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  status public.relationship_status not null default 'pending',
  consent_version smallint not null default 1,
  max_members smallint not null default 2 check (max_members = 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.relationship_members (
  relationship_id uuid not null references public.relationships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.member_status not null default 'pending_consent',
  consented_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (relationship_id, user_id),
  unique (user_id)
);

create table public.relationship_invites (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.relationships(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  token_hash text not null unique check (char_length(token_hash) = 64),
  pairing_envelope jsonb not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(pairing_envelope) = 'object'),
  check (expires_at <= created_at + interval '7 days')
);

create table public.devices (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Dispositivo' check (char_length(label) <= 80),
  public_key text check (char_length(public_key) <= 8192),
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  subscription jsonb not null check (octet_length(subscription::text) <= 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'messages','signals','letters','daily_questions','daily_answers','chapters','chapter_items',
    'shared_stories','story_entries','romantic_challenges','challenge_results','virtual_dates',
    'memories','memory_stars','gifts'
  ] loop
    execute format($sql$
      create table public.%I (
        id uuid primary key,
        relationship_id uuid not null references public.relationships(id) on delete cascade,
        sender_id uuid not null references auth.users(id),
        ciphertext text not null check (octet_length(ciphertext) between 16 and 131072),
        iv text not null check (char_length(iv) between 16 and 64),
        crypto_version smallint not null default 1 check (crypto_version between 1 and 10),
        content_type text not null check (char_length(content_type) between 1 and 64),
        logical_timestamp text not null check (char_length(logical_timestamp) between 20 and 40),
        parent_id uuid,
        reply_to_id uuid,
        client_id uuid,
        edited_at timestamptz,
        delete_requested_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique (relationship_id, client_id)
      )
    $sql$, table_name);
    execute format('create index %I on public.%I (relationship_id, created_at desc)', table_name || '_relationship_created_idx', table_name);
    execute format('create index %I on public.%I (sender_id, created_at desc)', table_name || '_sender_created_idx', table_name);
  end loop;
end $$;

alter table public.virtual_dates
  add column scheduled_at timestamptz,
  add column reminder_sent_at timestamptz;
create index virtual_dates_reminder_idx on public.virtual_dates(scheduled_at)
  where scheduled_at is not null and reminder_sent_at is null;

create table public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  relationship_id uuid not null references public.relationships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.receipt_status not null,
  occurred_at timestamptz not null default now(),
  primary key (message_id, user_id, status)
);

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  relationship_id uuid not null references public.relationships(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  ciphertext text not null check (octet_length(ciphertext) between 16 and 4096),
  iv text not null check (char_length(iv) between 16 and 64),
  crypto_version smallint not null default 1,
  created_at timestamptz not null default now(),
  unique (message_id, sender_id)
);

create table public.presence (
  relationship_id uuid not null references public.relationships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  state text not null check (state in ('online','offline','reading','date','writing_message','writing_letter')),
  last_seen_at timestamptz not null default now(),
  primary key (relationship_id, user_id, device_id)
);

create table public.settings (
  relationship_id uuid not null references public.relationships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ciphertext text not null check (octet_length(ciphertext) between 16 and 32768),
  iv text not null check (char_length(iv) between 16 and 64),
  crypto_version smallint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (relationship_id, user_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  relationship_id uuid references public.relationships(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 64),
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 2048),
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger relationships_touch before update on public.relationships for each row execute function public.touch_updated_at();
create trigger push_touch before update on public.push_subscriptions for each row execute function public.touch_updated_at();

create or replace function public.enforce_two_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.relationship_members where relationship_id = new.relationship_id and status <> 'revoked') >= 2 then
    raise exception 'relationship_full' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger relationship_max_two before insert on public.relationship_members
for each row execute function public.enforce_two_members();

create or replace function public.prevent_encrypted_identity_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.relationship_id <> old.relationship_id or new.sender_id <> old.sender_id or new.created_at <> old.created_at then
    raise exception 'immutable_identity_fields';
  end if;
  new.updated_at = now();
  return new;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'messages','signals','letters','daily_questions','daily_answers','chapters','chapter_items',
    'shared_stories','story_entries','romantic_challenges','challenge_results','virtual_dates',
    'memories','memory_stars','gifts'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.prevent_encrypted_identity_change()', table_name || '_immutable', table_name);
  end loop;
end $$;

create index relationship_members_user_idx on public.relationship_members(user_id, status);
create index invites_relationship_idx on public.relationship_invites(relationship_id, expires_at desc);
create index invites_expiry_idx on public.relationship_invites(expires_at) where used_at is null and revoked_at is null;
create index receipts_relationship_idx on public.message_receipts(relationship_id, occurred_at desc);
create index presence_relationship_idx on public.presence(relationship_id, last_seen_at desc);
create index audit_relationship_idx on public.audit_events(relationship_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memories', 'memories', false, 5242880, array['application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

alter publication supabase_realtime add table public.messages, public.signals, public.letters,
  public.daily_answers, public.story_entries, public.romantic_challenges, public.virtual_dates,
  public.memories, public.gifts, public.message_receipts, public.presence;
