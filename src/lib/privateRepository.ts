import type { RealtimeChannel } from '@supabase/supabase-js'
import { decryptContent, encryptContent } from './crypto'
import { deleteOutbox, getPrivateCache, getReadyOutbox, putOutbox, putPrivateCache } from './storage'
import { supabase } from './supabase'
import type { CryptoContext, EncryptedRow, OutboxItem, PrivateItem, PrivateTable } from '../types'

let activeMasterKey: CryptoKey | null = null
let activeRelationshipId: string | null = null
let activeUserId: string | null = null

export function activatePrivateSession(masterKey: CryptoKey, relationshipId: string, userId: string) {
  activeMasterKey = masterKey
  activeRelationshipId = relationshipId
  activeUserId = userId
}

export function clearPrivateSession() {
  activeMasterKey = null
  activeRelationshipId = null
  activeUserId = null
}

export function getPrivateSession() {
  if (!activeMasterKey || !activeRelationshipId || !activeUserId) throw new Error('La bóveda está bloqueada.')
  return { masterKey: activeMasterKey, relationshipId: activeRelationshipId, userId: activeUserId }
}

function contextFor(row: EncryptedRow): CryptoContext {
  return {
    relationshipId: row.relationship_id,
    messageId: row.id,
    senderId: row.sender_id,
    version: row.crypto_version,
    logicalTimestamp: row.logical_timestamp,
    contentType: row.content_type,
  }
}

export async function decryptRow<T>(
  table: PrivateTable,
  row: EncryptedRow,
  pending = false,
): Promise<PrivateItem<T>> {
  const { masterKey } = getPrivateSession()
  const content = await decryptContent<T>(
    masterKey,
    { ciphertext: row.ciphertext, iv: row.iv, cryptoVersion: 1 },
    contextFor(row),
  )
  return { id: row.id, table, senderId: row.sender_id, createdAt: row.created_at, content, pending }
}

export async function createPrivateItem<T>(
  table: PrivateTable,
  contentType: string,
  content: T,
  metadata?: { scheduledAt?: string },
) {
  const { masterKey, relationshipId, userId } = getPrivateSession()
  const id = crypto.randomUUID()
  const logicalTimestamp = new Date().toISOString()
  const context: CryptoContext = {
    relationshipId,
    messageId: id,
    senderId: userId,
    version: 1,
    logicalTimestamp,
    contentType,
  }
  const envelope = await encryptContent(masterKey, content, context)
  const row: EncryptedRow = {
    id,
    relationship_id: relationshipId,
    sender_id: userId,
    ciphertext: envelope.ciphertext,
    iv: envelope.iv,
    crypto_version: envelope.cryptoVersion,
    content_type: contentType,
    logical_timestamp: logicalTimestamp,
    created_at: logicalTimestamp,
    ...(metadata?.scheduledAt ? { scheduled_at: metadata.scheduledAt } : {}),
  }
  const queueItem: OutboxItem = { id, table, row, attempts: 0, nextAttemptAt: Date.now() }

  await putPrivateCache({ ...queueItem, cachedAt: Date.now() })
  if (supabase && navigator.onLine && !relationshipId.startsWith('local-')) {
    const { error } = await supabase.from(table).insert(row)
    if (error) await putOutbox(queueItem)
  } else {
    await putOutbox(queueItem)
  }
  return decryptRow<T>(table, row, !supabase || !navigator.onLine)
}

export async function listPrivateItems<T>(table: PrivateTable): Promise<PrivateItem<T>[]> {
  const { relationshipId } = getPrivateSession()
  let rows: EncryptedRow[] = []
  if (supabase && navigator.onLine && !relationshipId.startsWith('local-')) {
    const { data } = await supabase
      .from(table)
      .select(
        'id,relationship_id,sender_id,ciphertext,iv,crypto_version,content_type,logical_timestamp,created_at',
      )
      .eq('relationship_id', relationshipId)
      .order('created_at', { ascending: true })
      .limit(200)
    rows = (data ?? []) as EncryptedRow[]
    await Promise.all(
      rows.map((row) =>
        putPrivateCache({ id: row.id, table, row, attempts: 0, nextAttemptAt: 0, cachedAt: Date.now() }),
      ),
    )
  }
  const cached = await getPrivateCache(table)
  const combined = new Map<string, { row: EncryptedRow; pending: boolean }>()
  cached
    .filter((item) => item.row.relationship_id === relationshipId)
    .forEach((item) => combined.set(item.id, { row: item.row, pending: item.nextAttemptAt > 0 }))
  rows.forEach((row) => combined.set(row.id, { row, pending: false }))
  const results = await Promise.all(
    [...combined.values()].map(({ row, pending }) => decryptRow<T>(table, row, pending)),
  )
  return results.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function flushOutbox() {
  const client = supabase
  if (!client || !navigator.onLine) return
  const ready = await getReadyOutbox()
  await Promise.all(
    ready.map(async (item) => {
      const { error } = await client
        .from(item.table)
        .upsert(item.row, { onConflict: 'id', ignoreDuplicates: true })
      if (!error) {
        await deleteOutbox(item.id)
        return
      }
      const attempts = item.attempts + 1
      await putOutbox({
        ...item,
        attempts,
        nextAttemptAt: Date.now() + Math.min(60_000, 2 ** attempts * 1000),
      })
    }),
  )
}

export function subscribeToTable<T>(table: PrivateTable, onItem: (item: PrivateItem<T>) => void) {
  const client = supabase
  if (!client || !activeRelationshipId || activeRelationshipId.startsWith('local-')) return () => undefined
  const channel = client
    .channel(`${table}:${activeRelationshipId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table, filter: `relationship_id=eq.${activeRelationshipId}` },
      async (payload) => {
        try {
          onItem(await decryptRow<T>(table, payload.new as EncryptedRow))
        } catch {
          /* Invalid ciphertext stays invisible. */
        }
      },
    )
    .subscribe()
  return () => {
    void client.removeChannel(channel)
  }
}

export function createPresenceChannel(
  onSync: (state: Record<string, unknown[]>) => void,
): RealtimeChannel | null {
  if (!supabase || !activeRelationshipId || !activeUserId || activeRelationshipId.startsWith('local-'))
    return null
  const channel = supabase.channel(`presence:${activeRelationshipId}`, {
    config: { presence: { key: activeUserId } },
  })
  channel.on('presence', { event: 'sync' }, () => onSync(channel.presenceState()))
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await channel.track({ state: 'online', at: new Date().toISOString() })
  })
  return channel
}

export function createTypingChannel(onTyping: (typing: boolean) => void) {
  const client = supabase
  if (!client || !activeRelationshipId || !activeUserId || activeRelationshipId.startsWith('local-'))
    return null
  const ownUserId = activeUserId
  const channel = client
    .channel(`typing:${activeRelationshipId}`)
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.userId !== ownUserId) onTyping(Boolean(payload.typing))
    })
    .subscribe()
  return {
    send(typing: boolean) {
      return channel.send({ type: 'broadcast', event: 'typing', payload: { userId: ownUserId, typing } })
    },
    close() {
      return client.removeChannel(channel)
    },
  }
}
