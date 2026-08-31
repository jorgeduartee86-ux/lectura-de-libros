import { getSetting, putSetting } from './storage'
import { supabase } from './supabase'
import type { AppSession } from '../types'

export type PushState = NotificationPermission | 'unsupported' | 'error'

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
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
    if (!publicKey) return 'error'
    const registration = await navigator.serviceWorker.ready
    const subscription =
      (await registration.pushManager.getSubscription()) ??
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

    const { error: deviceError } = await supabase.from('devices').upsert({
      id: deviceId,
      user_id: session.userId,
      label: deviceLabel(),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    })
    if (deviceError) throw deviceError

    const { error: subscriptionError } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: session.userId,
        device_id: deviceId,
        subscription: subscription.toJSON(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' },
    )
    if (subscriptionError) throw subscriptionError
    return 'granted'
  } catch {
    return 'error'
  }
}
