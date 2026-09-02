import { getSetting, putSetting } from './storage'
import { supabase } from './supabase'
import type { AppSession } from '../types'

export type PushState = NotificationPermission | 'unsupported' | 'error'
export { defaultPushPreferences, type PushPreferences } from '../../supabase/functions/_shared/push-policy'

export function getPushState(): PushState {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window))
    return 'unsupported'
  return Notification.permission
}

function urlBase64ToBytes(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const binary = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function deviceLabel() {
  if (/Android/i.test(navigator.userAgent)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'iPhone o iPad'
  return 'Navegador actual'
}

export async function enablePushNotifications(
  session: AppSession,
  requestPermission = true,
): Promise<PushState> {
  if (getPushState() === 'unsupported' || !supabase) return 'unsupported'

  let permission = Notification.permission
  if (permission === 'default' && requestPermission) permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission

  try {
    if (!requestPermission) {
      const { data, error } = await supabase
        .from('user_notification_settings')
        .select('enabled')
        .eq('user_id', session.userId)
        .maybeSingle()
      if (error || data?.enabled === false) return 'granted'
    }
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
    if (!publicKey) return 'error'
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    const expectedKey = urlBase64ToBytes(publicKey)
    const currentKey = subscription?.options.applicationServerKey
    if (
      subscription &&
      currentKey &&
      new Uint8Array(currentKey).some((byte, index) => byte !== expectedKey[index])
    ) {
      await subscription.unsubscribe()
      subscription = null
    }
    subscription =
      subscription ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(publicKey),
      }))

    const deviceKey = `pushDeviceId:${session.userId}`
    let deviceId = await getSetting<string>(deviceKey)
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      await putSetting(deviceKey, deviceId)
    }

    const { data, error: subscriptionError } = await supabase.functions.invoke('register-push', {
      body: { deviceId, platform: deviceLabel(), subscription: subscription.toJSON() },
    })
    if (subscriptionError) throw subscriptionError
    if (data?.deviceId) await putSetting(deviceKey, data.deviceId)
    await putSetting('push-registration-error', '')
    return 'granted'
  } catch {
    await putSetting(
      'push-registration-error',
      'No se pudo registrar el dispositivo. Revisa la conexión y prueba de nuevo.',
    )
    return 'error'
  }
}

export async function disableCurrentPush(session: AppSession) {
  const registration = await navigator.serviceWorker?.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) await subscription.unsubscribe()
  const id = await getSetting<string>(`pushDeviceId:${session.userId}`)
  if (id && supabase)
    await supabase.from('push_subscriptions').delete().eq('user_id', session.userId).eq('device_id', id)
}
export async function pushDiagnostics(session: AppSession) {
  const registration =
    'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
  const subscription =
    registration && 'pushManager' in registration ? await registration.pushManager.getSubscription() : null
  const deviceId = await getSetting<string>(`pushDeviceId:${session.userId}`)
  const remote =
    supabase && deviceId
      ? await supabase
          .from('push_subscriptions')
          .select('last_push_at,last_error')
          .eq('user_id', session.userId)
          .eq('device_id', deviceId)
          .maybeSingle()
      : null
  const storedError = await getSetting<string>('push-registration-error')
  return {
    permission: getPushState(),
    worker: !!registration?.active,
    scope: registration?.scope ?? 'Sin registro',
    subscription: !!subscription,
    standalone:
      matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    badge: 'setAppBadge' in navigator,
    lastPush: remote?.data?.last_push_at ?? null,
    error: remote?.data?.last_error || storedError || '',
    deviceId,
  }
}
