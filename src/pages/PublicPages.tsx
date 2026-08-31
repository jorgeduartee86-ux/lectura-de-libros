import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  ChevronLeft,
  Download,
  Heart,
  Library,
  Plus,
  Search,
  ShieldCheck,
  Star,
  WifiOff,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { BookCover, EmptyState, Field, Modal, Notice } from '../components/ui'
import { AccessCodePanel } from '../components/AccessCodePanel'
import { literaryQuotes } from '../data/seed'
import { importPairingEnvelope } from '../lib/crypto'
import { promptPwaInstall, usePwaInstall } from '../lib/install'
import { activatePrivateSession } from '../lib/privateRepository'
import { supabase } from '../lib/supabase'
import { putVault } from '../lib/storage'
import { useAppStore } from '../store/app'
import type { Book, ReadingStatus } from '../types'

const bookSchema = z.object({
  title: z.string().trim().min(1, 'Escribe un título').max(120),
  author: z.string().trim().min(1, 'Escribe el autor').max(100),
  genre: z.string().trim().min(1, 'Escribe el género').max(50),
  status: z.enum(['pending', 'reading', 'finished']),
  rating: z.number().min(0).max(5),
  note: z.string().max(1000),
  favoriteQuote: z.string().max(500),
})

type BookFormValues = z.infer<typeof bookSchema>

function BookForm({ onDone }: { onDone: () => void }) {
  const addBook = useAppStore((state) => state.addBook)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookFormValues>({
    resolver: zodResolver(bookSchema),
    defaultValues: { status: 'pending', rating: 0, note: '', favoriteQuote: '' },
  })
  const submit = async (values: BookFormValues) => {
    const book: Book = {
      ...values,
      id: crypto.randomUUID(),
      progress: values.status === 'finished' ? 100 : 0,
      addedAt: new Date().toISOString(),
      color: ['plum', 'blue', 'ochre', 'sage', 'ink'][
        (values.title.length + values.author.length) % 5
      ] as Book['color'],
    }
    await addBook(book)
    onDone()
  }
  return (
    <form className="stack-form" onSubmit={handleSubmit(submit)}>
      <div className="form-grid">
        <Field label="Título" error={errors.title?.message}>
          <input {...register('title')} autoFocus />
        </Field>
        <Field label="Autor" error={errors.author?.message}>
          <input {...register('author')} />
        </Field>
        <Field label="Género" error={errors.genre?.message}>
          <input {...register('genre')} />
        </Field>
        <Field label="Estado">
          <select {...register('status')}>
            <option value="pending">Pendiente</option>
            <option value="reading">Leyendo</option>
            <option value="finished">Terminado</option>
          </select>
        </Field>
        <Field label="Calificación">
          <select {...register('rating', { valueAsNumber: true })}>
            <option value="0">Sin calificar</option>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value} estrellas
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Nota">
        <textarea {...register('note')} rows={3} />
      </Field>
      <Field label="Cita favorita">
        <textarea {...register('favoriteQuote')} rows={2} />
      </Field>
      <button className="primary-button" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando…' : 'Añadir a mi biblioteca'}
      </button>
    </form>
  )
}

