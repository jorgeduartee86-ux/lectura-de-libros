import webpush from 'npm:web-push@3.6.7'
import { z } from 'npm:zod@4'
import { authenticatedClients, json, preflight, publicError } from '../_shared/http.ts'

const genericMessages = [
  'Tienes una nueva recomendación de lectura.',
  'Se añadió un nuevo marcapáginas.',
  'Hay una página nueva disponible.',
  'Tu biblioteca fue actualizada.',
  'Tienes una nueva cita guardada.',
  'Se abrió un nuevo capítulo.',
  'Hay una sorpresa entre páginas.',
] as const
const schema = z.object({
  relationshipId: z.uuid(),
  notificationKind: z
    .number()
    .int()
    .min(0)
    .max(genericMessages.length - 1),
})

Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options
  try {
    const body = schema.parse(await request.json())
    const { user, admin } = await authenticatedClients(request)
    const { data: member } = await admin
      .from('relationship_members')
      .select('relationship_id')
      .eq('relationship_id', body.relationshipId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    if (!member) throw new Error('forbidden')
    const { data: allowed } = await admin.rpc('consume_rate_limit', {
      p_key: `push:${user.id}`,
      p_limit: 20,
      p_window_seconds: 3600,
    })
    if (!allowed) throw new Error('rate_limited')
    const { data: recipient } = await admin
      .from('relationship_members')
      .select('user_id')
      .eq('relationship_id', body.relationshipId)
      .eq('status', 'active')
      .neq('user_id', user.id)
      .maybeSingle()
    if (!recipient) return json(request, { sent: 0 })
    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('id,subscription')
      .eq('user_id', recipient.user_id)
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )
    let sent = 0
    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          subscription.subscription,
          JSON.stringify({
            title: 'Lectura de libros',
            body: genericMessages[body.notificationKind],
            url: '/',
          }),
          { TTL: 3600 },
        )
        sent += 1
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410)
          await admin.from('push_subscriptions').delete().eq('id', subscription.id)
      }
    }
    return json(request, { sent })
  } catch (error) {
    return json(request, { error: error instanceof z.ZodError ? 'invalid_payload' : publicError(error) }, 400)
  }
})
