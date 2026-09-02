import { useCallback, useEffect, useState } from 'react'
import { BellRing, Check, RefreshCw, ShieldCheck } from 'lucide-react'
import { Notice } from '../../components/ui'
import {
  defaultPushPreferences,
  disableCurrentPush,
  enablePushNotifications,
  pushDiagnostics,
  type PushPreferences,
} from '../../lib/notifications'
import { getSetting, putSetting } from '../../lib/storage'
import { edgeCall } from '../../lib/media/repository'
import { supabase } from '../../lib/supabase'
import { useAppStore } from '../../store/app'

export function NotificationSettingsPage() {
  const session = useAppStore((s) => s.session),
    theme = useAppStore((s) => s.theme),
    setTheme = useAppStore((s) => s.setTheme)
  const [settings, setSettings] = useState<PushPreferences>(defaultPushPreferences),
    [diagnostics, setDiagnostics] = useState<Awaited<ReturnType<typeof pushDiagnostics>>>(),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('')
  const refresh = useCallback(async () => {
    if (session) setDiagnostics(await pushDiagnostics(session))
  }, [session])
  useEffect(() => {
    if (!session) return
    void (async () => {
      const cached = await getSetting<PushPreferences>(`push-preferences:${session.userId}`)
      const remote = supabase
        ? await supabase
            .from('user_notification_settings')
            .select('*')
            .eq('user_id', session.userId)
            .maybeSingle()
        : null
      setSettings({ ...defaultPushPreferences, ...cached, ...remote?.data })
      await refresh()
    })()
  }, [session, refresh])
  if (!session) return null
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      // Validate the IANA zone before scheduling quiet hours.
      new Intl.DateTimeFormat('es', { timeZone: settings.timezone }).format(new Date())
      if (!supabase || !navigator.onLine)
        throw new Error('Conéctate para guardar tus preferencias en todos los dispositivos.')
      const { error } = await supabase
        .from('user_notification_settings')
        .upsert({ ...settings, user_id: session.userId, updated_at: new Date().toISOString() })
      if (error) throw error
      await putSetting(`push-preferences:${session.userId}`, settings)
      if (!settings.enabled) await disableCurrentPush(session)
      setNotice('Preferencias guardadas.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar.')
    } finally {
      setBusy(false)
    }
  }
  const activate = async () => {
    setBusy(true)
    setError('')
    const state = await enablePushNotifications(session)
    if (state !== 'granted')
      setError(
        state === 'denied'
          ? 'Los avisos están bloqueados en el navegador. Debes permitirlos desde los ajustes del teléfono.'
          : 'No se pudo activar. Revisa el diagnóstico.',
      )
    else {
      setSettings((s) => ({ ...s, enabled: true }))
      setNotice('Este dispositivo está suscrito. Guarda tus preferencias si cambiaste alguna opción.')
    }
    await refresh()
    setBusy(false)
  }
  return (
    <main className="private-page notification-settings">
      <header className="private-page-heading">
        <div>
          <p className="private-eyebrow">SIN PERDER NUESTRAS PÁGINAS</p>
          <h1>Avisos a tu manera</h1>
          <p>Discretos por fuera. Claros para ti.</p>
        </div>
        <BellRing />
      </header>
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}
      <section className="settings-card notification-card">
        <h2>Este dispositivo</h2>
        <p>El teléfono necesita tu permiso. Una página web no puede concedérselo sola.</p>
        <div className="settings-actions">
          <button className="private-primary" disabled={busy} onClick={() => void activate()}>
            <BellRing />
            Activar o reparar avisos
          </button>
          <button
            className="private-secondary"
            disabled={busy || !diagnostics?.subscription}
            onClick={async () => {
              setBusy(true)
              try {
                const result = await edgeCall<{ sent: number }>('send-push', {
                  relationshipId: session.relationshipId,
                  testDeviceId: diagnostics?.deviceId,
                })
                setNotice(
                  result.sent
                    ? 'La prueba fue aceptada por el servicio push. Comprueba el aviso en este teléfono.'
                    : 'No se pudo enviar la prueba.',
                )
                await refresh()
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Falló la prueba.')
              } finally {
                setBusy(false)
              }
            }}
          >
            Probar notificación
          </button>
        </div>
      </section>
      <section className="settings-card notification-card">
        <h2>Privacidad y entrega</h2>
        <label className="toggle-row">
          <span>Recibir notificaciones</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
          />
        </label>
        <label className="field">
          Qué aparece en el aviso
          <select
            value={settings.privacy}
            onChange={(e) =>
              setSettings({ ...settings, privacy: e.target.value as PushPreferences['privacy'] })
            }
          >
            <option value="discreet">Discreto · Tienes una nueva página</option>
            <option value="medium">Medio · Tienes un mensaje nuevo</option>
            <option value="direct">Directo · Nombre, solo si ambos lo eligen</option>
          </select>
        </label>
        <small>
          <ShieldCheck size={13} /> Nunca se muestra el texto, la foto ni el contenido de una carta.
        </small>
        <label className="field">
          Recordarme si no lo he abierto
          <select
            value={settings.reminder_minutes}
            onChange={(e) => setSettings({ ...settings, reminder_minutes: Number(e.target.value) })}
          >
            <option value="0">Desactivado</option>
            <option value="30">Después de 30 minutos</option>
            <option value="60">Después de 1 hora</option>
            <option value="180">Después de 3 horas</option>
          </select>
        </label>
        <small>Máximo dos recordatorios por mensaje. Se cancelan al leerlo.</small>
        <div className="quiet-hours">
          <label className="field">
            Silencio desde
            <select
              value={settings.quiet_start ?? ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  quiet_start: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Desactivado</option>
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Hasta
            <select
              value={settings.quiet_end ?? ''}
              onChange={(e) =>
                setSettings({ ...settings, quiet_end: e.target.value === '' ? null : Number(e.target.value) })
              }
            >
              <option value="">Desactivado</option>
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {String(hour).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          Zona horaria
          <input
            value={settings.timezone}
            onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
          />
        </label>
        <h3>Qué quieres recibir</h3>
        <div className="notification-kinds">
          {[
            ['message', 'Mensajes'],
            ['sticker', 'Stickers'],
            ['letter', 'Cartas'],
            ['signal', 'Marcapáginas'],
            ['date', 'Citas'],
            ['gift', 'Regalos'],
          ].map(([kind, label]) => (
            <label key={kind}>
              <input
                type="checkbox"
                checked={settings.kinds.includes(kind)}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    kinds: e.target.checked
                      ? [...settings.kinds, kind]
                      : settings.kinds.filter((k) => k !== kind),
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
        {(['sound', 'vibration', 'romance'] as const).map((key, i) => (
          <label className="toggle-row" key={key}>
            <span>
              {
                [
                  'Sonido suave (según el teléfono)',
                  'Vibración (si es compatible)',
                  'Gestos y animaciones románticas',
                ][i]
              }
            </span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
            />
          </label>
        ))}
        <label className="field">
          Apariencia
          <select
            aria-label="Apariencia"
            value={theme}
            onChange={(e) => void setTheme(e.target.value as 'light' | 'dark')}
          >
            <option value="light">Luz de día</option>
            <option value="dark">Entre la noche</option>
          </select>
        </label>
        <button className="private-primary" disabled={busy} onClick={() => void save()}>
          <Check />
          Guardar preferencias
        </button>
      </section>
      <section className="settings-card notification-card">
        <header className="diagnostic-heading">
          <h2>Diagnóstico</h2>
          <button className="icon-button" aria-label="Actualizar diagnóstico" onClick={() => void refresh()}>
            <RefreshCw />
          </button>
        </header>
        <dl className="diagnostic-grid">
          <dt>Permiso</dt>
          <dd>{diagnostics?.permission ?? 'Comprobando'}</dd>
          <dt>App instalada</dt>
          <dd>{diagnostics?.standalone ? 'Sí' : 'Abierta en navegador'}</dd>
          <dt>Suscripción</dt>
          <dd>{diagnostics?.subscription ? 'Activa' : 'Sin suscripción'}</dd>
          <dt>Service worker</dt>
          <dd>{diagnostics?.worker ? 'Activo' : 'No registrado'}</dd>
          <dt>Badge del icono</dt>
          <dd>{diagnostics?.badge ? 'Compatible' : 'No disponible aquí'}</dd>
          <dt>Último push aceptado</dt>
          <dd>
            {diagnostics?.lastPush
              ? new Date(diagnostics.lastPush).toLocaleString('es-CO')
              : 'Sin envíos registrados'}
          </dd>
          <dt>Ámbito</dt>
          <dd>{diagnostics?.scope}</dd>
        </dl>
        {diagnostics?.error && <Notice kind="warning">{diagnostics.error}</Notice>}
        <p className="notification-limit">
          iPhone: instala desde Safari en la pantalla de inicio y abre la app desde su icono. El sistema puede
          agrupar o descartar avisos; el contador interno permanece hasta leer.
        </p>
      </section>
    </main>
  )
}
