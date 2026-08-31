import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Book, OutboxItem, PrivateCacheItem, VaultRecord } from '../types'

interface AppDatabase extends DBSchema {
  books: { key: string; value: Book; indexes: { 'by-status': Book['status'] } }
  settings: { key: string; value: { key: string; value: unknown } }
  vaults: { key: string; value: VaultRecord }
  outbox: { key: string; value: OutboxItem; indexes: { 'by-next-attempt': number } }
  privateCache: { key: string; value: PrivateCacheItem; indexes: { 'by-table': string } }
}

let databasePromise: Promise<IDBPDatabase<AppDatabase>> | undefined

export function getDatabase() {
  databasePromise ??= openDB<AppDatabase>('lectura-de-libros', 1, {
    upgrade(database) {
      const books = database.createObjectStore('books', { keyPath: 'id' })
      books.createIndex('by-status', 'status')
      database.createObjectStore('settings', { keyPath: 'key' })
      database.createObjectStore('vaults', { keyPath: 'id' })
      const outbox = database.createObjectStore('outbox', { keyPath: 'id' })
      outbox.createIndex('by-next-attempt', 'nextAttemptAt')
      const cache = database.createObjectStore('privateCache', { keyPath: 'id' })
      cache.createIndex('by-table', 'table')
    },
  })
  return databasePromise
}

export async function getBooks() {
  return (await getDatabase()).getAll('books')
}

export async function putBook(book: Book) {
  await (await getDatabase()).put('books', book)
}

export async function deleteBook(id: string) {
  await (await getDatabase()).delete('books', id)
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const result = await (await getDatabase()).get('settings', key)
  return result?.value as T | undefined
}

export async function putSetting(key: string, value: unknown) {
  await (await getDatabase()).put('settings', { key, value })
}

export async function deleteSetting(key: string) {
  await (await getDatabase()).delete('settings', key)
}

export async function getVault(relationshipId: string) {
  return (await getDatabase()).get('vaults', relationshipId)
}

export async function putVault(vault: VaultRecord) {
  await (await getDatabase()).put('vaults', vault)
}

export async function deleteVault(relationshipId: string) {
  await (await getDatabase()).delete('vaults', relationshipId)
}

export async function listVaults() {
  return (await getDatabase()).getAll('vaults')
}

export async function putOutbox(item: OutboxItem) {
  await (await getDatabase()).put('outbox', item)
}

export async function deleteOutbox(id: string) {
  await (await getDatabase()).delete('outbox', id)
}

export async function getReadyOutbox(now = Date.now()) {
  return (await getDatabase()).getAllFromIndex('outbox', 'by-next-attempt', IDBKeyRange.upperBound(now))
}

export async function putPrivateCache(item: PrivateCacheItem) {
  await (await getDatabase()).put('privateCache', item)
}

export async function getPrivateCache(table: string) {
  return (await getDatabase()).getAllFromIndex('privateCache', 'by-table', table)
}

export async function clearSensitiveCache() {
  await (await getDatabase()).clear('privateCache')
}

export const indexedDbAuthStorage = {
  async getItem(key: string) {
    return (await getSetting<string>(`auth:${key}`)) ?? null
  },
  async setItem(key: string, value: string) {
    await putSetting(`auth:${key}`, value)
  },
  async removeItem(key: string) {
    await deleteSetting(`auth:${key}`)
  },
}
