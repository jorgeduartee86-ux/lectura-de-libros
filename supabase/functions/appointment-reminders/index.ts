import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (request) => {
  if (request.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET'))
    return new Response('Unauthorized', { status: 401 })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const now = new Date()
  const windowEnd = new Date(now.getTime() + 15 * 60_000)
  const { data: dates, error } = await admin
    .from('virtual_dates')
    .select('id,relationship_id')
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', windowEnd.toISOString())
    .is('reminder_sent_at', null)
    .limit(100)
  if (error) return new Response('Failed', { status: 500 })
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT')!,
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )
  for (const date of dates ?? []) {
    const { data: members } = await admin
      .from('relationship_members')
      .select('user_id')
      .eq('relationship_id', date.relationship_id)
      .eq('status', 'active')
    for (const member of members ?? []) {
      const { data: subscriptions } = await admin
        .from('push_subscriptions')
        .select('id,subscription')
        .eq('user_id', member.user_id)
      for (const subscription of subscriptions ?? []) {
        try {
          await webpush.sendNotification(
            subscription.subscription,
            JSON.stringify({
              title: 'Lectura de libros',
              body: 'Hay un nuevo evento en tu agenda de lectura.',
              url: Deno.env.get('APP_URL') ?? 'https://jorgeduartee86-ux.github.io/lectura-de-libros/',
            }),
            { TTL: 900 },
          )
        } catch (pushError) {
          const status = (pushError as { statusCode?: number }).statusCode
          if (status === 404 || status === 410)
            await admin.from('push_subscriptions').delete().eq('id', subscription.id)
        }
      }
    }
    await admin.from('virtual_dates').update({ reminder_sent_at: new Date().toISOString() }).eq('id', date.id)
  }
  return new Response('OK')
})
