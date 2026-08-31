import { z } from 'npm:zod@4'
import { authenticatedClients, json, preflight, publicError } from '../_shared/http.ts'

const schema = z
  .object({ deviceId: z.uuid().optional(), allOtherDevices: z.boolean().optional() })
  .refine((value) => value.deviceId || value.allOtherDevices)

Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options
  try {
    const body = schema.parse(await request.json())
    const { user, admin } = await authenticatedClients(request)
    let query = admin.from('devices').update({ revoked_at: new Date().toISOString() }).eq('user_id', user.id)
    if (body.deviceId) query = query.eq('id', body.deviceId)
    const { data, error } = await query.select('id')
    if (error) throw error
    for (const device of data ?? [])
      await admin.from('push_subscriptions').delete().eq('device_id', device.id)
    return json(request, { revoked: data?.length ?? 0 })
  } catch (error) {
    return json(request, { error: error instanceof z.ZodError ? 'invalid_payload' : publicError(error) }, 400)
  }
})
