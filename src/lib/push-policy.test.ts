import { describe, expect, it } from 'vitest'
import {
  defaultPushPreferences,
  isQuietTime,
  notificationBody,
  validPushEndpoint,
} from '../../supabase/functions/_shared/push-policy'
describe('privacidad y horario de notificaciones', () => {
  it('es discreto por defecto y no activa recordatorios sin elección', () => {
    expect(defaultPushPreferences.privacy).toBe('discreet')
    expect(defaultPushPreferences.reminder_minutes).toBe(0)
  })
  it('solo muestra el nombre con consentimiento mutuo', () => {
    expect(notificationBody('direct', false, 'Ana')).toBe('Tienes una nueva página')
    expect(notificationBody('direct', true, 'Ana')).toBe('Ana te envió un mensaje')
    expect(notificationBody('medium', true, 'Ana')).toBe('Tienes un mensaje nuevo')
  })
  it('respeta horario que cruza medianoche y zona horaria', () => {
    const settings = { ...defaultPushPreferences, quiet_start: 22, quiet_end: 7 }
    expect(isQuietTime(settings, new Date('2026-09-02T04:00:00Z'))).toBe(true)
    expect(isQuietTime(settings, new Date('2026-09-02T14:00:00Z'))).toBe(false)
    expect(isQuietTime(defaultPushPreferences)).toBe(false)
  })
  it('rechaza endpoints internos o falsos antes de hacer solicitudes push', () => {
    expect(validPushEndpoint('https://fcm.googleapis.com/fcm/send/token')).toBe(true)
    expect(validPushEndpoint('https://web.push.apple.com/abc')).toBe(true)
    for (const url of [
      'http://localhost',
      'https://127.0.0.1/admin',
      'https://fcm.googleapis.com.evil.test',
      'https://fcm.googleapis.com:444/x',
      'https://user:pass@fcm.googleapis.com/a',
    ])
      expect(validPushEndpoint(url)).toBe(false)
  })
})
