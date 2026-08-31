import { z } from 'npm:zod@4'
import { authenticatedClients, json, preflight, publicError, randomToken, sha256 } from '../_shared/http.ts'

const schema = z.object({
  pairingEnvelope: z.object({
    ciphertext: z.string().min(24).max(2048),
    iv: z.string().min(16).max(64),
    cryptoVersion: z.literal(1),
  }),
  expiresInHours: z.number().int().min(1).max(168).default(24),
})

Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options
  try {
    const body = schema.parse(await request.json())
    const { user, admin } = await authenticatedClients(request)
    const { data: member } = await admin
      .from('relationship_members')
      .select('relationship_id,status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()
    if (!member) throw new Error('forbidden')
    const { count } = await admin
      .from('relationship_members')
      .select('*', { count: 'exact', head: true })
      .eq('relationship_id', member.relationship_id)
      .neq('status', 'revoked')
    if ((count ?? 0) >= 2) throw new Error('relationship_full')
    const { data: allowed } = await admin.rpc('consume_rate_limit', {
      p_key: `invite:${user.id}`,
      p_limit: 5,
      p_window_seconds: 3600,
    })
    if (!allowed) throw new Error('rate_limited')
    await admin
      .from('relationship_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('relationship_id', member.relationship_id)
      .is('used_at', null)
      .is('revoked_at', null)
    const token = randomToken()
    const tokenHash = await sha256(token)
    const expiresAt = new Date(Date.now() + body.expiresInHours * 3600_000).toISOString()
    const { error } = await admin.from('relationship_invites').insert({
      relationship_id: member.relationship_id,
      created_by: user.id,
      token_hash: tokenHash,
      pairing_envelope: body.pairingEnvelope,
      expires_at: expiresAt,
    })
    if (error) throw error
    await admin.from('audit_events').insert({
      relationship_id: member.relationship_id,
      actor_id: user.id,
      event_type: 'invite_created',
      metadata: { expires_at: expiresAt },
    })
    return json(request, { token, expiresAt }, 201)
  } catch (error) {
    return json(request, { error: error instanceof z.ZodError ? 'invalid_payload' : publicError(error) }, 400)
  }
})
