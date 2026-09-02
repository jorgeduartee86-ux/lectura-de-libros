import { getSetting } from './storage'
import type { PushPreferences } from './notifications'

// Best-effort local feedback. Browser autoplay restrictions are respected.
export async function softFeedback(userId: string, incoming = false) {
  if (document.hidden) return
  const preferences = await getSetting<PushPreferences>(`push-preferences:${userId}`)
  if (preferences?.vibration) navigator.vibrate?.(incoming ? 25 : 15)
  if (!preferences?.sound || !('AudioContext' in window)) return
  const context = new AudioContext()
  try {
    if (context.state !== 'running') return
    const oscillator = context.createOscillator(),
      gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = incoming ? 620 : 480
    gain.gain.setValueAtTime(0.025, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.13)
    await new Promise<void>((resolve) => {
      oscillator.onended = () => resolve()
    })
  } catch {
    /* Optional feedback must never prevent message delivery. */
  } finally {
    await context.close()
  }
}
