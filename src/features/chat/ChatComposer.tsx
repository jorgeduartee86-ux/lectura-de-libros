import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CalendarClock,
  Camera,
  FileText,
  Heart,
  ImagePlus,
  Mic,
  Paperclip,
  Plus,
  Reply,
  Send,
  Smile,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Modal } from '../../components/ui'
import { getPrivateSession } from '../../lib/privateRepository'
import { getMediaJob, removeMediaJob } from '../../lib/storage'
import { cancelMedia, prepareMedia, uploadMedia } from '../../lib/media/repository'
import { sizeLabel, videoInfo } from '../../lib/media/files'
import type { MediaKind, MediaRef } from '../../lib/media/types'
import { supabase } from '../../lib/supabase'
import { previewMessage, type ChatContent, type ChatMessage } from './model'
import { loadDraft, saveDraft, scheduleMessage, type Draft } from './repository'
import { MediaPreview } from './MediaPreview'
import { StickerPicker } from './StickerPicker'
import { VoiceRecorder } from './VoiceRecorder'

export function ChatComposer({
  send,
  reply,
  onReplyClear,
  onActivity,
  onError,
  romance,
}: {
  send: (content: ChatContent) => Promise<unknown>
  reply?: ChatMessage
  onReplyClear: () => void
  onActivity: (state: string) => void
  onError: (message: string) => void
  romance: boolean
}) {
  const [draft, setDraft] = useState<Draft>({ text: '' }),
    [hydrated, setHydrated] = useState(false),
    [attach, setAttach] = useState(false),
    [picker, setPicker] = useState(false),
    [voice, setVoice] = useState(false)
  const [files, setFiles] = useState<{ file: File; kind: MediaKind }[]>([]),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [progress, setProgress] = useState<Record<string, number>>({})
  const [scheduleOpen, setScheduleOpen] = useState(false),
    [scheduleTime, setScheduleTime] = useState(''),
    [queued, setQueued] = useState<{ id: string; scheduled_at: string }[]>([])
  const input = useRef<HTMLInputElement>(null),
    fileKind = useRef<MediaKind>('image'),
    controller = useRef<AbortController | null>(null),
    currentDraft = useRef(draft),
    sending = useRef(false),
    active = useRef(true),
    resumeRef = useRef<() => void>(() => {})
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { relationshipId, userId } = getPrivateSession()
  const persist = useCallback(
    (value: Draft) => {
      currentDraft.current = value
      setDraft(value)
      void saveDraft(value).catch(() =>
        onError('No se pudo guardar la copia local. No cierres hasta enviar.'),
      )
    },
    [onError],
  )
  useEffect(() => {
    active.current = true
    void loadDraft()
      .then((value) => {
        if (active.current) {
          currentDraft.current = value
          setDraft(value)
          setHydrated(true)
        }
      })
      .catch(() => setHydrated(true))
    return () => {
      active.current = false
      controller.current?.abort()
      clearTimeout(typingTimer.current)
    }
  }, [relationshipId, userId])
  const addFile = async (file: File, kind: MediaKind, duration?: number) => {
    if ((currentDraft.current.attachments?.length ?? 0) >= 5)
      throw new Error('Puedes enviar hasta cinco archivos por mensaje.')
    let extra: Partial<MediaRef> = { duration }
    if (kind === 'video') {
      const details = await videoInfo(file)
      const thumbnail = details.thumbnail ? await prepareMedia(details.thumbnail, 'image') : undefined
      extra = { duration: details.duration, thumbnail }
    }
    const ref = await prepareMedia(file, kind, extra)
    persist({ ...currentDraft.current, attachments: [...(currentDraft.current.attachments ?? []), ref] })
    setFiles((current) => current.slice(1))
  }
  const sendDraft = useCallback(async () => {
    if (sending.current) return
    const value = currentDraft.current
    if (!value.text.trim() && !value.attachments?.length) return
    sending.current = true
    setBusy(true)
    onError('')
    controller.current = new AbortController()
    try {
      if (value.attachments?.length && !navigator.onLine) {
        persist({ ...value, sendWhenReady: true })
        setNotice('Mensaje cifrado en espera. Se enviará al volver la conexión con el chat abierto.')
        return
      }
      onActivity(value.attachments?.length ? 'Enviando un archivo…' : 'Viendo el chat')
      for (const media of value.attachments ?? []) {
        if (media.thumbnail && (await getMediaJob(media.thumbnail.id)))
          await uploadMedia(media.thumbnail.id, () => {}, controller.current.signal)
        if (await getMediaJob(media.id))
          await uploadMedia(
            media.id,
            (p) => setProgress((current) => ({ ...current, [media.id]: p })),
            controller.current.signal,
          )
      }
      if (controller.current.signal.aborted) return
      await send({
        text: value.text.trim(),
        replyTo: reply?.id ?? value.replyTo,
        replyPreview: reply ? previewMessage(reply).slice(0, 180) : value.replyPreview,
        replySource: reply ? undefined : value.replySource,
        attachments: value.attachments,
      })
      for (const media of value.attachments ?? []) {
        await removeMediaJob(media.id)
        if (media.thumbnail) await removeMediaJob(media.thumbnail.id)
      }
      persist({ text: '' })
      onReplyClear()
      setProgress({})
      setNotice('')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'No se pudo enviar. El borrador está a salvo.')
    } finally {
      sending.current = false
      if (active.current) {
        setBusy(false)
        onActivity('Viendo el chat')
      }
    }
  }, [send, onActivity, onError, onReplyClear, persist, reply])
  useEffect(() => {
    resumeRef.current = () => {
      if (currentDraft.current.sendWhenReady && navigator.onLine) void sendDraft()
    }
  }, [sendDraft])
  useEffect(() => {
    const resume = () => resumeRef.current()
    window.addEventListener('online', resume)
    if (hydrated) queueMicrotask(resume)
    return () => window.removeEventListener('online', resume)
  }, [hydrated])
  const choose = (kind: MediaKind, camera = false) => {
    fileKind.current = kind
    setAttach(false)
    setPicker(false)
    if (!input.current) return
    input.current.accept =
      kind === 'document'
        ? '.pdf,.txt,.csv,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx'
        : kind === 'sticker'
          ? 'image/jpeg,image/png,image/webp,image/avif'
          : `${kind}/*`
    input.current.multiple = kind === 'image' && !camera
    if (camera) input.current.setAttribute('capture', 'environment')
    else input.current.removeAttribute('capture')
    input.current.click()
  }
  const attempt = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'No se pudo completar.')
    }
  }
  const loadScheduled = async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('scheduled_messages')
      .select('id,scheduled_at')
      .is('published_at', null)
      .order('scheduled_at')
    setQueued(data ?? [])
    setScheduleOpen(true)
    setAttach(false)
  }
  return (
    <>
      {notice && (
        <div className="chat-notice" role="status">
          {notice}
          <button aria-label="Cerrar aviso" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {romance && (
        <div className="romantic-shortcuts">
          <button onClick={() => persist({ ...draft, text: 'Pensé en ti ♡' })}>Pensé en ti</button>
          <button onClick={() => persist({ ...draft, text: 'Te mando un beso 😘' })}>Un beso</button>
          <button onClick={() => persist({ ...draft, text: 'Quiero escucharte' })}>Quiero escucharte</button>
          <Link to="/historia/cartas">Cartas ↗</Link>
        </div>
      )}
      {(reply || draft.replyTo) && (
        <div className="reply-draft">
          <Reply size={17} />
          <span>
            {reply ? previewMessage(reply).slice(0, 100) : draft.replyPreview || 'Responder al mensaje'}
          </span>
          <button
            aria-label="Cancelar respuesta"
            onClick={() => {
              onReplyClear()
              persist({ ...draft, replyTo: undefined, replyPreview: undefined })
            }}
          >
            <X />
          </button>
        </div>
      )}
      {!!draft.attachments?.length && (
        <div className="upload-list">
          {draft.attachments.map((media) => (
            <div key={media.id}>
              <Paperclip size={17} />
              <span>
                {media.name}
                <small>
                  {progress[media.id] !== undefined ? `${progress[media.id]}% · ` : ''}
                  {sizeLabel(media.size)} · copia local cifrada
                </small>
                <progress max="100" value={progress[media.id] ?? 0} />
              </span>
              <button
                aria-label={`Quitar ${media.name}`}
                disabled={busy}
                onClick={() =>
                  void attempt(async () => {
                    await cancelMedia(media.id)
                    if (media.thumbnail) await cancelMedia(media.thumbnail.id)
                    persist({
                      ...currentDraft.current,
                      attachments: currentDraft.current.attachments?.filter((a) => a.id !== media.id),
                    })
                  })
                }
              >
                <X />
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault()
          void sendDraft()
        }}
      >
        <button type="button" className="composer-add" aria-label="Adjuntar" onClick={() => setAttach(true)}>
          <Plus />
        </button>
        <textarea
          aria-label="Escribe un mensaje"
          placeholder="Escribe algo para los dos…"
          rows={1}
          maxLength={8000}
          value={draft.text}
          disabled={!hydrated || busy}
          onChange={(e) => {
            persist({ ...draft, text: e.target.value })
            onActivity(e.target.value ? 'Escribiendo…' : 'Viendo el chat')
            clearTimeout(typingTimer.current)
            typingTimer.current = setTimeout(() => onActivity('Viendo el chat'), 2500)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void sendDraft()
            }
          }}
        />
        <button
          type="button"
          className="composer-sticker"
          aria-label="Stickers"
          onClick={() => setPicker(true)}
        >
          <Smile />
        </button>
        {draft.text.trim() || draft.attachments?.length ? (
          <button className="composer-send" disabled={busy} aria-label="Enviar mensaje">
            <Send />
          </button>
        ) : (
          <button
            type="button"
            className="composer-send"
            aria-label="Grabar nota de voz"
            onClick={() => setVoice(true)}
          >
            <Mic />
          </button>
        )}
      </form>
      {busy && (
        <button className="pause-upload" onClick={() => controller.current?.abort()}>
          Pausar carga · conservar borrador
        </button>
      )}
      <input
        ref={input}
        className="sr-only"
        tabIndex={-1}
        type="file"
        aria-label="Seleccionar archivo"
        onChange={(e) => {
          setFiles(
            Array.from(e.target.files ?? [])
              .slice(0, 5)
              .map((file) => ({ file, kind: fileKind.current })),
          )
          e.target.value = ''
        }}
      />
      {attach && (
        <Modal title="Comparte un pedacito de tu día" onClose={() => setAttach(false)}>
          <div className="attachment-sheet">
            <button onClick={() => choose('image')}>
              <ImagePlus />
              Foto
            </button>
            <button onClick={() => choose('image', true)}>
              <Camera />
              Cámara
            </button>
            <button onClick={() => choose('video')}>
              <Video />
              Video
            </button>
            <button onClick={() => choose('video', true)}>
              <Video />
              Grabar video
            </button>
            <button onClick={() => choose('audio')}>
              <Mic />
              Audio
            </button>
            <button onClick={() => choose('document')}>
              <FileText />
              Documento
            </button>
            <button
              onClick={() => {
                setAttach(false)
                setPicker(true)
              }}
            >
              <Smile />
              Sticker
            </button>
            <button onClick={() => void loadScheduled()}>
              <CalendarClock />
              Programar
            </button>
            {['cartas', 'regalos', 'cita', 'recuerdos'].map((path, i) => (
              <Link key={path} to={`/historia/${path}`}>
                <Heart />
                {['Carta', 'Regalo', 'Cita', 'Recuerdo'][i]}
              </Link>
            ))}
          </div>
        </Modal>
      )}
      {picker && (
        <StickerPicker
          onClose={() => setPicker(false)}
          onCustom={() => choose('sticker')}
          onCustomSelect={(media) =>
            void attempt(async () => {
              await send({ text: '', attachments: [media], replyTo: reply?.id })
              onReplyClear()
              setPicker(false)
            })
          }
          onSelect={(id) =>
            void attempt(async () => {
              await send({
                text: '',
                sticker: id,
                replyTo: reply?.id,
                replyPreview: reply ? previewMessage(reply).slice(0, 180) : undefined,
              })
              onReplyClear()
              setPicker(false)
            })
          }
        />
      )}
      {voice && (
        <VoiceRecorder
          onClose={() => {
            setVoice(false)
            onActivity('Viendo el chat')
          }}
          onActivity={onActivity}
          onSend={(file, duration) => addFile(file, 'audio', duration)}
        />
      )}
      {files[0] && (
        <MediaPreview
          key={files[0].file.name}
          {...files[0]}
          onClose={() => setFiles((current) => current.slice(1))}
          onUse={(file) => addFile(file, files[0].kind)}
        />
      )}
      {scheduleOpen && (
        <Modal title="Para el momento justo" onClose={() => setScheduleOpen(false)}>
          <p>Programa el texto de tu borrador. Se conserva cifrado hasta su publicación.</p>
          <label className="field">
            Fecha y hora
            <input
              aria-label="Fecha del mensaje programado"
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
          </label>
          <button
            className="private-primary"
            disabled={!draft.text.trim() || !scheduleTime || !!draft.attachments?.length}
            onClick={() =>
              void attempt(async () => {
                await scheduleMessage({ text: draft.text.trim() }, new Date(scheduleTime).toISOString())
                persist({ text: '' })
                setScheduleOpen(false)
                setNotice('Tu página quedó programada.')
              })
            }
          >
            Programar texto
          </button>
          <div className="scheduled-list">
            {queued.map((item) => (
              <div key={item.id}>
                <CalendarClock />
                <span>{new Date(item.scheduled_at).toLocaleString('es-CO')}</span>
                <button
                  aria-label="Cancelar mensaje programado"
                  onClick={() =>
                    void attempt(async () => {
                      const result = await supabase?.from('scheduled_messages').delete().eq('id', item.id)
                      if (result?.error) throw result.error
                      setQueued((current) => current.filter((q) => q.id !== item.id))
                    })
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  )
}
