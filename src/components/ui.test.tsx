import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BookCover, EmptyState } from './ui'

describe('componentes de biblioteca', () => {
  it('presenta la portada con nombre accesible', () => {
    render(
      <BookCover
        book={{
          id: '1',
          title: 'Persuasión',
          author: 'Jane Austen',
          genre: 'Novela',
          status: 'pending',
          rating: 0,
          note: '',
          favoriteQuote: '',
          progress: 0,
          addedAt: '2026-01-01',
          color: 'plum',
        }}
      />,
    )
    expect(screen.getByLabelText('Portada de Persuasión')).toBeInTheDocument()
    expect(screen.getByText('Jane Austen')).toBeInTheDocument()
  })

  it('explica claramente un estado vacío', () => {
    render(<EmptyState title="Nada por aquí" text="Añade tu primer libro." />)
    expect(screen.getByRole('heading', { name: 'Nada por aquí' })).toBeInTheDocument()
    expect(screen.getByText('Añade tu primer libro.')).toBeInTheDocument()
  })
})
