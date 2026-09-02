import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Play, X, ZoomIn } from 'lucide-react'
import { downloadMedia } from '../../lib/media/repository'
import { sizeLabel } from '../../lib/media/files'
import type { MediaRef } from '../../lib/media/types'
import { Modal } from '../../components/ui'

export function MediaBubble({ media }: { media: MediaRef }) {
  const [url, setUrl] = useState(''),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [fullscreen, setFullscreen] = useState(false),
    [zoom, setZoom] = useState(1)
  const [speed, setSpeed] = useState(1),
    [listened, setListened] = useState(false)
  const container = useRef<HTMLDivElement>(null),
    audio = useRef<HTMLAudioElement>(null),
    request = useRef<AbortController | null>(null),
    currentUrl = useRef('')
  const load = async () => {
    if (currentUrl.current || request.current) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    try {
      const { blob } = await downloadMedia(media.id, controller.signal)
      if (controller.signal.aborted) return
      currentUrl.current = URL.createObjectURL(blob)
      setUrl(currentUrl.current)
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'No se pudo abrir el archivo.')
    } finally {
      request.current = null
      if (!controller.signal.aborted) setLoading(false)
    }
  }
  useEffect(() => {
    const node = container.current
    if (!node || !['image', 'sticker'].includes(media.kind)) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void load()
          observer.disconnect()
        }
      },
      { rootMargin: '100px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
    // Each attachment is immutable and the component is keyed by its ID.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.id, media.kind])
  useEffect(
    () => () => {
      request.current?.abort()
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current)
    },
    [],
  )
  return (
    <div className={`chat-media media-${media.kind}`} ref={container}>
      {url && (media.kind === 'image' || media.kind === 'sticker') ? (
        <button
          className="media-image-button"
          onClick={() => setFullscreen(true)}
          aria-label={`Ampliar ${media.name}`}
        >
          <img src={url} alt={media.name} loading="lazy" />
        </button>
      ) : null}
      {url && media.kind === 'video' ? (
        <video src={url} controls playsInline preload="metadata" aria-label={media.name} />
      ) : null}
      {url && media.kind === 'audio' ? (
        <div className="audio-player">
          <audio
            ref={audio}
            src={url}
            controls
            preload="metadata"
            onEnded={() => setListened(true)}
            aria-label="Reproducir audio"
          />
          <button
            aria-label={`Velocidad ${speed}x`}
            onClick={() => {
              const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1
              setSpeed(next)
              if (audio.current) audio.current.playbackRate = next
            }}
          >
            {speed}×
          </button>
          <small>{listened ? 'Reproducido' : 'Audio privado'}</small>
        </div>
      ) : null}
      {!url && media.thumbnail ? <MediaBubble media={media.thumbnail} /> : null}
      {!url && (
        <button className="media-load" disabled={loading} onClick={() => void load()}>
          {media.kind === 'document' ? <FileText /> : <Play />}
          <span>
            {loading
              ? 'Descifrando…'
              : media.kind === 'document'
                ? media.name
                : media.kind === 'audio'
                  ? 'Escuchar audio'
                  : media.kind === 'video'
                    ? 'Abrir video'
                    : 'Abrir imagen'}
            <small>
              {sizeLabel(media.size)}
              {media.duration ? ` · ${Math.round(media.duration)} s` : ''}
            </small>
          </span>
        </button>
      )}
      {error && (
        <p role="alert" className="media-error">
          {error}
          <button onClick={() => void load()}>Reintentar</button>
        </p>
      )}
      {url && (
        <a className="media-download" href={url} download={media.name}>
          <Download size={15} />
          {media.kind === 'document' ? `${media.name} · ` : ''}Descargar · {sizeLabel(media.size)}
        </a>
      )}
      {fullscreen && (
        <Modal title="Una imagen nuestra" onClose={() => setFullscreen(false)}>
          <div className="image-zoom">
            <img src={url} alt={media.name} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} />
          </div>
          <label className="zoom-control">
            <ZoomIn />
            <input
              aria-label="Ampliación de imagen"
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <button className="private-secondary" onClick={() => setFullscreen(false)}>
            <X />
            Cerrar
          </button>
        </Modal>
      )}
    </div>
  )
}
