create table public.quick_access_spaces (
  id text primary key check (id = 'primary'),
  relationship_id uuid not null unique references public.relationships(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.quick_access_spaces enable row level security;
revoke all on public.quick_access_spaces from anon, authenticated;

create or replace function public.join_quick_access(target_user uuid)
returns table(relationship_id uuid, member_label text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_relationship uuid;
  existing_relationship uuid;
  active_members integer;
  assigned_label text;
begin
  if target_user is null or not exists (select 1 from auth.users where id = target_user) then
    raise exception 'authentication_required';
  end if;

  perform pg_advisory_xact_lock(hashtext('lectura-de-libros:quick-access:primary'));

  select q.relationship_id
    into target_relationship
    from public.quick_access_spaces q
   where q.id = 'primary';

  if target_relationship is null then
    insert into public.relationships (created_by, status)
    values (target_user, 'active')
    returning id into target_relationship;

    insert into public.quick_access_spaces (id, relationship_id)
    values ('primary', target_relationship);
  end if;

  select rm.relationship_id
    into existing_relationship
    from public.relationship_members rm
   where rm.user_id = target_user
     and rm.status = 'active';

  if existing_relationship is not null then
    if existing_relationship <> target_relationship then
      raise exception 'already_linked';
    end if;
    select coalesce(nullif(p.display_name, ''), 'Entre páginas')
      into assigned_label
      from public.profiles p
     where p.id = target_user;
    return query select target_relationship, assigned_label;
    return;
  end if;

  select count(*)::integer
    into active_members
    from public.relationship_members rm
   where rm.relationship_id = target_relationship
     and rm.status <> 'revoked';

  if active_members >= 2 then
    raise exception 'relationship_full';
  end if;

  assigned_label := case when active_members = 0 then 'Persona 1' else 'Persona 2' end;

  insert into public.relationship_members (relationship_id, user_id, status, consented_at)
  values (target_relationship, target_user, 'active', now());

  insert into public.profiles (id, display_name)
  values (target_user, assigned_label)
  on conflict (id) do update set display_name = excluded.display_name, updated_at = now();

  insert into public.audit_events (relationship_id, actor_id, event_type, metadata)
  values (target_relationship, target_user, 'quick_access_joined', jsonb_build_object('slot', active_members + 1));

  return query select target_relationship, assigned_label;
end;
$$;

revoke all on function public.join_quick_access(uuid) from public, anon, authenticated;
grant execute on function public.join_quick_access(uuid) to service_role;
