import { BellRing, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { enablePushNotifications, getPushState, type PushState } from '../lib/notifications'
import type { AppSession } from '../types'

export function NotificationOnboarding({ session }: { session: AppSession | null }) {
  const [state, setState] = useState<PushState>(() => getPushState())
  const [visible, setVisible] = useState(() => getPushState() !== 'unsupported')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!session || getPushState() !== 'granted') return
    void enablePushNotifications(session, false).then(setState)
  }, [session])

  if (!session || !visible || state === 'granted' || state === 'unsupported') return null

  const activate = async () => {
    setBusy(true)
    const next = await enablePushNotifications(session)
    setState(next)
    setBusy(false)
    if (next === 'granted') window.setTimeout(() => setVisible(false), 900)
  }

  return (
    <aside className="notification-onboarding" role="status" aria-live="polite">
      <button className="notification-dismiss" onClick={() => setVisible(false)} aria-label="Cerrar aviso">
        <X />
      </button>
      <span className="notification-onboarding-icon">
        <BellRing />
      </span>
      <div>
        <strong>{state === 'denied' ? 'Notificaciones bloqueadas' : 'No te pierdas una página nueva'}</strong>
        <p>
          {state === 'denied'
            ? 'Actívalas desde los permisos de esta aplicación en tu teléfono.'
            : 'Toca una vez para recibir avisos discretos cuando llegue un mensaje.'}
        </p>
      </div>
      {state !== 'denied' && (
        <button className="notification-enable" disabled={busy} onClick={() => void activate()}>
          {busy ? 'Activando…' : state === 'error' ? 'Intentar otra vez' : 'Activar avisos'}
        </button>
      )}
    </aside>
  )
}
