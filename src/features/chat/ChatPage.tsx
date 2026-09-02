import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, BookHeart, Copy, Pencil, Pin, Reply, Search, Star, Trash2, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Modal, Notice } from '../../components/ui'
import { createPrivateItem, getPrivateSession } from '../../lib/privateRepository'
import { edgeCall } from '../../lib/media/repository'
import { supabase } from '../../lib/supabase'
import { useChatActivity } from './activity'
import { filterMessages, previewMessage, type ChatMessage } from './model'
import { editMessage, reactToMessage, toggleStar } from './repository'
import { useChat, useChatPresence } from './useChat'
import { ChatMessages } from './ChatMessages'
import { ChatComposer } from './ChatComposer'
import { NotificationOnboarding } from '../../components/NotificationOnboarding'
import { useAppStore } from '../../store/app'
import { putSetting } from '../../lib/storage'

export function ChatPage({ savedOnly = false }: { savedOnly?: boolean }) {
  const chat = useChat(),
    presence = useChatPresence(),
    { userId, relationshipId } = getPrivateSession(),
    location = useLocation()
  const unreadCount = useChatActivity((s) => s.count)
  const appSession = useAppStore((s) => s.session)
  const [phraseEditor, setPhraseEditor] = useState<string | null>(null)
  const [search, setSearch] = useState(savedOnly),
    [filter, setFilter] = useState({ query: '', kind: '', sender: '', date: '', starsOnly: savedOnly })
  const [actions, setActions] = useState<ChatMessage>(),
    [reply, setReply] = useState<ChatMessage>(),
    [editing, setEditing] = useState<ChatMessage>(),
    [error, setError] = useState(''),
    [target, setTarget] = useState<string | undefined>(
      () => new URLSearchParams(location.search).get('message') ?? undefined,
    ),
    [romance, setRomance] = useState(true)
  const displayed = useMemo(
    () => filterMessages(chat.messages, filter, userId, chat.stars),
    [chat.messages, filter, userId, chat.stars],
  )
  const clearReply = useCallback(() => setReply(undefined), [])
  useEffect(() => {
    if (supabase && !relationshipId.startsWith('local-'))
      void supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data }) => {
          setRomance(data?.romance ?? true)
          if (data) void putSetting(`push-preferences:${userId}`, data)
        })
  }, [relationshipId, userId])
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action()
      setActions(undefined)
      await chat.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar.')
    }
  }
  const pin = async (id: string) => {
    if (!supabase) return
    const result =
      chat.pinned === id
        ? await supabase.from('pinned_messages').delete().eq('relationship_id', relationshipId)
        : await supabase
            .from('pinned_messages')
            .upsert({ relationship_id: relationshipId, message_id: id, user_id: userId })
    if (result.error) throw result.error
  }
  const pinned = chat.messages.find((message) => message.id === chat.pinned)
  return (
    <main className={`chat-page ${unreadCount ? 'has-unread' : ''} ${romance ? 'romance-on' : ''}`}>
      <header className="chat-header">
        <div className="chat-identity">
          <span className="chat-identity-avatar">
            <BookHeart />
          </span>
          <div>
            <small>NUESTRO CAPÍTULO DE HOY</small>
            <h1>{savedOnly ? 'Momentos guardados' : 'Entre páginas'}</h1>
            <p>{presence.remote || 'Un lugar para encontrarnos'}</p>
          </div>
        </div>
        <div className="chat-header-actions">
          <button
            className="icon-button"
            aria-label="Buscar mensajes"
            aria-pressed={search}
            onClick={() => setSearch((s) => !s)}
          >
            <Search />
          </button>
          <Link className="icon-button" aria-label="Notificaciones" to="/historia/notificaciones">
            <Bell />
          </Link>
        </div>
      </header>
      {search && (
        <section className="chat-filters" aria-label="Buscar en mensajes descifrados">
          <input
            autoFocus
            aria-label="Buscar mensajes"
            placeholder="Buscar en nuestras páginas…"
            value={filter.query}
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          />
          <select
            aria-label="Tipo de mensaje"
            value={filter.kind}
            onChange={(e) => setFilter({ ...filter, kind: e.target.value })}
          >
            <option value="">Todos los tipos</option>
            {[
              ['text', 'Texto'],
              ['image', 'Fotos'],
              ['video', 'Videos'],
              ['audio', 'Audios'],
              ['document', 'Documentos'],
              ['sticker', 'Stickers'],
              ['links', 'Enlaces'],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Remitente"
            value={filter.sender}
            onChange={(e) => setFilter({ ...filter, sender: e.target.value })}
          >
            <option value="">Ambos</option>
            <option value="me">Tú</option>
            <option value="other">La otra persona</option>
          </select>
          <input
            type="date"
            aria-label="Fecha del mensaje"
            value={filter.date}
            onChange={(e) => setFilter({ ...filter, date: e.target.value })}
          />
          <label>
            <input
              type="checkbox"
              checked={filter.starsOnly}
              onChange={(e) => setFilter({ ...filter, starsOnly: e.target.checked })}
            />
            Guardados
          </label>
          <small>Búsqueda local sobre mensajes cargados. No se envía un índice al servidor.</small>
        </section>
      )}
      <NotificationOnboarding session={appSession} />
      {romance && (
        <button
          className="shared-phrase"
          onClick={() => setPhraseEditor(chat.sharedPhrase)}
          aria-label="Editar nuestra frase compartida"
        >
          {chat.sharedPhrase}
          <Pencil size={11} />
        </button>
      )}
      {chat.pinned && (
        <button className="pinned-message" onClick={() => setTarget(chat.pinned)}>
          <Pin size={15} />
          <span>
            {pinned
              ? previewMessage(pinned).slice(0, 90)
              : 'Mensaje fijado · carga páginas anteriores para verlo'}
          </span>
        </button>
      )}
      {(error || chat.error) && (
        <Notice kind="error">
          {error || chat.error}
          <button
            onClick={() => {
              setError('')
              void chat.reload()
            }}
          >
            Reintentar
          </button>
        </Notice>
      )}
      <ChatMessages
        {...chat}
        messages={displayed}
        userId={userId}
        relationshipId={relationshipId}
        onActions={setActions}
        onReply={setReply}
        target={target}
      />
      <ChatComposer
        send={chat.send}
        reply={reply}
        onReplyClear={clearReply}
        onActivity={presence.activity}
        onError={setError}
        romance={romance}
      />
      {phraseEditor !== null && (
        <Modal title="Nuestra frase" onClose={() => setPhraseEditor(null)}>
          <input
            className="edit-message-input"
            aria-label="Frase compartida"
            maxLength={120}
            value={phraseEditor}
            onChange={(e) => setPhraseEditor(e.target.value)}
          />
          <button
            className="private-primary"
            disabled={!phraseEditor.trim()}
            onClick={() =>
              void run(async () => {
                await chat.savePhrase(phraseEditor)
                setPhraseEditor(null)
              })
            }
          >
            Guardar para los dos
          </button>
        </Modal>
      )}
      {actions && (
        <Modal title="Esta página" onClose={() => setActions(undefined)}>
          <div className="reaction-picker">
            {['❤️', '😘', '🥰', '😂', '😢', '😮', '👍'].map((emoji) => (
              <button
                key={emoji}
                aria-label={`Reaccionar ${emoji}`}
                onClick={() => void run(() => reactToMessage(actions.id, emoji))}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="message-action-list">
            <button
              onClick={() => {
                setReply(actions)
                setActions(undefined)
              }}
            >
              <Reply />
              Responder
            </button>
            <button onClick={() => void run(() => navigator.clipboard.writeText(previewMessage(actions)))}>
              <Copy />
              Copiar texto
            </button>
            <button onClick={() => void run(() => toggleStar(actions.id, chat.stars.has(actions.id)))}>
              <Star />
              {chat.stars.has(actions.id) ? 'Quitar de momentos guardados' : 'Guardar en nuestros favoritos'}
            </button>
            <button onClick={() => void run(() => pin(actions.id))}>
              <Pin />
              {chat.pinned === actions.id ? 'Desfijar mensaje' : 'Fijar mensaje'}
            </button>
            {actions.senderId === userId && !actions.deleted && (
              <button
                onClick={() => {
                  setEditing(actions)
                  setActions(undefined)
                }}
              >
                <Pencil />
                Editar texto
              </button>
            )}
            <button
              onClick={() =>
                void run(() =>
                  createPrivateItem('messages', 'message-delete-self', {
                    text: '',
                    event: 'delete-self',
                    targetId: actions.id,
                  }),
                )
              }
            >
              <X />
              Ocultar para mí
            </button>
            {actions.senderId === userId && !actions.deleted && (
              <button
                className="danger"
                onClick={() => {
                  if (
                    window.confirm(
                      '¿Eliminar este mensaje para ambos? Sus archivos se eliminarán si no se usan en otro mensaje.',
                    )
                  )
                    void run(() => edgeCall('chat-delete-message', { id: actions.id }))
                }}
              >
                <Trash2 />
                Eliminar para ambos
              </button>
            )}
          </div>
        </Modal>
      )}
      {editing && (
        <Modal title="Editar esta página" onClose={() => setEditing(undefined)}>
          <textarea
            className="edit-message-input"
            aria-label="Editar mensaje"
            value={editing.content.text}
            maxLength={8000}
            onChange={(e) =>
              setEditing({ ...editing, content: { ...editing.content, text: e.target.value } })
            }
          />
          <button
            className="private-primary"
            onClick={() =>
              void run(async () => {
                await editMessage(editing.id, editing.content)
                setEditing(undefined)
              })
            }
          >
            Guardar cambio
          </button>
        </Modal>
      )}
    </main>
  )
}
export function SavedMomentsPage() {
  return <ChatPage savedOnly />
}
