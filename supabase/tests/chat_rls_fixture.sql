-- Transactional role-based regression checks. No production record is read or modified.
begin;
select plan(1);
insert into auth.users(id,email) values
 ('eee00000-0000-4000-8000-000000000001','chat-a@example.test'),
 ('eee00000-0000-4000-8000-000000000002','chat-b@example.test'),
 ('eee00000-0000-4000-8000-000000000003','chat-c@example.test');
insert into public.relationships(id,created_by,status) values
 ('eee00000-0000-4000-8000-000000000010','eee00000-0000-4000-8000-000000000001','active'),
 ('eee00000-0000-4000-8000-000000000020','eee00000-0000-4000-8000-000000000003','active');
insert into public.relationship_members(relationship_id,user_id,status) values
 ('eee00000-0000-4000-8000-000000000010','eee00000-0000-4000-8000-000000000001','active'),
 ('eee00000-0000-4000-8000-000000000010','eee00000-0000-4000-8000-000000000002','active'),
 ('eee00000-0000-4000-8000-000000000020','eee00000-0000-4000-8000-000000000003','active');
insert into public.messages(id,relationship_id,sender_id,ciphertext,iv,logical_timestamp,content_type) values
 ('eee00000-0000-4000-8000-000000000100','eee00000-0000-4000-8000-000000000010','eee00000-0000-4000-8000-000000000001',repeat('a',32),repeat('b',16),'2026-09-02T15:00:00.000Z','message');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"eee00000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.messages where id='eee00000-0000-4000-8000-000000000100') then raise exception 'third_party_message_leak'; end if;
  if exists(select 1 from public.chat_unread('eee00000-0000-4000-8000-000000000010')) then raise exception 'third_party_counter_leak'; end if;
  begin
    insert into public.message_receipts(message_id,relationship_id,user_id,status) values('eee00000-0000-4000-8000-000000000100','eee00000-0000-4000-8000-000000000020','eee00000-0000-4000-8000-000000000003','read');
    raise exception 'cross_relation_receipt_allowed';
  exception when check_violation or raise_exception then
    if sqlerrm='cross_relation_receipt_allowed' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claims','{"sub":"eee00000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.chat_unread('eee00000-0000-4000-8000-000000000010')) <> 1 then raise exception 'unread_count_wrong'; end if;
end $$;
insert into public.message_receipts(message_id,relationship_id,user_id,status) values('eee00000-0000-4000-8000-000000000100','eee00000-0000-4000-8000-000000000010','eee00000-0000-4000-8000-000000000002','read');
do $$ begin
  if exists(select 1 from public.chat_unread('eee00000-0000-4000-8000-000000000010')) then raise exception 'read_did_not_clear_counter'; end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.push_jobs where message_id='eee00000-0000-4000-8000-000000000100' and state <> 'cancelled') then raise exception 'read_did_not_cancel_reminders'; end if;
end $$;
select pass('isolated membership, unread, receipts and reminder cancellation');
select * from finish();
rollback;
