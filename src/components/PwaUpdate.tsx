import { RefreshCw, WifiOff, X } from 'lucide-react'
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaUpdate() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()
  useEffect(() => {
    if (!offlineReady || needRefresh) return
    const timer = window.setTimeout(() => setOfflineReady(false), 4500)
    return () => window.clearTimeout(timer)
  }, [needRefresh, offlineReady, setOfflineReady])
  if (!offlineReady && !needRefresh) return null
  return (
    <aside className="pwa-toast" role="status">
      {needRefresh ? <RefreshCw /> : <WifiOff />}
      <div>
        <strong>
          {needRefresh ? 'Hay una edición nueva' : 'La biblioteca está disponible sin conexión'}
        </strong>
        <small>
          {needRefresh ? 'Actualiza cuando te venga bien.' : 'El contenido privado seguirá bloqueado.'}
        </small>
      </div>
      {needRefresh && <button onClick={() => void updateServiceWorker(true)}>Actualizar</button>}
      <button
        className="pwa-close"
        aria-label="Cerrar"
        onClick={() => {
          setOfflineReady(false)
          setNeedRefresh(false)
        }}
      >
        <X />
      </button>
    </aside>
  )
}
