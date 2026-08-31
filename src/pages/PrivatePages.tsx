import {
  Bell,
  BookHeart,
  CalendarHeart,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Feather,
  Gift,
  Heart,
  KeyRound,
  LogOut,
  Menu,
  MessageCircleHeart,
  MoonStar,
  Orbit,
  Plus,
  RotateCw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { dailyQuestions, letterCategories, rouletteOptions, signals } from '../data/seed'
import { createPairingEnvelope, createPairingSecret } from '../lib/crypto'
import {
  downloadEncryptedMemoryImage,
  uploadEncryptedMemoryImage,
  type EncryptedImageRef,
} from '../lib/images'
import {
  clearPrivateSession,
  createPresenceChannel,
  createPrivateItem,
  createTypingChannel,
  getPrivateSession,
  listPrivateItems,
  subscribeToTable,
} from '../lib/privateRepository'
import { clearSensitiveCache, deleteVault, getSetting, putSetting } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/app'
import type { PrivateItem, PrivateTable } from '../types'
import { AccessCodePanel } from '../components/AccessCodePanel'
import { EmptyState, Field, Modal, Notice } from '../components/ui'

const AUTO_LOCK_MS = 5 * 60_000

function usePrivateItems<T extends Record<string, unknown>>(table: PrivateTable) {
  const [items, setItems] = useState<PrivateItem<T>[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    try {
      setItems(await listPrivateItems<T>(table))
    } finally {
      setLoading(false)
    }
  }, [table])
  useEffect(() => {
    void load()
    return subscribeToTable<T>(table, (item) =>
      setItems((current) => (current.some((entry) => entry.id === item.id) ? current : [...current, item])),
    )
  }, [load, table])
  const add = useCallback(
    async (contentType: string, content: T, metadata?: { scheduledAt?: string }) => {
      const item = await createPrivateItem<T>(table, contentType, content, metadata)
      setItems((current) => [...current, item])
      return item
    },
    [table],
  )
  return { items, loading, add, reload: load }
}

export function UnlockPage() {
  return <AccessCodePanel />
}

const privateNav = [
  ['/historia', 'Portada', MoonStar],
  ['/historia/conversacion', 'Capítulo', MessageCircleHeart],
  ['/historia/marcapaginas', 'Marcapáginas', Heart],
  ['/historia/cartas', 'Cartas', Feather],
  ['/historia/pregunta', 'Pregunta', Sparkles],
  ['/historia/nuestro-libro', 'Nuestro libro', BookHeart],
  ['/historia/cita', 'Nuestra cita', CalendarHeart],
  ['/historia/recuerdos', 'Recuerdos', Star],
  ['/historia/universo', 'Universo', Orbit],
  ['/historia/regalos', 'Regalos', Gift],
] as const

