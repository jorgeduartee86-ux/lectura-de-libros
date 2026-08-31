import { authenticatedClients, json, preflight, publicError } from '../_shared/http.ts'

Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  try {
    const { user, admin } = await authenticatedClients(request)
    const allowlist = (Deno.env.get('RELATIONSHIP_EMAIL_ALLOWLIST') ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
    if (allowlist.length && (!user.email || !allowlist.includes(user.email.toLowerCase())))
      throw new Error('forbidden')
    const { data: existing } = await admin
      .from('relationship_members')
      .select('relationship_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) return json(request, { relationshipId: existing.relationship_id, existing: true })
    const { data: relationship, error: relationError } = await admin
      .from('relationships')
      .insert({ created_by: user.id, status: 'pending' })
      .select('id')
      .single()
    if (relationError) throw relationError
    const { error: memberError } = await admin.from('relationship_members').insert({
      relationship_id: relationship.id,
      user_id: user.id,
      status: 'active',
      consented_at: new Date().toISOString(),
    })
    if (memberError) {
      await admin.from('relationships').delete().eq('id', relationship.id)
      throw memberError
    }
    await admin.from('profiles').upsert({ id: user.id, display_name: user.user_metadata?.display_name ?? '' })
    await admin
      .from('audit_events')
      .insert({ relationship_id: relationship.id, actor_id: user.id, event_type: 'relationship_created' })
    return json(request, { relationshipId: relationship.id }, 201)
  } catch (error) {
    return json(request, { error: publicError(error) }, 400)
  }
})
