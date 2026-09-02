import { useEffect, useRef, useState } from 'react'
import { Mic, Pause, Play, Send, Square, Trash2 } from 'lucide-react'
import { Modal } from '../../components/ui'
export function VoiceRecorder({
  onClose,
  onSend,
  onActivity,
}: {
  onClose: () => void
  onSend: (file: File, duration: number) => Promise<void>
  onActivity: (state: string) => void
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'paused' | 'preview'>('idle'),
    [seconds, setSeconds] = useState(0),
    [url, setUrl] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [levels, setLevels] = useState<number[]>(Array(24).fill(4))
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    chunks = useRef<Blob[]>([]),
    result = useRef<File | null>(null),
    previewUrl = useRef(''),
    audioContext = useRef<AudioContext | null>(null),
    analyser = useRef<AnalyserNode | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (recorder.current?.state !== 'inactive') recorder.current?.stop()
      stream.current?.getTracks().forEach((t) => t.stop())
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current)
      void audioContext.current?.close()
    }
  }, [])
  useEffect(() => {
    if (state !== 'recording') return
    const timer = setInterval(
      () =>
        setSeconds((s) => {
          if (s >= 299) recorder.current?.stop()
          return s + 1
        }),
      1000,
    )
    const wave = setInterval(() => {
      if (analyser.current) {
        const data = new Uint8Array(analyser.current.frequencyBinCount)
        analyser.current.getByteFrequencyData(data)
        setLevels((current) => [
          ...current.slice(1),
          Math.max(4, data.reduce((a, b) => a + b, 0) / data.length / 2),
        ])
      }
    }, 120)
    return () => {
      clearInterval(timer)
      clearInterval(wave)
    }
  }, [state])
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setError('Este navegador no permite grabar. Puedes adjuntar un archivo de audio.')
      return
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      if (!alive.current) {
        stream.current.getTracks().forEach((t) => t.stop())
        return
      }
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      )
      const next = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined,
      )
      recorder.current = next
      chunks.current = []
      next.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data)
      }
      next.onstop = () => {
        stream.current?.getTracks().forEach((t) => t.stop())
        if (!alive.current) return
        const type = next.mimeType.split(';')[0],
          extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        const file = new File(chunks.current, `nota-de-voz.${extension}`, { type })
        result.current = file
        previewUrl.current = URL.createObjectURL(file)
        setUrl(previewUrl.current)
        setState('preview')
        onActivity('Viendo el chat')
      }
      if ('AudioContext' in window) {
        audioContext.current = new AudioContext()
        analyser.current = audioContext.current.createAnalyser()
        analyser.current.fftSize = 128
        audioContext.current.createMediaStreamSource(stream.current).connect(analyser.current)
      }
      next.start(1000)
      setState('recording')
      onActivity('Grabando audio…')
    } catch {
      setError('No se pudo usar el micrófono. Revisa su permiso en el navegador.')
    }
  }
  return (
    <Modal title="Tu voz, entre páginas" onClose={onClose}>
      <p className="recorder-time">
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </p>
      <svg
        className="voice-wave"
        viewBox="0 0 240 70"
        aria-label={state === 'recording' ? 'Grabación en curso' : 'Vista de audio'}
      >
        {levels.map((h, i) => (
          <rect key={i} x={i * 10} y={35 - h / 2} width="5" height={h} rx="2.5" />
        ))}
      </svg>
      {error && <p role="alert">{error}</p>}
      {state === 'idle' && (
        <button className="private-primary" onClick={() => void start()}>
          <Mic />
          Comenzar a grabar
        </button>
      )}
      {(state === 'recording' || state === 'paused') && (
        <div className="recorder-actions">
          <button
            onClick={() => {
              if (state === 'recording') {
                recorder.current?.pause()
                setState('paused')
              } else {
                recorder.current?.resume()
                setState('recording')
              }
            }}
          >
            {state === 'recording' ? <Pause /> : <Play />}
            {state === 'recording' ? 'Pausar' : 'Continuar'}
          </button>
          <button onClick={() => recorder.current?.stop()}>
            <Square />
            Escuchar antes de enviar
          </button>
        </div>
      )}
      {state === 'preview' && (
        <>
          <audio src={url} controls />
          <button
            className="private-primary"
            disabled={busy}
            onClick={async () => {
              if (!result.current) return
              setBusy(true)
              try {
                await onSend(result.current, seconds)
                onClose()
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'No se pudo preparar.')
                setBusy(false)
              }
            }}
          >
            <Send />
            {busy ? 'Protegiendo el audio…' : 'Usar nota de voz'}
          </button>
        </>
      )}
      <button className="private-secondary" onClick={onClose}>
        <Trash2 />
        Cancelar grabación
      </button>
      <small>Hasta 5 minutos. Se cifra en este dispositivo antes de subir.</small>
    </Modal>
  )
}
