import { useCallback, useEffect, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Link } from 'react-router-dom'
import { ArrowDown, BookHeart, Check, CheckCheck, Clock3, MoreHorizontal, Reply, Star } from 'lucide-react'
import { getSetting, putSetting } from '../../lib/storage'
import { canMarkRead, type ChatMessage } from './model'
import { receipt, useChatActivity } from './activity'
import { MediaBubble } from './MediaBubble'
import { StickerArt } from './StickerPicker'
import type { Reaction } from './repository'
import { flushOutbox } from '../../lib/privateRepository'

interface Props {
  messages: ChatMessage[]
  userId: string
  relationshipId: string
  loading: boolean
  hasMore: boolean
  loadMore: () => void
  stars: Set<string>
  reactions: Reaction[]
  receipts: Record<string, 'delivered' | 'read'>
  onActions: (message: ChatMessage) => void
  onReply: (message: ChatMessage) => void
  target?: string
}
export function ChatMessages(props: Props) {
  const { messages, userId, relationshipId } = props
  const unread = useChatActivity((s) => s.unread),
    count = useChatActivity((s) => s.count)
  const scroll = useRef<HTMLDivElement>(null),
    initial = useRef(false),
    last = useRef(''),
    press = useRef<ReturnType<typeof setTimeout> | null>(null),
    touch = useRef<{ x: number; y: number; id: string } | undefined>(undefined)
  const [bottom, setBottom] = useState(true),
    [highlight, setHighlight] = useState(''),
    [scrollVersion, setScrollVersion] = useState(0)
  // This component is intentionally not React-Compiler memoized: measurements are mutable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 130,
    overscan: 8,
    enabled: messages.length > 100,
    getItemKey: (index) => messages[index].id,
  })
  const isVirtual = messages.length > 100
  const rows = isVirtual
    ? virtual.getVirtualItems().map((v) => ({ message: messages[v.index], index: v.index, start: v.start }))
    : messages.map((message, index) => ({ message, index, start: 0 }))
  const goTo = useCallback(
    (id?: string) => {
      const index = id ? messages.findIndex((m) => m.id === id) : messages.length - 1
      if (index < 0) return
      if (isVirtual) virtual.scrollToIndex(index, { align: id ? 'center' : 'end' })
      else if (id)
        document.getElementById(`message-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      else scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' })
      if (id) {
        setHighlight(id)
        setTimeout(() => setHighlight(''), 1800)
      }
    },
    [messages, isVirtual, virtual],
  )
  const firstUnread = unread.find((id) => messages.some((m) => m.id === id))
  useEffect(() => {
    if (props.loading || !messages.length || initial.current) return
    initial.current = true
    void getSetting<number>(`chat-scroll:${relationshipId}:${userId}`).then((top) => {
      const target = props.target ?? firstUnread
      if (target) goTo(target)
      else if (top !== undefined && top > 0) scroll.current?.scrollTo({ top })
      else goTo()
    })
  }, [props.loading, props.target, messages, goTo, firstUnread, relationshipId, userId])
  useEffect(() => {
    if (props.target) requestAnimationFrame(() => goTo(props.target))
  }, [props.target, goTo])
  useEffect(() => {
    const next = messages.at(-1)
    if (next && next.id !== last.current) {
      last.current = next.id
      if (bottom && !firstUnread && !props.target) requestAnimationFrame(() => goTo())
    }
  }, [messages, bottom, goTo, firstUnread, props.target])
  useEffect(() => {
    const root = scroll.current
    if (!root) return
    const visible = new Set<string>(),
      timers = new Map<string, ReturnType<typeof setTimeout>>()
    const check = (id: string) => {
      if (
        !canMarkRead(document.visibilityState === 'visible', document.hasFocus(), visible.has(id), false) ||
        timers.has(id)
      )
        return
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id)
          if (
            canMarkRead(document.visibilityState === 'visible', document.hasFocus(), visible.has(id), false)
          )
            void receipt(id, 'read').catch(() => {})
        }, 650),
      )
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.messageId!
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            visible.add(id)
            check(id)
          } else {
            visible.delete(id)
            clearTimeout(timers.get(id))
            timers.delete(id)
          }
        }
      },
      { root, threshold: 0.5 },
    )
    root.querySelectorAll<HTMLElement>('[data-unread="true"]').forEach((node) => observer.observe(node))
    const focus = () => visible.forEach(check)
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', focus)
    return () => {
      observer.disconnect()
      timers.forEach(clearTimeout)
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', focus)
    }
  }, [messages, unread, scrollVersion])
  useEffect(
    () => () => {
      if (press.current) clearTimeout(press.current)
    },
    [],
  )
  return (
    <>
      {count > 0 && (
        <button className="unread-banner" onClick={() => goTo(firstUnread)}>
          <span className="unread-badge">{count}</span>
          {count === 1 ? 'Tienes una página nueva' : 'Tienes páginas nuevas'}
          <ArrowDown size={16} />
        </button>
      )}
      <div
        className="chat-scroll"
        ref={scroll}
        role="log"
        aria-label="Mensajes de nuestra historia"
        onScroll={() => {
          const node = scroll.current
          if (node) {
            setBottom(node.scrollHeight - node.scrollTop - node.clientHeight < 130)
            setScrollVersion((v) => v + 1)
            void putSetting(`chat-scroll:${relationshipId}:${userId}`, node.scrollTop)
          }
        }}
      >
        {props.hasMore && (
          <button className="load-older" onClick={props.loadMore}>
            Cargar páginas anteriores
          </button>
        )}
        {props.loading ? (
          <p className="chat-empty">Abriendo nuestras páginas…</p>
        ) : !messages.length ? (
          <div className="chat-empty">
            <BookHeart />
            <h2>Una página para los dos</h2>
            <p>Empieza con un hola, una foto o algo que te hizo pensar en esa persona.</p>
          </div>
        ) : null}
        <div style={isVirtual ? { height: virtual.getTotalSize(), position: 'relative' } : undefined}>
          {rows.map(({ message, index, start }) => {
            const mine = message.senderId === userId,
              previous = messages[index - 1],
              grouped =
                previous?.senderId === message.senderId &&
                new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 180000
            const newDate = !previous || previous.createdAt.slice(0, 10) !== message.createdAt.slice(0, 10)
            const reactions = props.reactions.filter((r) => r.messageId === message.id),
              hearts = reactions.filter((r) => r.emoji === '❤️').length
            return (
              <div
                key={message.id}
                data-index={index}
                ref={isVirtual ? virtual.measureElement : undefined}
                style={
                  isVirtual
                    ? {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${start}px)`,
                      }
                    : undefined
                }
              >
                {newDate && (
                  <div className="chat-day">
                    <span>
                      {new Date(message.createdAt).toLocaleDateString('es-CO', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </span>
                  </div>
                )}
                {message.id === firstUnread && <div className="new-messages-divider">Mensajes nuevos</div>}
                <article
                  id={`message-${message.id}`}
                  data-message-id={message.id}
                  data-unread={!mine && unread.includes(message.id)}
                  className={`chat-message ${mine ? 'own' : ''} ${grouped ? 'grouped' : ''} ${highlight === message.id ? 'highlighted' : ''} ${message.content.sticker ? 'sticker-message' : ''} ${hearts >= 2 ? 'mutual-heart' : ''}`}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    props.onActions(message)
                  }}
                  onPointerDown={(e) => {
                    touch.current = { x: e.clientX, y: e.clientY, id: message.id }
                    press.current = setTimeout(() => props.onActions(message), 550)
                  }}
                  onPointerMove={(e) => {
                    if (
                      touch.current &&
                      (Math.abs(e.clientX - touch.current.x) > 12 ||
                        Math.abs(e.clientY - touch.current.y) > 12) &&
                      press.current
                    )
                      clearTimeout(press.current)
                  }}
                  onPointerUp={(e) => {
                    if (press.current) clearTimeout(press.current)
                    if (
                      touch.current?.id === message.id &&
                      e.clientX - touch.current.x > 75 &&
                      Math.abs(e.clientY - touch.current.y) < 40
                    )
                      props.onReply(message)
                    touch.current = undefined
                  }}
                  onPointerCancel={() => {
                    if (press.current) clearTimeout(press.current)
                    touch.current = undefined
                  }}
                >
                  <div className="chat-bubble">
                    {!grouped && (
                      <span className="chat-sender">{mine ? 'Tú' : 'Al otro lado de esta página'}</span>
                    )}
                    {message.failed && (
                      <button className="failed-message" onClick={() => void flushOutbox(true)}>
                        Envío fallido · reintentar
                      </button>
                    )}
                    {message.deleted ? (
                      <p className="deleted-message">Esta página fue eliminada.</p>
                    ) : (
                      <>
                        {message.content.replyTo &&
                          (message.content.replySource === 'cartas' ||
                          message.content.replySource === 'marcapaginas' ? (
                            <Link
                              className="quoted-message"
                              to={`/historia/${message.content.replySource}#entry-${encodeURIComponent(message.content.replyTo)}`}
                            >
                              <Reply size={14} />
                              {message.content.replyPreview || 'Volver al original'}
                            </Link>
                          ) : (
                            <button className="quoted-message" onClick={() => goTo(message.content.replyTo)}>
                              <Reply size={14} />
                              {message.content.replyPreview || 'Volver al mensaje original'}
                            </button>
                          ))}
                        {message.content.sticker && <StickerArt id={message.content.sticker} />}
                        {message.content.attachments?.map((media) => (
                          <MediaBubble key={media.id} media={media} />
                        ))}
                        {message.content.text && <p className="chat-text">{message.content.text}</p>}
                      </>
                    )}
                    <div className="chat-message-meta">
                      {props.stars.has(message.id) && <Star size={12} aria-label="Guardado" />}
                      {message.edited && <span>editado</span>}
                      <time dateTime={message.createdAt}>
                        {new Date(message.createdAt).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                      {mine &&
                        !message.deleted &&
                        (message.pending ? (
                          <Clock3 size={14} aria-label="Pendiente de enviar" />
                        ) : props.receipts[message.id] === 'read' ? (
                          <CheckCheck size={16} className="read-check" aria-label="Leído" />
                        ) : props.receipts[message.id] === 'delivered' ? (
                          <CheckCheck size={16} aria-label="Entregado" />
                        ) : (
                          <Check size={16} aria-label="Enviado" />
                        ))}
                      <button aria-label="Acciones del mensaje" onClick={() => props.onActions(message)}>
                        <MoreHorizontal size={17} />
                      </button>
                    </div>
                  </div>
                  {(reactions.length > 0 || !!message.legacyReactions) && (
                    <div className="chat-reactions">
                      {[...new Set(reactions.map((r) => r.emoji))].map((emoji) => (
                        <button
                          key={emoji}
                          aria-label={`Reacción ${emoji}`}
                          onClick={() => props.onActions(message)}
                        >
                          {emoji} {reactions.filter((r) => r.emoji === emoji).length}
                        </button>
                      ))}
                      {!!message.legacyReactions && <span>♡ {message.legacyReactions}</span>}
                    </div>
                  )}
                </article>
              </div>
            )
          })}
        </div>
      </div>
      {!bottom && (
        <button className="jump-last" aria-label="Ir al último mensaje" onClick={() => goTo()}>
          <ArrowDown />
          {count > 0 && <span>{count}</span>}
        </button>
      )}
    </>
  )
}
