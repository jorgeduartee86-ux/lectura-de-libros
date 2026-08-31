import { BookOpen, Heart, Home, Library, Menu, Moon, Search, Sun, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/app'
import { PwaUpdate } from './PwaUpdate'

export function Brand() {
  return (
    <NavLink className="brand" to="/" aria-label="Lectura de libros, inicio">
      <span className="mark" aria-hidden="true">
        <BookOpen size={18} strokeWidth={1.7} />
      </span>
      <span>
        <strong>Lectura</strong>
        <small>de libros</small>
      </span>
    </NavLink>
  )
}

export function PublicShell() {
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const online = useAppStore((state) => state.online)
  const books = useAppStore((state) => state.books)
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('#global-search')?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    if (query.trim().toLocaleLowerCase() === 'margen') {
      setQuery('')
      navigate('/desbloquear')
      return
    }
    navigate(`/buscar?q=${encodeURIComponent(query.trim())}`)
  }

  const matches =
    query.trim().length > 1
      ? books
          .filter((book) =>
            `${book.title} ${book.author} ${book.genre}`.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 3)
      : []

  return (
    <div className="app-frame">
      {!online && <div className="offline-banner">Sin conexión · Los cambios quedarán pendientes</div>}
      <header className="topbar">
        <Brand />
        <nav className="desktop-nav" aria-label="Navegación principal">
          <NavLink to="/" end>
            Inicio
          </NavLink>
          <NavLink to="/biblioteca">Biblioteca</NavLink>
          <NavLink to="/citas">Citas</NavLink>
          <NavLink to="/autores">Autores</NavLink>
        </nav>
        <div className="top-actions">
          <button
            className="icon-button"
            aria-label="Cambiar tema"
            onClick={() => void setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <NavLink className="profile-button" to="/acceso" aria-label="Abrir acceso">
            <UserRound size={17} />
          </NavLink>
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>
      {mobileOpen && (
        <nav className="mobile-drawer" aria-label="Menú móvil">
          <NavLink onClick={() => setMobileOpen(false)} to="/biblioteca">
            Biblioteca
          </NavLink>
          <NavLink onClick={() => setMobileOpen(false)} to="/citas">
            Citas favoritas
          </NavLink>
          <NavLink onClick={() => setMobileOpen(false)} to="/instalar">
            Instalar aplicación
          </NavLink>
          <NavLink onClick={() => setMobileOpen(false)} to="/privacidad">
            Privacidad
          </NavLink>
        </nav>
      )}
      <div className="global-search-wrap">
        <form className="search-box global" onSubmit={submitSearch} role="search">
          <Search size={19} aria-hidden="true" />
          <label className="sr-only" htmlFor="global-search">
            Buscar un libro, autor o género
          </label>
          <input
            id="global-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar un libro, autor o género…"
            autoComplete="off"
          />
          <kbd>Ctrl K</kbd>
        </form>
        {matches.length > 0 && (
          <div className="search-popover">
            {matches.map((book) => (
              <button
                key={book.id}
                onClick={() => {
                  setQuery('')
                  navigate(`/libro/${book.id}`)
                }}
              >
                <span>{book.title}</span>
                <small>{book.author}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      <Outlet />
      <nav className="bottom-nav" aria-label="Navegación móvil">
        <NavLink to="/" end>
          <Home />
          <span>Inicio</span>
        </NavLink>
        <NavLink to="/biblioteca">
          <Library />
          <span>Biblioteca</span>
        </NavLink>
        <NavLink to="/buscar">
          <Search />
          <span>Buscar</span>
        </NavLink>
        <NavLink to="/citas">
          <Heart />
          <span>Citas</span>
        </NavLink>
      </nav>
      <footer className="public-footer">
        <Brand />
        <p>Una biblioteca personal. Un refugio entre páginas.</p>
        <nav>
          <NavLink to="/instalar">Instalar</NavLink>
          <NavLink to="/privacidad">Privacidad</NavLink>
          <NavLink to="/acceso">Acceso</NavLink>
        </nav>
      </footer>
      <PwaUpdate />
    </div>
  )
}
