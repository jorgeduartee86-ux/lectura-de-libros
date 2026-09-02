import webpush from 'npm:web-push@3.6.7'
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import {
  defaultPushPreferences,
  isQuietTime,
  notificationBody,
  validPushEndpoint,
  type PushPreferences,
} from './push-policy.ts'
type PushJob = {
  id: string
  relationship_id: string
  sender_id: string
  recipient_id: string
  message_id: string | null
  kind: string
  attempts: number
  reminder_number: number
  created_at: string
}
function setupPush() {
  const subject = Deno.env.get('VAPID_SUBJECT'),
    publicKey = Deno.env.get('VAPID_PUBLIC_KEY'),
    privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!subject || !publicKey || !privateKey) throw new Error('not_configured')
  webpush.setVapidDetails(subject, publicKey, privateKey)
}
export async function unreadCount(admin: SupabaseClient, relationship: string, user: string) {
  const { data, error } = await admin.rpc('count_unread_for_user', {
    p_relationship: relationship,
    p_user: user,
  })
  if (error) throw error
  return Number(data ?? 0)
}
export function pushPayload(
  body: string,
  count: number,
  tag: string,
  messageId?: string | null,
  kind = 'message',
  silent = true,
  vibration = false,
) {
  const base = (Deno.env.get('APP_URL') ?? 'https://jorgeduartee86-ux.github.io/lectura-de-libros/').replace(
    /\/?$/,
    '/',
  )
  const route =
    kind === 'letter'
      ? 'cartas'
      : kind === 'signal'
        ? 'marcapaginas'
        : kind === 'date'
          ? 'cita'
          : kind === 'gift'
            ? 'regalos'
            : 'conversacion'
  const url = `${base}historia/${route}${messageId ? `?message=${encodeURIComponent(messageId)}` : ''}`
  const notification = {
    title: 'Lectura de libros',
    body,
    navigate: url,
    tag,
    renotify: false,
    silent,
    app_badge: String(count),
    timestamp: Date.now(),
  }
  // WebKit declarative fallback and classic service-worker payload in the same message.
  return {
    web_push: 8030,
    notification,
    title: notification.title,
    body,
    url,
    tag,
    count,
    timestamp: notification.timestamp,
    silent,
    vibration,
  }
}
async function sendOne(
  admin: SupabaseClient,
  subscription: { id: string; subscription: unknown },
  payload: unknown,
) {
  if (!validPushEndpoint((subscription.subscription as { endpoint?: string })?.endpoint ?? ''))
    return 'expired'
  try {
    await webpush.sendNotification(subscription.subscription, JSON.stringify(payload), {
      TTL: 86400,
      urgency: 'normal',
      timeout: 10000,
    })
    await admin
      .from('push_subscriptions')
      .update({ last_push_at: new Date().toISOString(), last_error: null })
      .eq('id', subscription.id)
    return 'sent'
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) {
      await admin.from('push_subscriptions').delete().eq('id', subscription.id)
      return 'expired'
    }
    await admin
      .from('push_subscriptions')
      .update({ last_error: status ? `push_http_${status}` : 'push_network_error' })
      .eq('id', subscription.id)
    return 'retry'
  }
}
export async function sendTestPush(
  admin: SupabaseClient,
  userId: string,
  deviceId: string,
  relationshipId: string,
) {
  setupPush()
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id,subscription')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle()
  if (error || !data) throw new Error('device_not_found')
  const result = await sendOne(
    admin,
    data,
    pushPayload(
      'Esta es tu prueba de notificación.',
      await unreadCount(admin, relationshipId, userId),
      `test-${crypto.randomUUID()}`,
    ),
  )
  if (result !== 'sent') throw new Error('push_delivery_failed')
  return { sent: 1 }
}
export async function deliverJobs(admin: SupabaseClient, messageId: string | null = null) {
  setupPush()
  const { data: jobs, error } = await admin.rpc('claim_push_jobs', { p_message: messageId })
  if (error) throw error
  let sent = 0,
    retries = 0
  for (const job of (jobs ?? []) as PushJob[]) {
    const cancel = () => admin.from('push_jobs').update({ state: 'cancelled' }).eq('id', job.id)
    const { data: members } = await admin
      .from('relationship_members')
      .select('user_id')
      .eq('relationship_id', job.relationship_id)
      .eq('status', 'active')
    if (
      !members?.some((m) => m.user_id === job.recipient_id) ||
      !members.some((m) => m.user_id === job.sender_id)
    ) {
      await cancel()
      continue
    }
    const { data: preferences } = await admin
      .from('user_notification_settings')
      .select('*')
      .eq('user_id', job.recipient_id)
      .maybeSingle()
    const settings: PushPreferences = { ...defaultPushPreferences, ...preferences }
    if (!settings.enabled || !settings.kinds.includes(job.kind)) {
      await cancel()
      continue
    }
    if (job.message_id) {
      const { data: message } = await admin
        .from('messages')
        .select('deleted_at')
        .eq('id', job.message_id)
        .maybeSingle()
      const { count: read } = await admin
        .from('message_receipts')
        .select('message_id', { count: 'exact', head: true })
        .eq('message_id', job.message_id)
        .eq('user_id', job.recipient_id)
        .eq('status', 'read')
      if (!message || message.deleted_at || read) {
        await cancel()
        continue
      }
    }
    if (job.reminder_number > 0 && settings.reminder_minutes === 0) {
      await cancel()
      continue
    }
    if (isQuietTime(settings)) {
      // Postpone, don't consume retry attempts during quiet hours. Re-check reads before dispatch.
      await admin
        .from('push_jobs')
        .update({
          state: 'pending',
          attempts: Math.max(0, job.attempts - 1),
          due_at: new Date(Date.now() + 30 * 60000).toISOString(),
        })
        .eq('id', job.id)
      continue
    }
    const { data: senderSettings } = await admin
      .from('user_notification_settings')
      .select('privacy')
      .eq('user_id', job.sender_id)
      .maybeSingle()
    const { data: profile } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', job.sender_id)
      .maybeSingle()
    const count = await unreadCount(admin, job.relationship_id, job.recipient_id)
    const body = notificationBody(
      settings.privacy,
      senderSettings?.privacy === 'direct',
      profile?.display_name ?? '',
    )
    const payload = pushPayload(
      body,
      count,
      `${job.relationship_id}:${job.message_id ?? job.id}:${job.reminder_number}`,
      job.message_id,
      job.kind,
      !settings.sound,
      settings.vibration,
    )
    const { data: subscriptions } = await admin
      .from('push_subscriptions')
      .select('id,subscription,device_id')
      .eq('user_id', job.recipient_id)
    const { data: devices } = await admin
      .from('devices')
      .select('id')
      .eq('user_id', job.recipient_id)
      .is('revoked_at', null)
    const validDevices = new Set((devices ?? []).map((d) => d.id))
    const { data: previous } = await admin
      .from('push_job_deliveries')
      .select('subscription_id')
      .eq('job_id', job.id)
    const done = new Set((previous ?? []).map((p) => p.subscription_id)),
      endpoints = new Set<string>()
    let failed = false
    for (const subscription of subscriptions ?? []) {
      const endpoint = (subscription.subscription as { endpoint?: string }).endpoint
      if (
        !endpoint ||
        !validDevices.has(subscription.device_id) ||
        done.has(subscription.id) ||
        endpoints.has(endpoint)
      )
        continue
      endpoints.add(endpoint)
      const result = await sendOne(admin, subscription, payload)
      if (result === 'sent') {
        sent++
        await admin
          .from('push_job_deliveries')
          .upsert(
            { job_id: job.id, subscription_id: subscription.id },
            { onConflict: 'job_id,subscription_id' },
          )
      } else if (result === 'retry') failed = true
    }
    if (failed) {
      retries++
      await admin
        .from('push_jobs')
        .update({
          state: job.attempts >= 5 ? 'failed' : 'pending',
          due_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000).toISOString(),
        })
        .eq('id', job.id)
    } else {
      await admin
        .from('push_jobs')
        .update({ state: 'sent', sent_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('state', 'processing')
      if (job.message_id && settings.reminder_minutes > 0 && job.reminder_number < 2) {
        await admin
          .from('push_jobs')
          .upsert(
            {
              relationship_id: job.relationship_id,
              sender_id: job.sender_id,
              recipient_id: job.recipient_id,
              message_id: job.message_id,
              kind: job.kind,
              reminder_number: job.reminder_number + 1,
              due_at: new Date(Date.now() + settings.reminder_minutes * 60000).toISOString(),
            },
            { onConflict: 'message_id,recipient_id,reminder_number', ignoreDuplicates: true },
          )
      }
    }
  }
  return { sent, retries, processed: jobs?.length ?? 0 }
}
