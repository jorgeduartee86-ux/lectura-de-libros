export interface PushPreferences {
  enabled: boolean
  privacy: 'discreet' | 'medium' | 'direct'
  sound: boolean
  vibration: boolean
  romance: boolean
  reminder_minutes: number
  quiet_start: number | null
  quiet_end: number | null
  timezone: string
  kinds: string[]
}
export const defaultPushPreferences: PushPreferences = {
  enabled: true,
  privacy: 'discreet',
  sound: false,
  vibration: false,
  romance: true,
  reminder_minutes: 0,
  quiet_start: null,
  quiet_end: null,
  timezone: 'America/Bogota',
  kinds: ['message', 'sticker', 'letter', 'signal', 'date', 'gift'],
}
export function isQuietTime(settings: PushPreferences, now = new Date()) {
  if (
    settings.quiet_start === null ||
    settings.quiet_end === null ||
    settings.quiet_start === settings.quiet_end
  )
    return false
  let hour: number
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: settings.timezone,
        hour: 'numeric',
        hourCycle: 'h23',
      }).format(now),
    )
  } catch {
    return false
  }
  return settings.quiet_start < settings.quiet_end
    ? hour >= settings.quiet_start && hour < settings.quiet_end
    : hour >= settings.quiet_start || hour < settings.quiet_end
}
export function notificationBody(
  privacy: PushPreferences['privacy'],
  mutualDirect: boolean,
  senderName: string,
) {
  if (privacy === 'direct' && mutualDirect && senderName.trim())
    return `${senderName.slice(0, 50)} te envió un mensaje`
  return privacy === 'medium' ? 'Tienes un mensaje nuevo' : 'Tienes una nueva página'
}
export function validPushEndpoint(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'fcm.googleapis.com' ||
        url.hostname === 'android.googleapis.com' ||
        url.hostname === 'updates.push.services.mozilla.com' ||
        url.hostname.endsWith('.push.apple.com') ||
        url.hostname === 'web.push.apple.com' ||
        url.hostname.endsWith('.notify.windows.com'))
    )
  } catch {
    return false
  }
}