export function PrivateShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useAppStore((state) => state.session)
  const locked = useAppStore((state) => state.privateLocked)
  const setPrivateLocked = useAppStore((state) => state.setPrivateLocked)
  const [menuOpen, setMenuOpen] = useState(false)
  const [presenceCount, setPresenceCount] = useState(1)

  const lock = useCallback(() => {
    clearPrivateSession()
    setPrivateLocked(true)
    navigate('/', { replace: true })
  }, [navigate, setPrivateLocked])

  useEffect(() => {
    if (!session || locked) navigate('/desbloquear', { replace: true })
  }, [locked, navigate, session])

  useEffect(() => {
    let timer = window.setTimeout(lock, AUTO_LOCK_MS)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(lock, AUTO_LOCK_MS)
    }
    const hide = () => {
      if (document.hidden) lock()
    }
    const pageHide = () => lock()
    ;['pointerdown', 'keydown', 'touchstart'].forEach((name) =>
      window.addEventListener(name, reset, { passive: true }),
    )
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', pageHide)
    return () => {
      window.clearTimeout(timer)
      ;['pointerdown', 'keydown', 'touchstart'].forEach((name) => window.removeEventListener(name, reset))
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', pageHide)
    }
  }, [lock])

  useEffect(() => {
    const channel = createPresenceChannel((state) => setPresenceCount(Object.keys(state).length))
    return () => {
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [])

  if (locked) return null
  return (
    <div className="private-app">
      <header className="private-topbar">
        <button
          className="icon-button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-label="Abrir menú"
        >
          <Menu />
        </button>
        <Link to="/historia" className="private-brand">
          <MoonStar />
          <span>
            <strong>Nuestra Historia</strong>
            <small>Capítulo de dos</small>
          </span>
        </Link>
        <div className="private-presence">
          <span className="online-dot" />
          <small>{presenceCount > 1 ? 'Ambos aquí' : 'Solo tú ahora'}</small>
        </div>
        <button className="quick-exit private" onClick={lock}>
          <LogOut /> <span>Salida rápida</span>
        </button>
      </header>
      <aside className={`private-sidebar ${menuOpen ? 'open' : ''}`}>
        <nav>
          {privateNav.map(([to, label, Icon]) => (
            <NavLink to={to} end={to === '/historia'} key={to} onClick={() => setMenuOpen(false)}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <NavLink className="settings-link" to="/historia/configuracion" onClick={() => setMenuOpen(false)}>
          <Settings /> Configuración
        </NavLink>
      </aside>
      <div className="private-main" key={location.pathname}>
        <Outlet />
      </div>
    </div>
  )
}

const featureCards = [
  ['conversacion', 'Capítulo del día', 'Lo que nos dijimos hoy', MessageCircleHeart],
  ['marcapaginas', 'Marcapáginas', 'Una señal rápida, sin presión', Heart],
  ['misma-pagina', 'En la misma página', 'Coincidir a la distancia', UsersRound],
  ['cartas', 'Cartas escondidas', 'Palabras para el momento justo', Feather],
  ['pregunta', 'Pregunta del día', 'Conocernos un poco más', Sparkles],
  ['nuestro-libro', 'Nuestro libro', 'Una historia escrita por turnos', BookHeart],
  ['ruleta', 'Ruleta romántica', 'Una invitación inesperada', RotateCw],
  ['cita', 'Nuestra cita', 'Planear tiempo para los dos', CalendarHeart],
  ['recuerdos', 'Cofre de recuerdos', 'Todo lo que queremos conservar', Star],
  ['universo', 'Nuestro universo', 'Cada momento convertido en estrella', Orbit],
  ['regalos', 'Regalos digitales', 'Una sorpresa entre páginas', Gift],
] as const

export function StoryHomePage() {
  const today = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(),
  )
  return (
    <main className="private-page">
      <section className="chapter-hero">
        <p className="private-eyebrow">CAPÍTULO DE HOY · {today.toLocaleUpperCase()}</p>
        <h1>La distancia también puede escribir cosas bonitas.</h1>
        <p>Este espacio existe para encontrarse, jugar y guardar lo que construyen juntos.</p>
        <div className="chapter-actions">
          <Link className="private-primary inline" to="/historia/conversacion">
            Abrir capítulo <ChevronRight />
          </Link>
          <Link className="private-secondary inline" to="/historia/marcapaginas">
            <Heart /> Enviar señal
          </Link>
        </div>
        <div className="star-line" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>
      <section className="private-section">
        <header>
          <div>
            <p className="private-eyebrow">ENTRE NUESTRAS PÁGINAS</p>
            <h2>¿Qué quieren escribir hoy?</h2>
          </div>
        </header>
        <div className="feature-grid">
          {featureCards.map(([path, title, text, Icon]) => (
            <Link to={`/historia/${path}`} className="feature-card" key={path}>
              <span>
                <Icon />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <ChevronRight />
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}

interface MessageContent extends Record<string, unknown> {
  text: string
  replyTo?: string
  event?: 'edit' | 'delete-self' | 'delete-request' | 'reaction'
  targetId?: string
  reaction?: string
}

export function ConversationPage() {
  const { items, loading, add } = usePrivateItems<MessageContent>('messages')
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string>()
  const [query, setQuery] = useState('')
  const [remoteTyping, setRemoteTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const typingChannel = useRef<ReturnType<typeof createTypingChannel>>(null)
  const session = useAppStore((state) => state.session)
  const userId = session?.userId
  const [today] = useState(() => new Date())
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    const value = text.trim()
    setText('')
    await add('message', { text: value, replyTo })
    if (supabase && session?.relationshipId && !session.relationshipId.startsWith('local-'))
      void supabase.functions.invoke('send-push', {
        body: { relationshipId: session.relationshipId, notificationKind: 2 },
      })
    setReplyTo(undefined)
  }
  const sendEvent = async (event: NonNullable<MessageContent['event']>, targetId: string, value = '') => {
    await add(`message-${event}`, {
      text: event === 'edit' ? value : '',
      event,
      targetId,
      ...(event === 'reaction' ? { reaction: '♡' } : {}),
    })
  }
  const edit = (item: PrivateItem<MessageContent>) => {
    const next = window.prompt('Editar mensaje', item.content.text)
    if (next?.trim()) void sendEvent('edit', item.id, next.trim())
  }
  const events = items.filter((item) => item.content.event && item.content.targetId)
  const hidden = new Set(
    events
      .filter((item) => item.content.event === 'delete-self' && item.senderId === userId)
      .map((item) => item.content.targetId),
  )
  const displayedItems = items
    .filter((item) => !item.content.event && !hidden.has(item.id))
    .map((item) => {
      const editEvent = events
        .filter(
          (event) =>
            event.content.event === 'edit' &&
            event.content.targetId === item.id &&
            event.senderId === item.senderId,
        )
        .at(-1)
      return {
        ...item,
        content: editEvent ? { ...item.content, text: editEvent.content.text } : item.content,
        reactions: events.filter(
          (event) => event.content.event === 'reaction' && event.content.targetId === item.id,
        ).length,
        deleteRequested: events.some(
          (event) => event.content.event === 'delete-request' && event.content.targetId === item.id,
        ),
      }
    })
    .filter((item) => item.content.text.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items])
  useEffect(() => {
    typingChannel.current = createTypingChannel(setRemoteTyping)
    return () => {
      void typingChannel.current?.close()
    }
  }, [])
  useEffect(() => {
    void typingChannel.current?.send(text.length > 0)
    const timer = window.setTimeout(() => void typingChannel.current?.send(false), 1200)
    return () => window.clearTimeout(timer)
  }, [text])
  return (
    <main className="private-page conversation-page">
      <header className="private-page-heading">
        <div>
          <p className="private-eyebrow">
            CAPÍTULO {Math.ceil((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)}
          </p>
          <h1>La noche en que seguimos escribiendo</h1>
          <p>Mensajes cifrados de extremo a extremo.</p>
        </div>
        <label className="private-search">
          <span className="sr-only">Buscar en este capítulo</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar en el capítulo…"
          />
        </label>
      </header>
      <section className="messages" aria-live="polite">
        {loading ? (
          <div className="private-loader">
            <span />
          </div>
        ) : displayedItems.length === 0 ? (
          <EmptyState
            icon={<MessageCircleHeart />}
            title="La página está en blanco"
            text="Escribe la primera línea de este capítulo."
          />
        ) : (
          displayedItems.map((item) => (
            <article className={`message ${item.senderId === userId ? 'mine' : ''}`} key={item.id}>
              {item.content.replyTo && <small className="reply-label">En respuesta a otra página</small>}
              <p>{item.content.text}</p>
              {item.deleteRequested && (
                <small className="reply-label">El autor solicitó borrarlo para ambos</small>
              )}
              {item.reactions > 0 && <span className="message-reaction">♡ {item.reactions}</span>}
              <footer>
                <time>
                  {new Date(item.createdAt).toLocaleTimeString('es-CO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
                {item.pending ? (
                  <Clock3 aria-label="Pendiente de sincronizar" />
                ) : (
                  <Check aria-label="Enviado" />
                )}
                <button onClick={() => setReplyTo(item.id)}>Responder</button>
                <button onClick={() => void sendEvent('reaction', item.id)}>Reaccionar</button>
                {item.senderId === userId && <button onClick={() => edit(item)}>Editar</button>}
                <button onClick={() => void sendEvent('delete-self', item.id)}>Ocultar</button>
                {item.senderId === userId && (
                  <button onClick={() => void sendEvent('delete-request', item.id)}>Borrar para ambos</button>
                )}
              </footer>
            </article>
          ))
        )}
        <div ref={endRef} />
      </section>
      {text.length > 0 && <div className="typing-indicator">Escribiendo en este dispositivo…</div>}
      {remoteTyping && <div className="typing-indicator">La otra persona está escribiendo…</div>}
      {replyTo && (
        <div className="reply-composer">
          <span>Responder a un mensaje</span>
          <button onClick={() => setReplyTo(undefined)}>
            <X />
          </button>
        </div>
      )}
      <form className="message-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="message">
          Escribe un mensaje
        </label>
        <textarea
          id="message"
          rows={1}
          maxLength={4000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Escribe una nueva línea…"
        />
        <button className="send-button" disabled={!text.trim()} aria-label="Enviar">
          <Send />
        </button>
      </form>
    </main>
  )
}

interface SignalContent extends Record<string, unknown> {
  label: string
  kind?: string
}

export function SignalsPage() {
  const { items, add } = usePrivateItems<SignalContent>('signals')
  const [sent, setSent] = useState('')
  const session = useAppStore((state) => state.session)
  const send = async (label: string) => {
    await add('signal', { label })
    if (supabase && session?.relationshipId && !session.relationshipId.startsWith('local-'))
      void supabase.functions.invoke('send-push', {
        body: { relationshipId: session.relationshipId, notificationKind: 1 },
      })
    setSent(label)
    navigator.vibrate?.(35)
    setTimeout(() => setSent(''), 2200)
  }
  return (
    <main className="private-page">
      <header className="private-page-heading">
        <div>
          <p className="private-eyebrow">MARCAPÁGINAS ROMÁNTICOS</p>
          <h1>Una señal entre páginas</h1>
          <p>Breve, cariñosa y sin esperar una respuesta inmediata.</p>
        </div>
      </header>
      {sent && (
        <Notice kind="success">
          <Check /> “{sent}” quedó entre sus páginas.
        </Notice>
      )}
      <div className="signal-grid">
        {signals.map((signal, index) => (
          <button onClick={() => void send(signal)} key={signal}>
            <span>{['✦', '☾', '♡', '⌁'][index % 4]}</span>
            <strong>{signal}</strong>
            <small>Enviar señal</small>
          </button>
        ))}
      </div>
      {items.length > 0 && (
        <section className="private-list-section">
          <h2>Señales recientes</h2>
          <div className="event-list">
            {items
              .slice(-6)
              .reverse()
              .map((item) => (
                <div key={item.id}>
                  <Heart />
                  <span>
                    <strong>{item.content.label}</strong>
                    <small>{new Date(item.createdAt).toLocaleString('es-CO')}</small>
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}
    </main>
  )
}

export function SamePagePage() {
  const { items, add } = usePrivateItems<SignalContent>('signals')
  const [holding, setHolding] = useState(false)
  const [matched, setMatched] = useState(false)
  const timer = useRef<number | null>(null)
  const userId = useAppStore((state) => state.session?.userId)
  const start = () => {
    setHolding(true)
    timer.current = window.setTimeout(async () => {
      const now = Date.now()
      await add('same-page', { label: 'Estoy en la misma página', kind: 'same-page' })
      const other = items.find(
        (item) =>
          item.content.kind === 'same-page' &&
          item.senderId !== userId &&
          now - new Date(item.createdAt).getTime() < 15_000,
      )
      if (other) {
        setMatched(true)
        navigator.vibrate?.([35, 50, 35])
      }
      setHolding(false)
    }, 1200)
  }
  const stop = () => {
    setHolding(false)
    if (timer.current) window.clearTimeout(timer.current)
  }
  const matches = items.filter((item) => item.content.kind === 'match')
  return (
    <main className="private-page same-page">
      <header className="private-page-heading centered">
        <div>
          <p className="private-eyebrow">EN LA MISMA PÁGINA</p>
          <h1>Encontrarse sin decir una palabra</h1>
          <p>Mantén presionada la estrella. Si la otra persona lo hace dentro de 15 segundos, coinciden.</p>
        </div>
      </header>
      <button
        className={`hold-button ${holding ? 'holding' : ''}`}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span>
          <Star fill="currentColor" />
        </span>
        <strong>{holding ? 'Sigue aquí…' : 'Mantener presionado'}</strong>
      </button>
      {matched && (
        <div className="match-celebration" role="status">
          <Sparkles />
          <h2>Coincidieron en la misma página.</h2>
          <p>Dos presencias, el mismo instante.</p>
          <button
            className="private-secondary"
            onClick={() => {
              void add('same-page-match', { label: 'Coincidieron en la misma página', kind: 'match' })
              setMatched(false)
            }}
          >
            Guardar el momento
          </button>
        </div>
      )}
      <section className="private-list-section">
        <h2>Coincidencias guardadas</h2>
        {matches.length ? (
          <div className="event-list">
            {matches.map((item) => (
              <div key={item.id}>
                <Star />
                <span>
                  <strong>En la misma página</strong>
                  <small>{new Date(item.createdAt).toLocaleString('es-CO')}</small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-private">
            La primera coincidencia aparecerá aquí. No pasa nada si hoy no ocurre.
          </p>
        )}
      </section>
    </main>
  )
}

interface LetterContent extends Record<string, unknown> {
  category: string
  title: string
  body: string
  openMode: string
  openAt?: string
}

export function LettersPage() {
  const { items, add } = usePrivateItems<LetterContent>('letters')
  const [creating, setCreating] = useState(false)
  const [opened, setOpened] = useState<PrivateItem<LetterContent> | null>(null)
  const [form, setForm] = useState<LetterContent>({
    category: letterCategories[0],
    title: '',
    body: '',
    openMode: 'now',
  })
  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    await add('letter', form)
    setCreating(false)
    setForm({ category: letterCategories[0], title: '', body: '', openMode: 'now' })
  }
  const canOpen = (letter: LetterContent) =>
    letter.openMode !== 'date' || !letter.openAt || new Date(letter.openAt) <= new Date()
  return (
    <main className="private-page">
      <header className="private-page-heading">
        <div>
          <p className="private-eyebrow">CARTAS ESCONDIDAS</p>
          <h1>Palabras para el momento justo</h1>
          <p>El contenido permanece cifrado hasta que la bóveda está abierta.</p>
        </div>
        <button className="private-primary" onClick={() => setCreating(true)}>
          <Plus /> Escribir carta
        </button>
      </header>
      {items.length ? (
        <div className="letter-grid">
          {items
            .slice()
            .reverse()
            .map((item) => (
              <button
                className="letter-card"
                key={item.id}
                onClick={() => canOpen(item.content) && setOpened(item)}
                disabled={!canOpen(item.content)}
              >
                <span className="letter-seal">
                  <Heart fill="currentColor" />
                </span>
                <p>{item.content.category}</p>
                <h2>{item.content.title || 'Carta sin título'}</h2>
                <small>
                  {canOpen(item.content)
                    ? 'Tocar para abrir'
                    : `Se abre ${new Date(item.content.openAt ?? '').toLocaleString('es-CO')}`}
                </small>
              </button>
            ))}
        </div>
      ) : (
        <EmptyState
          icon={<Feather />}
          title="Todavía no hay cartas"
          text="Escribe una para que aparezca en el momento que elijas."
          action={
            <button className="private-primary" onClick={() => setCreating(true)}>
              Escribir la primera
            </button>
          }
        />
      )}
      {creating && (
        <Modal title="Escribir una carta escondida" onClose={() => setCreating(false)}>
          <form className="stack-form" onSubmit={create}>
            <Field label="Categoría">
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {letterCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </Field>
            <Field label="Título">
              <input
                required
                maxLength={100}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </Field>
            <Field label="Carta">
              <textarea
                required
                rows={8}
                maxLength={8000}
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
              />
            </Field>
            <Field label="Cuándo puede abrirse">
              <select
                value={form.openMode}
                onChange={(event) => setForm({ ...form, openMode: event.target.value })}
              >
                <option value="now">Inmediatamente</option>
                <option value="date">En una fecha</option>
                <option value="surprise">Por sorpresa</option>
              </select>
            </Field>
            {form.openMode === 'date' && (
              <Field label="Fecha y hora">
                <input
                  type="datetime-local"
                  required
                  onChange={(event) =>
                    setForm({ ...form, openAt: new Date(event.target.value).toISOString() })
                  }
                />
              </Field>
            )}
            <button className="primary-button">Guardar carta cifrada</button>
          </form>
        </Modal>
      )}
      {opened && (
        <Modal title={opened.content.title} onClose={() => setOpened(null)}>
          <article className="opened-letter">
            <p className="eyebrow">{opened.content.category}</p>
            <p>{opened.content.body}</p>
            <footer>Guardada el {new Date(opened.createdAt).toLocaleDateString('es-CO')}</footer>
          </article>
        </Modal>
      )}
    </main>
  )
}

interface AnswerContent extends Record<string, unknown> {
  question: string
  answer: string
  reveal: 'now' | 'together'
}

export function DailyQuestionPage() {
  const [today] = useState(() => new Date())
  const question = dailyQuestions[Math.floor(today.getTime() / 86400000) % dailyQuestions.length]
  const { items, add } = usePrivateItems<AnswerContent>('daily_answers')
  const [answer, setAnswer] = useState('')
  const [reveal, setReveal] = useState<'now' | 'together'>('together')
  const [skipped, setSkipped] = useState(false)
  const todayAnswers = items.filter((item) => item.content.question === question)
  const userId = useAppStore((state) => state.session?.userId)
  const mine = todayAnswers.find((item) => item.senderId === userId)
  const both = new Set(todayAnswers.map((item) => item.senderId)).size >= 2
  const submit = async () => {
    if (!answer.trim()) return
    await add('daily-answer', { question, answer: answer.trim(), reveal })
    setAnswer('')
  }
  return (
    <main className="private-page question-page">
      <header className="private-page-heading centered">
        <div>
          <p className="private-eyebrow">PREGUNTA DEL DÍA</p>
          <h1>{question}</h1>
          <p>Responder, revelar o saltar: ninguna opción tiene penalización.</p>
        </div>
      </header>
      {skipped ? (
        <EmptyState
          icon={<Sparkles />}
          title="Página libre por hoy"
          text="Saltar también es una respuesta válida. Mañana habrá otra pregunta."
          action={
            <button className="private-link" onClick={() => setSkipped(false)}>
              Quiero responder después de todo
            </button>
          }
        />
      ) : !mine ? (
        <section className="question-card">
          <textarea
            rows={6}
            value={answer}
            maxLength={2000}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Escribe lo que te nazca…"
          />
          <div className="reveal-options">
            <button className={reveal === 'together' ? 'active' : ''} onClick={() => setReveal('together')}>
              <UsersRound /> Revelar juntos
            </button>
            <button className={reveal === 'now' ? 'active' : ''} onClick={() => setReveal('now')}>
              <Sparkles /> Mostrar ahora
            </button>
          </div>
          <button className="private-primary" disabled={!answer.trim()} onClick={() => void submit()}>
            Guardar respuesta
          </button>
          <button className="private-link" onClick={() => setSkipped(true)}>
            Saltar por hoy, sin problema
          </button>
        </section>
      ) : (
        <section className="answers-reveal">
          <div>
            <span>Tu respuesta</span>
            <p>{mine.content.answer}</p>
          </div>
          {todayAnswers
            .filter((item) => item.senderId !== userId)
            .map((item) => (
              <div key={item.id}>
                <span>Su respuesta</span>
                <p>
                  {both || item.content.reveal === 'now'
                    ? item.content.answer
                    : 'Se revelará cuando ambos respondan.'}
                </p>
              </div>
            ))}
        </section>
      )}
    </main>
  )
}

interface StoryContent extends Record<string, unknown> {
  text: string
  chapter: number
}

export function SharedBookPage() {
  const { items, add } = usePrivateItems<StoryContent>('story_entries')
  const [text, setText] = useState('')
  const userId = useAppStore((state) => state.session?.userId)
  const last = items.at(-1)
  const myTurn = !last || last.senderId !== userId
  const submit = async () => {
    if (!text.trim() || !myTurn) return
    await add('story-entry', { text: text.trim(), chapter: 1 })
    setText('')
  }
  return (
    <main className="private-page book-writing">
      <header className="private-page-heading">
        <div>
          <p className="private-eyebrow">NUESTRO LIBRO</p>
          <h1>Los kilómetros entre dos páginas</h1>
          <p>Una historia por turnos, con cada fragmento cifrado.</p>
        </div>
      </header>
      <article className="shared-manuscript">
        <header>
          <span>CAPÍTULO I</span>
          <h2>Donde siempre volvemos</h2>
        </header>
        <p className="opening-line">
          Había una vez dos personas separadas por muchos kilómetros que siempre terminaban regresando a la
          misma historia.
        </p>
        {items.map((item) => (
          <p key={item.id} className={item.senderId === userId ? 'my-entry' : ''}>
            {item.content.text}
          </p>
        ))}
        <footer>— {items.length + 1} fragmentos</footer>
      </article>
      <section className="story-composer">
        <p>
          {myTurn ? 'Es tu turno de continuar.' : 'La siguiente página le corresponde a la otra persona.'}
        </p>
        <textarea
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={5000}
          disabled={!myTurn}
          placeholder="Continúa la historia…"
        />
        <button className="private-primary" disabled={!myTurn || !text.trim()} onClick={() => void submit()}>
          <Feather /> Añadir fragmento
        </button>
      </section>
    </main>
  )
}

interface ChallengeContent extends Record<string, unknown> {
  challenge: string
  status: string
}

export function RoulettePage() {
  const { items, add } = usePrivateItems<ChallengeContent>('romantic_challenges')
  const [spinning, setSpinning] = useState(false)
  const [selected, setSelected] = useState('')
  const spin = () => {
    setSpinning(true)
    setTimeout(() => {
      setSelected(rouletteOptions[Math.floor(Math.random() * rouletteOptions.length)])
      setSpinning(false)
      navigator.vibrate?.(30)
    }, 900)
  }
  const save = async (status: string) => {
    await add('challenge', { challenge: selected, status })
    setSelected('')
  }
  return (
    <main className="private-page roulette-page">
      <header className="private-page-heading centered">
        <div>
          <p className="private-eyebrow">RULETA ROMÁNTICA</p>
          <h1>Deja una página al azar</h1>
          <p>Aceptar, guardar o pasar siempre es una elección libre.</p>
        </div>
      </header>
      <div className={`roulette-wheel ${spinning ? 'spinning' : ''}`}>
        <span>
          <Heart fill="currentColor" />
        </span>
        {rouletteOptions.slice(0, 8).map((option, index) => (
          <i key={option} style={{ transform: `rotate(${index * 45}deg)` }} />
        ))}
      </div>
      <button className="private-primary roulette-trigger" onClick={spin} disabled={spinning}>
        <RotateCw /> {spinning ? 'Girando…' : 'Girar la ruleta'}
      </button>
      {selected && (
        <div className="challenge-result">
          <p>La página eligió:</p>
          <h2>{selected}</h2>
          <div>
            <button className="private-primary" onClick={() => void save('accepted')}>
              Aceptar
            </button>
            <button className="private-secondary" onClick={() => void save('saved')}>
              Guardar
            </button>
            <button className="private-link" onClick={() => setSelected('')}>
              Pasar sin problema
            </button>
          </div>
        </div>
      )}
      {items.length > 0 && (
        <section className="private-list-section">
          <h2>Actividades guardadas</h2>
          <div className="event-list">
            {items
              .slice(-5)
              .reverse()
              .map((item) => (
                <div key={item.id}>
                  <Sparkles />
                  <span>
                    <strong>{item.content.challenge}</strong>
                    <small>{item.content.status === 'accepted' ? 'Aceptada' : 'Guardada'}</small>
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}
    </main>
  )
}

interface DateContent extends Record<string, unknown> {
  title: string
  at: string
  theme: string
  notes: string
  confirmed: boolean
}

export function VirtualDatePage() {
  const { items, add } = usePrivateItems<DateContent>('virtual_dates')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<DateContent>({
    title: '',
    at: '',
    theme: 'Película',
    notes: '',
    confirmed: false,
  })
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const scheduledAt = new Date(form.at).toISOString()
    await add('virtual-date', { ...form, at: scheduledAt }, { scheduledAt })
    setCreating(false)
  }
  const upcoming = items
    .filter((item) => new Date(item.content.at) >= new Date())
    .sort((a, b) => a.content.at.localeCompare(b.content.at))
  return (
    <main className="private-page">
      <header className="private-page-heading">
        <div>
          <p className="private-eyebrow">NUESTRA CITA</p>
          <h1>Tiempo reservado para nosotros</h1>
          <p>Planea el encuentro; la notificación exterior será siempre neutra.</p>
        </div>
        <button className="private-primary" onClick={() => setCreating(true)}>
          <Plus /> Invitar
        </button>
      </header>
      {upcoming.length ? (
        <div className="date-grid">
          {upcoming.map((item) => (
            <article key={item.id}>
              <div className="date-day">
                <strong>{new Date(item.content.at).getDate()}</strong>
                <span>{new Date(item.content.at).toLocaleString('es-CO', { month: 'short' })}</span>
              </div>
              <div>
                <span className="status-pill">{item.content.theme}</span>
                <h2>{item.content.title}</h2>
                <p>{new Date(item.content.at).toLocaleString('es-CO')}</p>
                <small>{item.content.notes}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CalendarHeart />}
          title="La agenda está abierta"
          text="Invita a una cita virtual con fecha, tema y una sorpresa opcional."
        />
      )}
      {creating && (
        <Modal title="Crear Nuestra cita" onClose={() => setCreating(false)}>
          <form className="stack-form" onSubmit={submit}>
            <Field label="Nombre de la cita">
              <input
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Fecha y hora">
                <input
                  type="datetime-local"
                  required
                  value={form.at}
                  onChange={(event) => setForm({ ...form, at: event.target.value })}
                />
              </Field>
              <Field label="Tema">
                <select
                  value={form.theme}
                  onChange={(event) => setForm({ ...form, theme: event.target.value })}
                >
                  <option>Película</option>
                  <option>Canción</option>
                  <option>Libro</option>
                  <option>Conversación</option>
                  <option>Sorpresa</option>
                </select>
              </Field>
            </div>
            <Field label="Detalles o preguntas">
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </Field>
            <button className="primary-button">Guardar invitación cifrada</button>
          </form>
        </Modal>
      )}
    </main>
  )
}

interface MemoryContent extends Record<string, unknown> {
  category: string
  title: string
  text: string
  link?: string
  image?: EncryptedImageRef
}

function EncryptedMemoryImage({ reference, senderId }: { reference: EncryptedImageRef; senderId: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let active = true
    let objectUrl = ''
    void downloadEncryptedMemoryImage(reference, senderId)
      .then((value) => {
        objectUrl = value
        if (active) setUrl(value)
        else URL.revokeObjectURL(value)
      })
      .catch(() => undefined)
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [reference, senderId])
  return url ? (
    <img className="memory-image" src={url} alt="Recuerdo visual cifrado" />
  ) : (
    <div className="memory-image-loading">Abriendo imagen cifrada…</div>
  )
}

export function MemoriesPage() {
  const { items, add } = usePrivateItems<MemoryContent>('memories')
  const [creating, setCreating] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<MemoryContent>({ category: 'Recuerdo', title: '', text: '', link: '' })
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const encryptedImage = image ? await uploadEncryptedMemoryImage(image) : undefined
      await add('memory', { ...form, image: encryptedImage })
      setCreating(false)
      setImage(null)
      setForm({ category: 'Recuerdo', title: '', text: '', link: '' })
    } catch {
      setError('No fue posible cifrar y guardar la imagen. El texto no se perdió.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="private-page">
      <header className="private-page-heading">
        <div>
          <p className="private-eyebrow">COFRE DE RECUERDOS</p>
          <h1>Lo que merece quedarse</h1>
          <p>Frases, promesas, canciones, planes y pequeñas coordenadas emocionales.</p>
        </div>
        <button className="private-primary" onClick={() => setCreating(true)}>
          <Plus /> Guardar recuerdo
        </button>
      </header>
      {items.length ? (
        <div className="memory-grid">
          {items
            .slice()
            .reverse()
            .map((item, index) => (
              <article key={item.id}>
                <span className={`memory-symbol symbol-${index % 4}`}>{['✦', '☾', '⌁', '♡'][index % 4]}</span>
                <p className="private-eyebrow">{item.content.category}</p>
                <h2>{item.content.title}</h2>
                {item.content.image && (
                  <EncryptedMemoryImage reference={item.content.image} senderId={item.senderId} />
                )}
                <p>{item.content.text}</p>
                {item.content.link && (
                  <a href={item.content.link} target="_blank" rel="noreferrer">
                    Abrir enlace <ChevronRight />
                  </a>
                )}
                <small>{new Date(item.createdAt).toLocaleDateString('es-CO')}</small>
              </article>
            ))}
        </div>
      ) : (
        <EmptyState
          icon={<Star />}
          title="El cofre está esperando"
          text="Guarda el primer recuerdo compartido."
        />
      )}
      {creating && (
        <Modal title="Guardar un recuerdo" onClose={() => setCreating(false)}>
          <form className="stack-form" onSubmit={submit}>
            <Field label="Tipo">
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {['Recuerdo', 'Frase', 'Promesa', 'Canción', 'Lugar', 'Plan', 'Meta'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <Field label="Título">
              <input
                required
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </Field>
            <Field label="Historia">
              <textarea
                required
                rows={5}
                value={form.text}
                onChange={(event) => setForm({ ...form, text: event.target.value })}
              />
            </Field>
            <Field label="Enlace opcional">
              <input
                type="url"
                value={form.link}
                onChange={(event) => setForm({ ...form, link: event.target.value })}
              />
            </Field>
            <Field label="Imagen opcional" hint="JPEG, PNG o WebP; se comprime y cifra antes de subir.">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              />
            </Field>
            {error && <Notice kind="error">{error}</Notice>}
            <button className="primary-button" disabled={busy}>
              {busy ? 'Cifrando recuerdo…' : 'Guardar cifrado'}
            </button>
          </form>
        </Modal>
      )}
    </main>
  )
}

export function UniversePage() {
  const memories = usePrivateItems<MemoryContent>('memories')
  const letters = usePrivateItems<LetterContent>('letters')
  const dates = usePrivateItems<DateContent>('virtual_dates')
  const stars = useMemo(
    () =>
      [
        ...memories.items.map((item) => ({ ...item, label: item.content.title, kind: 'Recuerdo' })),
        ...letters.items.map((item) => ({ ...item, label: item.content.title, kind: 'Carta' })),
        ...dates.items.map((item) => ({ ...item, label: item.content.title, kind: 'Cita' })),
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [dates.items, letters.items, memories.items],
  )
  const [selected, setSelected] = useState<(typeof stars)[number] | null>(null)
  return (
    <main className="private-page universe-page">
      <header className="private-page-heading centered">
        <div>
          <p className="private-eyebrow">NUESTRO UNIVERSO</p>
          <h1>
            {stars.length
              ? `${stars.length} estrellas escritas entre los dos`
              : 'El cielo espera su primera estrella'}
          </h1>
          <p>Cada recuerdo, carta y cita añade un punto de luz.</p>
        </div>
      </header>
      <div className="constellation" aria-label="Mapa de recuerdos">
        {stars.map((star, index) => (
          <button
            key={`${star.table}-${star.id}`}
            style={{
              left: `${8 + ((index * 37) % 84)}%`,
              top: `${12 + ((index * 29) % 76)}%`,
              animationDelay: `${index * 120}ms`,
            }}
            onClick={() => setSelected(star)}
            aria-label={`Abrir ${star.kind}: ${star.label}`}
          >
            <Star fill="currentColor" />
          </button>
        ))}
        {stars.length === 0 && <Orbit />}
      </div>
      {selected && (
        <Modal title={selected.label} onClose={() => setSelected(null)}>
          <div className="star-detail">
            <Star fill="currentColor" />
            <p className="eyebrow">{selected.kind}</p>
            <p>Creado el {new Date(selected.createdAt).toLocaleString('es-CO')}</p>
          </div>
        </Modal>
      )}
    </main>
  )
}

interface GiftContent extends Record<string, unknown> {
  type: string
  title: string
  message: string
  revealAt?: string
}

export function GiftsPage() {
  const { items, add } = usePrivateItems<GiftContent>('gifts')
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<GiftContent>({ type: 'Carta', title: '', message: '' })
  const save = async () => {
    await add('gift', form)
    setStep(0)
    setForm({ type: 'Carta', title: '', message: '' })
  }
  return (
    <main className="private-page">
      <header className="private-page-heading">
        <div>
          <p className="private-eyebrow">REGALOS DIGITALES</p>
          <h1>Una sorpresa entre páginas</h1>
          <p>Crea algo pequeño que pueda abrirse y conservarse.</p>
        </div>
        <button className="private-primary" onClick={() => setStep(1)}>
          <Gift /> Crear regalo
        </button>
      </header>
      {step > 0 && (
        <section className="gift-builder">
          <div className="stepper">
            <span className={step >= 1 ? 'active' : ''}>1</span>
            <i />
            <span className={step >= 2 ? 'active' : ''}>2</span>
            <i />
            <span className={step >= 3 ? 'active' : ''}>3</span>
          </div>
          {step === 1 && (
            <div>
              <h2>Elige el tipo</h2>
              <div className="gift-types">
                {[
                  'Carta',
                  '10 razones',
                  'Lista de canciones',
                  'Promesa',
                  'Boleto para cita',
                  'Caja con fecha',
                ].map((type) => (
                  <button
                    className={form.type === type ? 'active' : ''}
                    onClick={() => setForm({ ...form, type })}
                    key={type}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <button className="private-primary" onClick={() => setStep(2)}>
                Continuar
              </button>
            </div>
          )}
          {step === 2 && (
            <div>
              <h2>Escribe el regalo</h2>
              <Field label="Título">
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </Field>
              <Field label="Mensaje">
                <textarea
                  rows={7}
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                />
              </Field>
              <button
                className="private-primary"
                disabled={!form.title || !form.message}
                onClick={() => setStep(3)}
              >
                Vista final
              </button>
            </div>
          )}
          {step === 3 && (
            <div className="gift-preview">
              <Gift />
              <p className="private-eyebrow">{form.type}</p>
              <h2>{form.title}</h2>
              <p>{form.message}</p>
              <button className="private-primary" onClick={() => void save()}>
                Envolver y guardar cifrado
              </button>
            </div>
          )}
          <button className="private-link" onClick={() => setStep(0)}>
            Cancelar
          </button>
        </section>
      )}
      {step === 0 &&
        (items.length ? (
          <div className="gift-grid">
            {items
              .slice()
              .reverse()
              .map((item) => (
                <article key={item.id}>
                  <Gift />
                  <span>{item.content.type}</span>
                  <h2>{item.content.title}</h2>
                  <p>{item.content.message}</p>
                </article>
              ))}
          </div>
        ) : (
          <EmptyState
            icon={<Gift />}
            title="Todavía no hay regalos"
            text="Crea una carta, promesa, lista o boleto especial."
          />
        ))}
    </main>
  )
}

export function SettingsPage() {
  const session = useAppStore((state) => state.session)
  const setSession = useAppStore((state) => state.setSession)
  const navigate = useNavigate()
  const [pushState, setPushState] = useState<NotificationPermission | 'unsupported'>(
    !('Notification' in window) ? 'unsupported' : Notification.permission,
  )
  const [inviteUrl, setInviteUrl] = useState('')
  const statuses = usePrivateItems<SignalContent>('signals')
  const [romanticStatus, setRomanticStatus] = useState('Pensando en ti')
  const [busy, setBusy] = useState(false)
  const [danger, setDanger] = useState<'unlink' | 'delete' | null>(null)
  const activatePush = async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setPushState(permission)
    if (permission !== 'granted' || !supabase) return
    const registration = await navigator.serviceWorker.ready
    const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!key || !session) return
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    })
    let deviceId = await getSetting<string>('deviceId')
    if (!deviceId) {
      deviceId = crypto.randomUUID()
      await putSetting('deviceId', deviceId)
    }
    await supabase.from('devices').upsert({
      id: deviceId,
      user_id: session.userId,
      label: navigator.userAgent.includes('iPhone') ? 'iPhone' : 'Navegador actual',
      last_seen_at: new Date().toISOString(),
    })
    await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: session.userId, device_id: deviceId, subscription: subscription.toJSON() },
        { onConflict: 'user_id,device_id' },
      )
  }
  const createInvite = async () => {
    if (!supabase || !session?.relationshipId) return
    setBusy(true)
    try {
      const { masterKey } = getPrivateSession()
      const secret = createPairingSecret()
      const envelope = await createPairingEnvelope(masterKey, secret, session.relationshipId)
      const { data, error } = await supabase.functions.invoke('create-invite', {
        body: { pairingEnvelope: envelope, expiresInHours: 24 },
      })
      if (error) throw error
      setInviteUrl(
        `${location.origin}${import.meta.env.BASE_URL}aceptar-invitacion/${data.token as string}#s=${encodeURIComponent(secret)}`,
      )
    } finally {
      setBusy(false)
    }
  }
  const leave = async () => {
    if (!supabase || !danger) return
    const functionName = danger === 'delete' ? 'delete-account' : 'unlink'
    const { error } = await supabase.functions.invoke(functionName)
    if (error) return
    if (session?.relationshipId) await deleteVault(session.relationshipId)
    await clearSensitiveCache()
    clearPrivateSession()
    setSession(null)
    navigate('/', { replace: true })
  }
  return (
    <main className="private-page settings-page">
      <header className="private-page-heading">
        <div>
          <p className="private-eyebrow">CONFIGURACIÓN</p>
          <h1>Privacidad y preferencias</h1>
          <p>Ambos miembros tienen los mismos permisos.</p>
        </div>
      </header>
      <section className="settings-group">
        <h2>
          <Heart /> Estado romántico
        </h2>
        <div className="setting-row">
          <div>
            <strong>Cómo te sientes ahora</strong>
            <small>Es voluntario y nunca genera alertas por ausencia.</small>
          </div>
          <select value={romanticStatus} onChange={(event) => setRomanticStatus(event.target.value)}>
            {[
              'Pensando en ti',
              'Te extraño',
              'Quiero hablar contigo',
              'Estoy feliz de tenerte',
              'Quiero escuchar tu voz',
              'Tengo una sorpresa',
              'Estoy recordándonos',
              'Disponible para una cita',
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <button
            className="private-secondary"
            onClick={() => void statuses.add('romantic-status', { label: romanticStatus, kind: 'status' })}
          >
            Compartir estado
          </button>
        </div>
      </section>
      <section className="settings-group">
        <h2>
          <Bell /> Notificaciones discretas
        </h2>
        <div className="setting-row">
          <div>
            <strong>Avisos de nuevos capítulos</strong>
            <small>Nunca incluyen contenido privado ni nombres internos.</small>
          </div>
          <button
            className="private-secondary"
            disabled={pushState === 'granted' || pushState === 'unsupported'}
            onClick={() => void activatePush()}
          >
            {pushState === 'granted'
              ? 'Activadas'
              : pushState === 'denied'
                ? 'Permiso denegado'
                : pushState === 'unsupported'
                  ? 'No compatible'
                  : 'Activar'}
          </button>
        </div>
      </section>
      <section className="settings-group">
        <h2>
          <UsersRound /> La relación
        </h2>
        <div className="setting-row">
          <div>
            <strong>Invitar a la segunda persona</strong>
            <small>Enlace de un solo uso, válido durante 24 horas.</small>
          </div>
          <button
            className="private-secondary"
            disabled={busy || !supabase}
            onClick={() => void createInvite()}
          >
            {busy ? 'Creando…' : 'Crear invitación'}
          </button>
        </div>
        {inviteUrl && (
          <div className="invite-output">
            <input readOnly value={inviteUrl} />
            <button onClick={() => void navigator.clipboard.writeText(inviteUrl)}>Copiar</button>
          </div>
        )}
      </section>
      <section className="settings-group">
        <h2>
          <KeyRound /> Seguridad
        </h2>
        {[
          ['Bloqueo automático', '5 minutos'],
          ['Bloqueo al minimizar', 'Activado'],
          ['Confirmaciones de lectura', 'Activadas'],
          ['Clave de protocolo', 'Versión 1 · AES-GCM'],
        ].map(([label, value]) => (
          <div className="setting-row" key={label}>
            <div>
              <strong>{label}</strong>
            </div>
            <span>{value}</span>
          </div>
        ))}
      </section>
      <section className="settings-group">
        <h2>
          <CircleUserRound /> Cuenta y dispositivos
        </h2>
        <div className="setting-row">
          <div>
            <strong>{session?.email}</strong>
            <small>Sesión cifrada guardada en IndexedDB.</small>
          </div>
          <button
            className="private-secondary"
            onClick={async () => {
              await supabase?.auth.signOut()
              clearPrivateSession()
              setSession(null)
              navigate('/')
            }}
          >
            Cerrar sesión
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Revocar otros dispositivos</strong>
            <small>Obliga a volver a iniciar sesión y desbloquear.</small>
          </div>
          <button
            className="private-secondary"
            disabled={!supabase}
            onClick={() =>
              void supabase?.functions.invoke('revoke-device', { body: { allOtherDevices: true } })
            }
          >
            Revocar
          </button>
        </div>
      </section>
      <section className="settings-group danger-zone">
        <h2>
          <ShieldCheck /> Decisiones permanentes
        </h2>
        <div className="setting-row">
          <div>
            <strong>Desvincular la relación</strong>
            <small>Impide nuevas lecturas y escritura compartida.</small>
          </div>
          <button onClick={() => setDanger('unlink')}>Desvincular</button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Eliminar mi cuenta</strong>
            <small>Elimina perfil, dispositivos y acceso.</small>
          </div>
          <button onClick={() => setDanger('delete')}>Eliminar</button>
        </div>
      </section>
      {danger && (
        <Modal
          title={danger === 'delete' ? 'Eliminar la cuenta' : 'Desvincular la relación'}
          onClose={() => setDanger(null)}
        >
          <div className="danger-confirm">
            <Trash2 />
            <p>
              Esta acción no se puede deshacer desde la aplicación. El contenido local cifrado de esta
              relación también se borrará.
            </p>
            <button className="danger-button" onClick={() => void leave()}>
              Confirmar {danger === 'delete' ? 'eliminación' : 'desvinculación'}
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}
