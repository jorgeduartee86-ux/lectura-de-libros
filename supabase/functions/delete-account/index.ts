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
      .maybeSingle()
    if (member) {
      await admin
        .from('relationship_members')
        .update({ status: 'revoked' })
        .eq('relationship_id', member.relationship_id)
      await admin.from('relationships').update({ status: 'unlinked' }).eq('id', member.relationship_id)
    }
    await admin.from('push_subscriptions').delete().eq('user_id', user.id)
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw error
    return json(request, { deleted: true })
  } catch (error) {
    return json(request, { error: publicError(error) }, 400)
  }
})
