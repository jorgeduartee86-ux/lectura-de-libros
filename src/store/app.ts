import { create } from 'zustand'
import { seedBooks } from '../data/seed'
import { getBooks, getSetting, putBook, putSetting } from '../lib/storage'
import type { AppSession, Book } from '../types'

type Theme = 'light' | 'dark'

interface AppState {
  books: Book[]
  loaded: boolean
  theme: Theme
  online: boolean
  session: AppSession | null
  privateLocked: boolean
  initialize: () => Promise<void>
  addBook: (book: Book) => Promise<void>
  updateBook: (book: Book) => Promise<void>
  setTheme: (theme: Theme) => Promise<void>
  setOnline: (online: boolean) => void
  setSession: (session: AppSession | null) => void
  setPrivateLocked: (locked: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  books: [],
  loaded: false,
  theme: 'light',
  online: navigator.onLine,
  session: null,
  privateLocked: true,
  async initialize() {
    let books = await getBooks()
    if (books.length === 0) {
      await Promise.all(seedBooks.map((book) => putBook(book)))
      books = seedBooks
    }
    const preferred = await getSetting<Theme>('theme')
    const theme = preferred ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.dataset.theme = theme
    set({ books, theme, loaded: true })
  },
  async addBook(book) {
    await putBook(book)
    set({ books: [...get().books, book] })
  },
  async updateBook(book) {
    await putBook(book)
    set({ books: get().books.map((item) => (item.id === book.id ? book : item)) })
  },
  async setTheme(theme) {
    document.documentElement.dataset.theme = theme
    await putSetting('theme', theme)
    set({ theme })
  },
  setOnline: (online) => set({ online }),
  setSession: (session) => set({ session }),
  setPrivateLocked: (privateLocked) => set({ privateLocked }),
}))
