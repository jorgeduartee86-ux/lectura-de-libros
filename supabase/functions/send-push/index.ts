import { z } from 'npm:zod@4'
import { authenticatedClients, json, preflight } from '../_shared/http.ts'
import { assertMember } from '../_shared/r2.ts'
import { deliverJobs, sendTestPush } from '../_shared/push-delivery.ts'
const schema = z.object({
  relationshipId: z.uuid(),
  messageId: z.uuid().optional(),
  testDeviceId: z.uuid().optional(),
  notificationKind: z.number().int().min(0).max(6).optional(),
})
Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options
  try {
    const input = schema.parse(await request.json()),
      clients = await authenticatedClients(request)
    await assertMember(clients, input.relationshipId)
    const { data: allowed } = await clients.admin.rpc('consume_rate_limit', {
      p_key: `push-request:${clients.user.id}`,
      p_limit: input.testDeviceId ? 6 : 240,
      p_window_seconds: 3600,
    })
    if (!allowed) throw new Error('rate_limited')
    if (input.testDeviceId)
      return json(
        request,
        await sendTestPush(clients.admin, clients.user.id, input.testDeviceId, input.relationshipId),
      )
    if (input.messageId) {
      const { data } = await clients.admin
        .from('messages')
        .select('sender_id,relationship_id')
        .eq('id', input.messageId)
        .maybeSingle()
      if (!data || data.sender_id !== clients.user.id || data.relationship_id !== input.relationshipId)
        throw new Error('forbidden')
    }
    // Jobs are inserted transactionally with content, not fabricated from client payloads.
    return json(request, await deliverJobs(clients.admin, input.messageId ?? null))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'operation_failed'
    return json(
      request,
      {
        error: [
          'authentication_required',
          'forbidden',
          'rate_limited',
          'device_not_found',
          'not_configured',
          'push_delivery_failed',
        ].includes(message)
          ? message
          : 'operation_failed',
      },
      400,
    )
  }
})
