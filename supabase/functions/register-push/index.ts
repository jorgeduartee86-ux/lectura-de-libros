import { z } from 'npm:zod@4'
import { authenticatedClients, json, preflight } from '../_shared/http.ts'
import { validPushEndpoint } from '../_shared/push-policy.ts'
const schema = z.object({
  deviceId: z.uuid(),
  platform: z.string().max(80),
  subscription: z.object({
    endpoint: z.url().max(2048),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({ p256dh: z.string().min(30).max(200), auth: z.string().min(15).max(100) }),
  }),
})
Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options
  try {
    const body = schema.parse(await request.json()),
      { admin, user } = await authenticatedClients(request)
    if (!validPushEndpoint(body.subscription.endpoint)) throw new Error('invalid_endpoint')
    const { data: existing } = await admin
      .from('devices')
      .select('user_id')
      .eq('id', body.deviceId)
      .maybeSingle()
    const deviceId = existing && existing.user_id !== user.id ? crypto.randomUUID() : body.deviceId
    const { error: deviceError } = await admin
      .from('devices')
      .upsert({
        id: deviceId,
        user_id: user.id,
        label: body.platform,
        last_seen_at: new Date().toISOString(),
        revoked_at: null,
      })
    if (deviceError) throw deviceError
    // The same browser endpoint can outlive an anonymous auth session. Keep one active ownership entry.
    const { data: duplicate } = await admin
      .from('push_subscriptions')
      .select('id,user_id,device_id')
      .eq('subscription->>endpoint', body.subscription.endpoint)
    for (const row of duplicate ?? [])
      if (row.user_id !== user.id || row.device_id !== deviceId)
        await admin.from('push_subscriptions').delete().eq('id', row.id)
    const { error } = await admin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          device_id: deviceId,
          platform: body.platform,
          subscription: body.subscription,
          updated_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: 'user_id,device_id' },
      )
    if (error) throw error
    return json(request, { deviceId, registered: true })
  } catch {
    return json(request, { error: 'push_registration_failed' }, 400)
  }
})
