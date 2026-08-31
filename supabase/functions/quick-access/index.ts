import { z } from 'npm:zod@4'
import { authenticatedClients, json, preflight, sha256 } from '../_shared/http.ts'

const schema = z.object({ accessCode: z.string().regex(/^\d{6}$/) })

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  try {
    const body = schema.parse(await request.json())
    const { user, admin } = await authenticatedClients(request)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { data: allowed } = await admin.rpc('consume_rate_limit', {
      p_key: `quick-access:${await sha256(ip)}`,
      p_limit: 12,
      p_window_seconds: 900,
    })
    if (!allowed) return json(request, { error: 'rate_limited' }, 429)

    const expectedHash = Deno.env.get('QUICK_ACCESS_CODE_HASH') ?? ''
    const providedHash = await sha256(body.accessCode)
    if (!expectedHash || !safeEqual(providedHash, expectedHash))
      return json(request, { error: 'invalid_access_code' }, 403)

    const { data, error } = await admin.rpc('join_quick_access', { target_user: user.id }).single()
    if (error) {
      const code = error.message.includes('already_linked') ? 'already_linked' : 'operation_failed'
      return json(request, { error: code }, 400)
    }
    return json(request, {
      relationshipId: data.relationship_id,
      memberLabel: data.member_label,
    })
  } catch (error) {
    return json(request, { error: error instanceof z.ZodError ? 'invalid_payload' : 'operation_failed' }, 400)
  }
})
