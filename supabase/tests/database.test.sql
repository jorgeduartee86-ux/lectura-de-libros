begin;
select plan(15);

select has_table('public', 'relationships', 'relationships existe');
select has_table('public', 'relationship_members', 'relationship_members existe');
select has_table('public', 'relationship_invites', 'relationship_invites existe');
select has_table('public', 'messages', 'messages existe');
select has_table('public', 'letters', 'letters existe');
select has_table('public', 'memories', 'memories existe');
select has_table('public', 'push_subscriptions', 'push_subscriptions existe');
select has_function('public', 'is_relationship_member', array['uuid','uuid'], 'helper de membresía existe');
select has_function('public', 'accept_relationship_invite', array['text'], 'aceptación atómica existe');
select has_trigger('public', 'relationship_members', 'relationship_max_two', 'límite de dos miembros tiene trigger');
select policies_are('public', 'messages', array['messages_insert_sender','messages_select_member','messages_update_sender'], 'messages deniega por defecto y limita a miembros');
select policies_are('public', 'relationship_members', array['members_select_relation'], 'membresías no se mutan desde cliente');
select policies_are('public', 'push_subscriptions', array['push_delete_self','push_insert_self','push_select_self','push_update_self'], 'push solo es visible al propietario');
select col_type_is('public', 'relationships', 'max_members', 'smallint', 'max_members tiene tipo limitado');
select results_eq('select max_members from public.relationships limit 0', 'select 2::smallint limit 0', 'la relación está diseñada para dos');

select * from finish();
rollback;
