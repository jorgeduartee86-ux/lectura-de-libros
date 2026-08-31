import { authenticatedClients, json, preflight, publicError } from '../_shared/http.ts'

Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options
  try {
    const { user, admin } = await authenticatedClients(request)
    const { data: member } = await admin
      .from('relationship_members')
      .select('relationship_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()
    if (!member) throw new Error('forbidden')
    await admin
      .from('relationship_members')
      .update({ status: 'revoked' })
      .eq('relationship_id', member.relationship_id)
    await admin.from('relationships').update({ status: 'unlinked' }).eq('id', member.relationship_id)
    await admin
      .from('relationship_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('relationship_id', member.relationship_id)
      .is('used_at', null)
    await admin.from('audit_events').insert({
      relationship_id: member.relationship_id,
      actor_id: user.id,
      event_type: 'relationship_unlinked',
    })
    return json(request, { unlinked: true })
  } catch (error) {
    return json(request, { error: publicError(error) }, 400)
  }
})
