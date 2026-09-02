import { useEffect, useState } from 'react'
import { Crop, RotateCw } from 'lucide-react'
import { Modal } from '../../components/ui'
import { imageFile, sizeLabel } from '../../lib/media/files'
import type { MediaKind } from '../../lib/media/types'
export function MediaPreview({
  file,
  kind,
  onClose,
  onUse,
}: {
  file: File
  kind: MediaKind
  onClose: () => void
  onUse: (file: File) => Promise<void>
}) {
  const [url, setUrl] = useState(''),
    [rotation, setRotation] = useState(0),
    [crop, setCrop] = useState(kind === 'sticker'),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(file)
    void Promise.resolve().then(() => setUrl(next))
    return () => URL.revokeObjectURL(next)
  }, [file])
  return (
    <Modal title={kind === 'sticker' ? 'Tu sticker personal' : 'Antes de enviarlo'} onClose={onClose}>
      <div className={`attachment-preview ${crop ? 'square' : ''}`}>
        {kind === 'image' || kind === 'sticker' ? (
          <img src={url} alt="Vista previa" style={{ transform: `rotate(${rotation}deg)` }} />
        ) : kind === 'video' ? (
          <video src={url} controls playsInline />
        ) : kind === 'audio' ? (
          <audio src={url} controls />
        ) : (
          <p>{file.name}</p>
        )}
      </div>
      <p>
        {file.name} · {sizeLabel(file.size)}
      </p>
      {(kind === 'image' || kind === 'sticker') && (
        <div className="image-editor-controls">
          <button onClick={() => setRotation((r) => (r + 90) % 360)}>
            <RotateCw />
            Rotar
          </button>
          <button aria-pressed={crop} onClick={() => setCrop((c) => !c)}>
            <Crop />
            {crop ? 'Recorte cuadrado' : 'Sin recorte'}
          </button>
        </div>
      )}
      {kind === 'sticker' && (
        <label className="field">
          Texto del sticker
          <input
            value={text}
            maxLength={40}
            onChange={(e) => setText(e.target.value)}
            placeholder="Una frase muy nuestra"
          />
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        className="private-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const processed =
              kind === 'image' || kind === 'sticker'
                ? await imageFile(file, { rotation, crop, text, sticker: kind === 'sticker' })
                : file
            await onUse(processed)
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'No se pudo preparar.')
            setBusy(false)
          }
        }}
      >
        {busy ? 'Cifrando en tu dispositivo…' : 'Añadir al mensaje'}
      </button>
      <small>El original no se envía a ningún servicio de edición. El recorte es centrado.</small>
    </Modal>
  )
}
