import type { RealtimeChannel } from '@supabase/supabase-js'
import { softFeedback } from './feedback'
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

export function contextFor(row: EncryptedRow): CryptoContext {
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
  if (row.deleted_at)
    return {
      id: row.id,
      table,
      senderId: row.sender_id,
      createdAt: row.created_at,
      content: { text: '' } as T,
      deleted: true,
    }
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
  metadata?: { scheduledAt?: string; id?: string; attachmentIds?: string[] },
) {
  const { masterKey, relationshipId, userId } = getPrivateSession()
  const id = metadata?.id ?? crypto.randomUUID()
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
    ...(metadata?.attachmentIds?.length ? { attachment_ids: metadata.attachmentIds } : {}),
  }
  const queueItem: OutboxItem = { id, table, row, attempts: 0, nextAttemptAt: Date.now() }
  let pending = !supabase || !navigator.onLine || relationshipId.startsWith('local-')

  await putPrivateCache({ ...queueItem, cachedAt: Date.now() })
  await putOutbox(queueItem)
  if (supabase && navigator.onLine && !relationshipId.startsWith('local-')) {
    const { error } = await supabase.from(table).insert(row)
    if (error) {
      pending = true
      await putOutbox(queueItem)
    } else {
      await deleteOutbox(id)
      await putPrivateCache({ ...queueItem, nextAttemptAt: 0, cachedAt: Date.now() })
      if (table === 'messages' && !contentType.startsWith('message-'))
        void supabase.functions.invoke('send-push', {
          body: { relationshipId, messageId: id, notificationKind: 2 },
        })
    }
  }
  if (['messages', 'signals', 'letters'].includes(table) && !contentType.startsWith('message-'))
    void softFeedback(userId).catch(() => {})
  return decryptRow<T>(table, row, pending)
}

export async function listPrivateItems<T>(table: PrivateTable, limit = 200): Promise<PrivateItem<T>[]> {
  const { relationshipId } = getPrivateSession()
  let rows: EncryptedRow[] = []
  if (supabase && navigator.onLine && !relationshipId.startsWith('local-')) {
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('relationship_id', relationshipId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit)
    rows = (data ?? []) as EncryptedRow[]
    await Promise.all(
      rows.map((row) =>
        putPrivateCache({ id: row.id, table, row, attempts: 0, nextAttemptAt: 0, cachedAt: Date.now() }),
      ),
    )
  }
  // The outbox survives cache cleanup and must remain visible while offline.
  const cached = [
    ...(await getPrivateCache(table)),
    ...(await getReadyOutbox(Number.MAX_SAFE_INTEGER).then((items) =>
      items.filter((item) => item.table === table),
    )),
  ]
  const combined = new Map<string, { row: EncryptedRow; pending: boolean; failed?: boolean }>()
  cached
    .filter((item) => item.row.relationship_id === relationshipId)
    .forEach((item) =>
      combined.set(item.id, { row: item.row, pending: item.nextAttemptAt > 0, failed: item.attempts >= 3 }),
    )
  rows.forEach((row) => combined.set(row.id, { row, pending: false }))
  const results = await Promise.allSettled(
    [...combined.values()].map(async ({ row, pending, failed }): Promise<PrivateItem<T>> => ({
      ...(await decryptRow<T>(table, row, pending)),
      failed,
    })),
  )
  return results
    .filter((result): result is PromiseFulfilledResult<PrivateItem<T>> => result.status === 'fulfilled')
    .map((result) => result.value)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

let flushing = false
export async function flushOutbox(force = false) {
  const client = supabase
  if (!client || !navigator.onLine || flushing) return
  flushing = true
  try {
    const { data: auth } = await client.auth.getSession()
    const userId = auth.session?.user.id
    if (!userId) return
    const ready = await getReadyOutbox(force ? Number.MAX_SAFE_INTEGER : Date.now())
    await Promise.all(
      ready
        .filter((item) => item.row.sender_id === userId && !item.row.relationship_id.startsWith('local-'))
        .map(async (item) => {
          const { error } = await client
            .from(item.table)
            .upsert(item.row, { onConflict: 'id', ignoreDuplicates: true })
          if (!error) {
            await deleteOutbox(item.id)
            await putPrivateCache({ ...item, nextAttemptAt: 0, cachedAt: Date.now() })
            if (item.table === 'messages' && !item.row.content_type.startsWith('message-'))
              void client.functions.invoke('send-push', {
                body: { relationshipId: item.row.relationship_id, messageId: item.id, notificationKind: 2 },
              })
            window.dispatchEvent(new CustomEvent('private-sync'))
            return
          }
          const attempts = item.attempts + 1
          const queued = {
            ...item,
            attempts,
            nextAttemptAt: Date.now() + Math.min(60_000, 2 ** attempts * 1000),
          }
          await putOutbox(queued)
          await putPrivateCache({ ...queued, cachedAt: Date.now() })
        }),
    )
  } finally {
    flushing = false
  }
}

export function subscribeToTable<T>(table: PrivateTable, onItem: (item: PrivateItem<T>) => void) {
  const client = supabase
  if (!client || !activeRelationshipId || activeRelationshipId.startsWith('local-')) return () => undefined
  const channel = client
    .channel(`${table}:${activeRelationshipId}:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `relationship_id=eq.${activeRelationshipId}` },
      async (payload) => {
        try {
          const row = payload.new as EncryptedRow
          if (!row.id) return
          if (
            payload.eventType === 'INSERT' &&
            row.sender_id !== activeUserId &&
            activeUserId &&
            ['messages', 'signals', 'letters'].includes(table) &&
            !row.content_type.startsWith('message-')
          )
            void softFeedback(activeUserId, true).catch(() => {})
          await putPrivateCache({
            id: row.id,
            table,
            row,
            attempts: 0,
            nextAttemptAt: 0,
            cachedAt: Date.now(),
          })
          onItem(await decryptRow<T>(table, row))
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