export function HomePage() {
  const books = useAppStore((state) => state.books)
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)
  const reading = books.filter((book) => book.status === 'reading').slice(0, 3)
  const finished = books.filter((book) => book.status === 'finished')
  const pages =
    finished.length * 286 + reading.reduce((total, book) => total + Math.round(book.progress * 3.2), 0)
  const date = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(),
  )
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
  const [quoteIndex] = useState(() => Math.floor(Date.now() / 86_400_000) % literaryQuotes.length)
  const dailyQuote = literaryQuotes[quoteIndex]
  const classics = books
    .filter((book) =>
      ['don-quijote', 'moby-dick', 'historia-de-dos-ciudades', 'anna-karenina'].includes(book.id),
    )
    .slice(0, 4)
  return (
    <main>
      <section className="welcome compact-welcome home-hero">
        <div className="welcome-copy">
          <p className="eyebrow">{date.toLocaleUpperCase()}</p>
          <h1>{greeting}, lectora.</h1>
          <p>Una historia nueva siempre está a una página de distancia.</p>
          <div className="welcome-actions">
            <Link className="primary-button" to="/biblioteca">
              Abrir mi biblioteca <ArrowRight size={17} />
            </Link>
            <Link className="quiet-access-link" to="/acceso">
              <ShieldCheck /> Entre páginas
            </Link>
          </div>
        </div>
        <aside className="today-reading-note">
          <span>LECTURA ACTUAL</span>
          <strong>{reading[0]?.title ?? 'Tu próxima historia'}</strong>
          <small>{reading[0]?.author ?? 'Elige un libro para comenzar'}</small>
          <div className="note-progress" aria-label={`${reading[0]?.progress ?? 0}% leído`}>
            <i style={{ width: `${reading[0]?.progress ?? 0}%` }} />
          </div>
          <em>{reading[0]?.progress ?? 0}% de esta página</em>
        </aside>
      </section>
      <section className="daily-grid" aria-label="Selección del día">
        <article className="recommendation-card">
          <div className="recommendation-copy">
            <p className="eyebrow light">RECOMENDACIÓN DEL DÍA</p>
            <h2>Una habitación propia</h2>
            <p className="byline">Virginia Woolf · Ensayo</p>
            <blockquote>
              «No hay barrera, cerradura ni cerrojo que puedas imponer a la libertad de mi mente.»
            </blockquote>
            <button className="text-button light" onClick={() => navigate('/libro/una-habitacion-propia')}>
              Ver el libro <ArrowRight size={17} />
            </button>
          </div>
          <div className="featured-book" aria-label="Portada de Una habitación propia">
            <span>VIRGINIA WOOLF</span>
            <strong>
              UNA
              <br />
              HABITACIÓN
              <br />
              PROPIA
            </strong>
            <i>1929</i>
          </div>
        </article>
        <article className="quote-card">
          <span className="quote-mark" aria-hidden="true">
            “
          </span>
          <small className="quote-card-label">CITA REAL · {dailyQuote.book.toLocaleUpperCase()}</small>
          <blockquote>{dailyQuote.text}</blockquote>
          <p>— {dailyQuote.author}</p>
          <button
            className={`bookmark-button ${saved ? 'saved' : ''}`}
            onClick={() => setSaved((value) => !value)}
            aria-pressed={saved}
            aria-label={saved ? 'Quitar cita' : 'Guardar cita'}
          >
            <Heart size={19} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </article>
      </section>
      <section className="curated-shelf" aria-labelledby="curated-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ESTANTERÍA CURADA</p>
            <h2 id="curated-title">Clásicos que siguen conversando</h2>
          </div>
          <Link className="text-button" to="/biblioteca">
            Explorar biblioteca <ArrowRight size={17} />
          </Link>
        </div>
        <div className="classic-grid">
          {classics.map((book) => (
            <Link to={`/libro/${book.id}`} className="classic-book-card" key={book.id}>
              <BookCover book={book} />
              <div>
                <span>
                  {book.genre} · {book.publishedYear}
                </span>
                <h3>{book.title}</h3>
                <p>{book.author}</p>
                <blockquote>“{book.favoriteQuote}”</blockquote>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="reading-section" aria-labelledby="reading-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TU BIBLIOTECA</p>
            <h2 id="reading-title">Continúa leyendo</h2>
          </div>
          <Link className="text-button" to="/biblioteca">
            Ver todos <ArrowRight size={17} />
          </Link>
        </div>
        {reading.length ? (
          <div className="book-row">
            {reading.map((book) => (
              <Link className="book-card" to={`/libro/${book.id}`} key={book.id}>
                <BookCover book={book} />
                <div className="book-meta">
                  <p className="genre">
                    {book.genre}
                    {book.publishedYear ? ` · ${book.publishedYear}` : ''}
                  </p>
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                  <div className="progress-line" aria-label={`${book.progress}% leído`}>
                    <span style={{ width: `${book.progress}%` }} />
                  </div>
                  <small>{book.progress}% leído</small>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BookOpen />}
            title="Tu próxima lectura comienza aquí"
            text="Añade un libro y marca su progreso."
          />
        )}
      </section>
      <section className="stats-strip" aria-label="Estadísticas de lectura">
        <div>
          <strong>{finished.length}</strong>
          <span>Libros terminados</span>
        </div>
        <div>
          <strong>{pages.toLocaleString('es-CO')}</strong>
          <span>Páginas estimadas</span>
        </div>
        <div>
          <strong>{reading.length}</strong>
          <span>En lectura</span>
        </div>
        <div>
          <strong>{books.filter((book) => book.favoriteQuote).length}</strong>
          <span>Citas guardadas</span>
        </div>
      </section>
    </main>
  )
}

export function LibraryPage() {
  const books = useAppStore((state) => state.books)
  const [filter, setFilter] = useState<'all' | ReadingStatus>('all')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const shown = books.filter(
    (book) =>
      (filter === 'all' || book.status === filter) &&
      `${book.title} ${book.author} ${book.genre}`.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <main className="page-main">
      <header className="page-heading">
        <div>
          <p className="eyebrow">COLECCIÓN PERSONAL</p>
          <h1>Mi biblioteca</h1>
          <p>{books.length} libros guardados en este dispositivo.</p>
        </div>
        <button className="primary-button" onClick={() => setAdding(true)}>
          <Plus /> Añadir libro
        </button>
      </header>
      <div className="toolbar">
        <label className="search-box">
          <Search size={18} />
          <span className="sr-only">Filtrar biblioteca</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar biblioteca…"
          />
        </label>
        <div className="segmented">
          {(
            [
              ['all', 'Todos'],
              ['reading', 'Leyendo'],
              ['pending', 'Pendientes'],
              ['finished', 'Terminados'],
            ] as const
          ).map(([value, label]) => (
            <button className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {shown.length ? (
        <div className="library-grid">
          {shown.map((book) => (
            <Link to={`/libro/${book.id}`} className="library-item" key={book.id}>
              <BookCover book={book} />
              <div>
                <span className="status-pill">
                  {book.status === 'reading'
                    ? 'Leyendo'
                    : book.status === 'finished'
                      ? 'Terminado'
                      : 'Pendiente'}
                </span>
                <h2>{book.title}</h2>
                <p>{book.author}</p>
                <small>{book.genre}</small>
                <div className="rating" aria-label={`${book.rating} de 5 estrellas`}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star key={value} size={14} fill={value <= book.rating ? 'currentColor' : 'none'} />
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Library />}
          title="Ningún libro coincide"
          text="Prueba otro filtro o añade una lectura."
        />
      )}
      {adding && (
        <Modal title="Añadir un libro" onClose={() => setAdding(false)}>
          <BookForm onDone={() => setAdding(false)} />
        </Modal>
      )}
    </main>
  )
}

export function BookDetailPage() {
  const { id } = useParams()
  const book = useAppStore((state) => state.books.find((item) => item.id === id))
  const updateBook = useAppStore((state) => state.updateBook)
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)
  const [draft, setDraft] = useState(book)
  if (!book || !draft) return <NotFoundPage />
  const save = async () => {
    await updateBook(draft)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  }
  return (
    <main className="page-main">
      <button className="back-button" onClick={() => navigate(-1)}>
        <ChevronLeft /> Volver
      </button>
      <section className="book-detail">
        <BookCover book={book} />
        <div className="book-detail-copy">
          <p className="eyebrow">{book.genre}</p>
          <h1>{book.title}</h1>
          <p className="detail-author">{book.author}</p>
          <div className="rating big">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                aria-label={`Calificar con ${value}`}
                key={value}
                onClick={() => setDraft({ ...draft, rating: value })}
              >
                <Star fill={value <= draft.rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <div className="progress-editor">
            <label>
              Progreso <strong>{draft.progress}%</strong>
              <input
                type="range"
                min="0"
                max="100"
                value={draft.progress}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    progress: Number(event.target.value),
                    status:
                      Number(event.target.value) === 100
                        ? 'finished'
                        : Number(event.target.value) > 0
                          ? 'reading'
                          : 'pending',
                  })
                }
              />
            </label>
          </div>
          <Field label="Mi nota">
            <textarea
              rows={5}
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            />
          </Field>
          <Field label="Cita favorita">
            <textarea
              rows={3}
              value={draft.favoriteQuote}
              onChange={(event) => setDraft({ ...draft, favoriteQuote: event.target.value })}
            />
          </Field>
          <button className="primary-button" onClick={() => void save()}>
            {saved ? (
              <>
                <Check /> Guardado
              </>
            ) : (
              'Guardar cambios'
            )}
          </button>
        </div>
      </section>
    </main>
  )
}

export function QuotesPage() {
  const books = useAppStore((state) => state.books)
  const quotes = books.filter((book) => book.favoriteQuote)
  return (
    <main className="page-main">
      <header className="page-heading">
        <div>
          <p className="eyebrow">PASAJES GUARDADOS</p>
          <h1>Citas favoritas</h1>
          <p>Palabras a las que vale la pena volver.</p>
        </div>
      </header>
      {quotes.length ? (
        <div className="quotes-grid">
          {quotes.map((book) => (
            <blockquote key={book.id}>
              <Heart size={18} />
              <p>“{book.favoriteQuote}”</p>
              <footer>
                {book.author} · <Link to={`/libro/${book.id}`}>{book.title}</Link>
              </footer>
            </blockquote>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Heart />}
          title="Aún no hay citas"
          text="Guarda una desde el detalle de un libro."
        />
      )}
    </main>
  )
}

export function AuthorsPage() {
  const books = useAppStore((state) => state.books)
  const authors = useMemo(() => [...new Set(books.map((book) => book.author))].sort(), [books])
  return (
    <main className="page-main">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ÍNDICE DE AUTORES</p>
          <h1>Autores</h1>
          <p>{authors.length} voces en tu biblioteca.</p>
        </div>
      </header>
      <div className="authors-list">
        {authors.map((author) => {
          const authored = books.filter((book) => book.author === author)
          return (
            <section key={author}>
              <span>{author.slice(0, 1)}</span>
              <div>
                <h2>{author}</h2>
                <p>{authored.map((book) => book.title).join(' · ')}</p>
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}

export function SearchPage() {
  const books = useAppStore((state) => state.books)
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const navigate = useNavigate()
  useEffect(() => {
    if (query.trim().toLocaleLowerCase() === 'margen') navigate('/desbloquear')
  }, [navigate, query])
  const results = books.filter((book) =>
    `${book.title} ${book.author} ${book.genre}`.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <main className="page-main">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ENCUENTRA TU PRÓXIMA PÁGINA</p>
          <h1>Buscar</h1>
        </div>
      </header>
      <label className="search-box search-large">
        <Search />
        <span className="sr-only">Buscar</span>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Título, autor o género…"
        />
      </label>
      {query &&
        (results.length ? (
          <div className="search-results">
            {results.map((book) => (
              <Link to={`/libro/${book.id}`} key={book.id}>
                <BookCover book={book} compact />
                <span>
                  <strong>{book.title}</strong>
                  <small>
                    {book.author} · {book.genre}
                  </small>
                </span>
                <ArrowRight />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Search />}
            title="Sin resultados"
            text="Revisa la escritura o intenta otro término."
          />
        ))}
    </main>
  )
}

export function InstallPage() {
  const { available, installed } = usePwaInstall()
  const [showHelp, setShowHelp] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const install = async () => {
    const result = await promptPwaInstall()
    setDismissed(result === 'dismissed')
    setShowHelp(result === 'unavailable' || result === 'dismissed')
  }
  return (
    <main className="page-main narrow">
      <header className="page-heading centered">
        <div>
          <p className="eyebrow">LLEVA TU BIBLIOTECA CONTIGO</p>
          <h1>Instalar Lectura de libros</h1>
          <p>
            Funciona como una aplicación, sin tienda y con parte de tu biblioteca disponible sin conexión.
          </p>
        </div>
      </header>
      {installed ? (
        <Notice kind="success">
          <Check /> La aplicación ya está instalada en este dispositivo.
        </Notice>
      ) : (
        <section className="install-card">
          <Download />
          <h2>{isIos ? 'En iPhone o iPad' : 'En Android o escritorio'}</h2>
          {isIos ? (
            <ol>
              <li>Abre esta página en Safari.</li>
              <li>Toca el botón Compartir.</li>
              <li>Elige “Agregar a pantalla de inicio”.</li>
              <li>Confirma con “Agregar”.</li>
            </ol>
          ) : (
            <>
              <p>
                {available
                  ? 'Android ya tiene lista la instalación. Toca el botón y confirma.'
                  : 'Puedes añadirla desde Chrome y abrirla como cualquier otra aplicación.'}
              </p>
              <button className="primary-button install-main-button" onClick={() => void install()}>
                <Download /> {available ? 'Instalar ahora' : 'Ver cómo instalar'}
              </button>
              {(showHelp || !available) && (
                <div className="android-install-guide" role="status">
                  <strong>
                    {dismissed ? 'La instalación se cerró' : 'Si Android no muestra la ventana'}
                  </strong>
                  <ol>
                    <li>Abre esta página directamente en Google Chrome.</li>
                    <li>Toca los tres puntos ⋮ de la esquina superior.</li>
                    <li>Elige “Instalar aplicación” o “Añadir a pantalla principal”.</li>
                    <li>Confirma tocando “Instalar”.</li>
                  </ol>
                </div>
              )}
            </>
          )}
        </section>
      )}
      <section className="feature-list">
        <div>
          <WifiOff />
          <span>
            <strong>Lectura sin conexión</strong>
            <small>El catálogo y tus notas locales siguen disponibles.</small>
          </span>
        </div>
        <div>
          <Bell />
          <span>
            <strong>Avisos discretos</strong>
            <small>Se activan solo cuando tú lo decides.</small>
          </span>
        </div>
        <div>
          <ShieldCheck />
          <span>
            <strong>Privacidad primero</strong>
            <small>La zona privada se bloquea al salir.</small>
          </span>
        </div>
      </section>
    </main>
  )
}

export function AuthPage() {
  return <AccessCodePanel />
}

export function LinkAccountPage() {
  const session = useAppStore((state) => state.session)
  const [consent, setConsent] = useState(false)
  const [invite, setInvite] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const navigate = useNavigate()
  const create = async () => {
    if (!supabase || !session || !consent) return
    const { data, error } = await supabase.functions.invoke('create-relationship')
    if (error) {
      setResult(error.message)
      return
    }
    const relationshipId = data.relationshipId as string
    useAppStore.getState().setSession({ ...session, relationshipId })
    navigate('/desbloquear')
  }
  const openInvite = () => {
    try {
      const url = new URL(invite)
      if (url.origin !== location.origin || !url.pathname.includes('/aceptar-invitacion/')) throw new Error()
      const base = import.meta.env.BASE_URL.replace(/\/$/, '')
      const path =
        base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) || '/' : url.pathname
      navigate(`${path}${url.hash}`)
    } catch {
      setResult('Pega el enlace completo que te envió la otra persona.')
    }
  }
  return (
    <main className="page-main narrow">
      <header className="page-heading">
        <div>
          <p className="eyebrow">VINCULACIÓN PRIVADA</p>
          <h1>Crear un capítulo de dos</h1>
          <p>
            La relación se cierra al llegar a dos miembros y ambos tienen exactamente los mismos permisos.
          </p>
        </div>
      </header>
      <section className="settings-card">
        <h2>Comenzar Nuestra Historia</h2>
        <label className="check-row">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>Acepto voluntariamente crear este espacio privado compartido.</span>
        </label>
        <button className="primary-button" disabled={!consent || !supabase} onClick={() => void create()}>
          Crear relación privada
        </button>
        <div className="divider">
          <span>o</span>
        </div>
        <Field label="Ya recibí una invitación">
          <input
            value={invite}
            onChange={(event) => setInvite(event.target.value)}
            placeholder="Pega el enlace completo"
          />
        </Field>
        <button className="secondary-button" disabled={!invite} onClick={openInvite}>
          Abrir invitación
        </button>
        {result && <Notice kind="error">{result}</Notice>}
      </section>
    </main>
  )
}

export function AcceptInvitationPage() {
  const { token = '' } = useParams()
  const session = useAppStore((state) => state.session)
  const setSession = useAppStore((state) => state.setSession)
  const setPrivateLocked = useAppStore((state) => state.setPrivateLocked)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState('')
  const navigate = useNavigate()
  const invitationLocation = useLocation()
  const secret = new URLSearchParams(location.hash.slice(1)).get('s') ?? ''
  const accept = async () => {
    if (!supabase || !session || !secret || pin.length < 6 || pin !== confirmPin || !consent) return
    setBusy(true)
    setError('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('accept-invite', {
        body: { token, consent: true },
      })
      if (invokeError) throw invokeError
      const relationshipId = data.relationshipId as string
      const created = await importPairingEnvelope(secret, data.pairingEnvelope, relationshipId, pin)
      await putVault(created.record)
      activatePrivateSession(created.masterKey, relationshipId, session.userId)
      setSession({ ...session, relationshipId })
      setRecovery(created.recoveryCode)
    } catch {
      setError('La invitación venció, ya fue usada o no coincide con su llave.')
    } finally {
      setBusy(false)
    }
  }
  if (!session)
    return (
      <main className="page-main narrow">
        <Notice kind="warning">
          Inicia sesión o crea tu cuenta autorizada antes de aceptar la invitación.
        </Notice>
        <Link
          className="primary-button inline"
          to="/acceso"
          state={{ returnTo: `${invitationLocation.pathname}${invitationLocation.hash}` }}
        >
          Ir al acceso
        </Link>
      </main>
    )
  return (
    <main className="page-main narrow">
      <header className="page-heading">
        <div>
          <p className="eyebrow">INVITACIÓN DE UN SOLO USO</p>
          <h1>Aceptar Nuestra Historia</h1>
          <p>La llave incluida en el fragmento del enlace nunca se envía a Supabase.</p>
        </div>
      </header>
      <section className="settings-card">
        <Field label="Crear PIN o frase local">
          <input type="password" value={pin} onChange={(event) => setPin(event.target.value)} />
        </Field>
        <Field label="Repetir PIN o frase">
          <input type="password" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value)} />
        </Field>
        <label className="check-row">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>
            Acepto voluntariamente vincular esta cuenta y entiendo que la relación admite máximo dos miembros.
          </span>
        </label>
        {error && <Notice kind="error">{error}</Notice>}
        <button
          className="primary-button"
          disabled={busy || !secret || pin.length < 6 || pin !== confirmPin || !consent}
          onClick={() => void accept()}
        >
          {busy ? 'Aceptando…' : 'Aceptar y guardar llave'}
        </button>
      </section>
      {recovery && (
        <Modal title="Tu código de recuperación" onClose={() => undefined}>
          <div className="recovery-box">
            <p>Guárdalo ahora; se muestra una sola vez.</p>
            <code>{recovery}</code>
            <button
              className="primary-button"
              onClick={() => {
                setPrivateLocked(false)
                navigate('/historia')
              }}
            >
              Ya lo guardé
            </button>
          </div>
        </Modal>
      )}
    </main>
  )
}

export function PrivacyPage() {
  return (
    <main className="page-main narrow prose-page">
      <p className="eyebrow">PRIVACIDAD</p>
      <h1>Dos espacios, una sola decisión tuya</h1>
      <p>
        La biblioteca pública se guarda en este dispositivo. Nuestra Historia requiere autenticación, PIN
        local y una relación privada de máximo dos miembros.
      </p>
      <h2>Lo que la aplicación no hace</h2>
      <ul>
        <li>No rastrea ubicación, contactos ni actividad de otras aplicaciones.</li>
        <li>No penaliza el silencio ni genera alertas por ausencia.</li>
        <li>No muestra contenido romántico en las notificaciones.</li>
        <li>No envía analítica a terceros por defecto.</li>
      </ul>
      <h2>Cifrado</h2>
      <p>
        El contenido privado se cifra en el dispositivo con AES-GCM y claves derivadas mediante HKDF. Supabase
        recibe únicamente ciphertext y metadatos mínimos. El PIN envuelve una clave local; nunca se guarda
        como texto.
      </p>
      <Link className="primary-button inline" to="/instalar">
        Guía de instalación
      </Link>
    </main>
  )
}

export function OfflinePage() {
  return (
    <main className="center-page">
      <WifiOff size={42} />
      <h1>Estás entre páginas</h1>
      <p>
        No hay conexión. Tu biblioteca local sigue disponible y los cambios privados cifrados se sincronizarán
        al volver.
      </p>
      <Link className="primary-button inline" to="/biblioteca">
        Abrir biblioteca
      </Link>
    </main>
  )
}

export function NotFoundPage() {
  const location = useLocation()
  return (
    <main className="center-page">
      <span className="error-number">404</span>
      <h1>Esta página no está en el índice</h1>
      <p>
        No encontramos <code>{location.pathname}</code>.
      </p>
      <Link className="primary-button inline" to="/">
        Volver al inicio
      </Link>
    </main>
  )
}

export function ErrorPage() {
  return (
    <main className="center-page">
      <ShieldCheck size={42} />
      <h1>No pudimos abrir esta página</h1>
      <p>El contenido sensible permaneció protegido. Vuelve a intentarlo desde la biblioteca.</p>
      <Link className="primary-button inline" to="/">
        Ir a la biblioteca
      </Link>
    </main>
  )
}
