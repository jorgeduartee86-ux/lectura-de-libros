import { X } from 'lucide-react'
import type { PropsWithChildren, ReactNode } from 'react'
import type { Book } from '../types'

export function BookCover({ book, compact = false }: { book: Book; compact?: boolean }) {
  return (
    <div
      className={`book-cover cover-${book.color} ${compact ? 'compact' : ''}`}
      aria-label={`Portada de ${book.title}`}
    >
      <small>{book.author}</small>
      <strong>{book.title}</strong>
      <span>{book.genre}</span>
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
}: PropsWithChildren<{ title: string; onClose: () => void }>) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header>
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: PropsWithChildren<{ label: string; hint?: string; error?: string }>) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="page-loader" role="status">
      <span />
      <p>Abriendo páginas…</p>
    </div>
  )
}

export function Notice({
  kind = 'info',
  children,
}: PropsWithChildren<{ kind?: 'info' | 'success' | 'warning' | 'error' }>) {
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
