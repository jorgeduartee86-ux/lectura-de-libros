import { z } from 'npm:zod@4'
import { authenticatedClients, json, preflight, publicError, sha256 } from '../_shared/http.ts'

const schema = z.object({ token: z.string().min(20).max(200), consent: z.literal(true) })

Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options
  try {
    const body = schema.parse(await request.json())
    const { user, userClient, admin } = await authenticatedClients(request)
    const tokenHash = await sha256(body.token)
    const { data, error } = await userClient
      .rpc('accept_relationship_invite', { p_token_hash: tokenHash })
      .single()
    if (error || !data)
      throw new Error(
        error?.message.includes('invite_')
          ? 'invite_invalid_or_expired'
          : (error?.message ?? 'operation_failed'),
      )
    await admin.from('profiles').upsert({ id: user.id, display_name: user.user_metadata?.display_name ?? '' })
    return json(request, { relationshipId: data.relationship_id, pairingEnvelope: data.pairing_envelope })
  } catch (error) {
    return json(request, { error: error instanceof z.ZodError ? 'invalid_payload' : publicError(error) }, 400)
  }
})
