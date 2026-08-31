export type ReadingStatus = 'pending' | 'reading' | 'finished'

export interface Book {
  id: string
  title: string
  author: string
  genre: string
  publishedYear?: number
  status: ReadingStatus
  rating: number
  note: string
  favoriteQuote: string
  progress: number
  addedAt: string
  color: 'plum' | 'blue' | 'ochre' | 'sage' | 'ink'
}

export interface CryptoContext {
  relationshipId: string
  messageId: string
  senderId: string
  version: number
  logicalTimestamp: string
  contentType: string
}

export interface CryptoEnvelope {
  ciphertext: string
  iv: string
  cryptoVersion: 1
}

export interface VaultRecord {
  id: string
  relationshipId: string
  pinSalt: string
  wrappedMasterKey: CryptoEnvelope
  recoveryWrappedMasterKey: CryptoEnvelope
  createdAt: string
  updatedAt: string
  keyVersion: number
}

export interface EncryptedRow {
  id: string
  relationship_id: string
  sender_id: string
  ciphertext: string
  iv: string
  crypto_version: number
  content_type: string
  logical_timestamp: string
  created_at: string
  scheduled_at?: string | null
  reminder_sent_at?: string | null
}

export interface OutboxItem {
  id: string
  table: PrivateTable
  row: EncryptedRow
  attempts: number
  nextAttemptAt: number
}

export interface PrivateCacheItem extends OutboxItem {
  cachedAt: number
}

export type PrivateTable =
  | 'messages'
  | 'signals'
  | 'letters'
  | 'daily_answers'
  | 'story_entries'
  | 'romantic_challenges'
  | 'virtual_dates'
  | 'memories'
  | 'gifts'

export interface PrivateItem<T = Record<string, unknown>> {
  id: string
  table: PrivateTable
  senderId: string
  createdAt: string
  content: T
  pending?: boolean
}

export interface AppSession {
  userId: string
  email: string
  relationshipId: string | null
}
