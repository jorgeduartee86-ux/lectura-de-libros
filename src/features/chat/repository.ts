import { decryptContent, encryptContent } from '../../lib/crypto'
import { contextFor, getPrivateSession } from '../../lib/privateRepository'
import { getPrivateCache, getSetting, putPrivateCache, putSetting } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import type { CryptoEnvelope } from '../../types'
import type { ChatContent } from './model'
export interface Draft {
  text: string
  replyTo?: string
  replyPreview?: string
  replySource?: 'cartas' | 'marcapaginas'
  attachments?: import('../../lib/media/types').MediaRef[]
  sendWhenReady?: boolean
}
export async function draftToolReply(source: 'cartas' | 'marcapaginas', id: string, preview: string) {
  const draft = await loadDraft()
  await saveDraft({ ...draft, replyTo: id, replyPreview: preview.slice(0, 180), replySource: source })
}
function draftContext(logicalTimestamp: string) {
  const { relationshipId, userId } = getPrivateSession()
  return {
    relationshipId,
    senderId: userId,
    messageId: `draft:${userId}`,
    logicalTimestamp,
    version: 1,
    contentType: 'chat-draft-v1',
  }
}
let draftWrite: Promise<void> = Promise.resolve()
export function saveDraft(draft: Draft) {
  const session = getPrivateSession(),
    logicalTimestamp = new Date().toISOString()
  const context = draftContext(logicalTimestamp)
  draftWrite = draftWrite
    .catch(() => {})
    .then(async () => {
      const envelope = await encryptContent(session.masterKey, draft, context)
      await putSetting(`chat-draft:${session.relationshipId}:${session.userId}`, {
        envelope,
        logicalTimestamp,
      })
    })
  return draftWrite
}
export async function loadDraft(): Promise<Draft> {
  const session = getPrivateSession()
  const saved = await getSetting<{ envelope: CryptoEnvelope; logicalTimestamp: string }>(
    `chat-draft:${session.relationshipId}:${session.userId}`,
  )
  return saved
    ? decryptContent<Draft>(session.masterKey, saved.envelope, draftContext(saved.logicalTimestamp))
    : { text: '' }
}
export async function editMessage(id: string, content: ChatContent) {
  if (!supabase || !navigator.onLine) throw new Error('Conéctate para editar. Tu texto sigue en el editor.')
  const { masterKey, userId } = getPrivateSession()
  const cached = (await getPrivateCache('messages')).find((item) => item.id === id)
  if (!cached || cached.row.sender_id !== userId || cached.row.deleted_at)
    throw new Error('No puedes editar este mensaje.')
  const envelope = await encryptContent(masterKey, content, contextFor(cached.row))
  const { error } = await supabase
    .from('messages')
    .update({ ciphertext: envelope.ciphertext, iv: envelope.iv, edited_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
  if (error) throw error
  await putPrivateCache({
    ...cached,
    row: { ...cached.row, ciphertext: envelope.ciphertext, iv: envelope.iv },
  })
}
export async function scheduleMessage(content: ChatContent, when: string) {
  if (!supabase || !navigator.onLine) throw new Error('Necesitas conexión para programar el mensaje.')
  const { masterKey, relationshipId, userId } = getPrivateSession()
  const id = crypto.randomUUID(),
    logicalTimestamp = new Date().toISOString()
  const envelope = await encryptContent(masterKey, content, {
    messageId: id,
    relationshipId,
    senderId: userId,
    logicalTimestamp,
    version: 1,
    contentType: 'message',
  })
  const { error } = await supabase
    .from('scheduled_messages')
    .insert({
      id,
      relationship_id: relationshipId,
      sender_id: userId,
      ciphertext: envelope.ciphertext,
      iv: envelope.iv,
      crypto_version: 1,
      content_type: 'message',
      logical_timestamp: logicalTimestamp,
      scheduled_at: when,
    })
  if (error) throw new Error('No se pudo programar. El texto sigue guardado.')
}
export interface Reaction {
  id: string
  messageId: string
  userId: string
  emoji: string
}
export async function listReactions(): Promise<Reaction[]> {
  if (!supabase) return []
  const { masterKey, relationshipId } = getPrivateSession()
  if (relationshipId.startsWith('local-')) return []
  const { data, error } = await supabase
    .from('message_reactions')
    .select('*')
    .eq('relationship_id', relationshipId)
    .limit(1000)
  if (error) return []
  const result = await Promise.allSettled(
    (data ?? []).map(async (row) => ({
      id: row.id,
      messageId: row.message_id,
      userId: row.sender_id,
      emoji: (
        await decryptContent<{ emoji: string }>(
          masterKey,
          { ciphertext: row.ciphertext, iv: row.iv, cryptoVersion: 1 },
          {
            messageId: row.id,
            relationshipId,
            senderId: row.sender_id,
            logicalTimestamp: row.logical_timestamp,
            version: 1,
            contentType: 'message-reaction-v1',
          },
        )
      ).emoji,
    })),
  )
  return result
    .filter((r): r is PromiseFulfilledResult<Reaction> => r.status === 'fulfilled')
    .map((r) => r.value)
}
export async function reactToMessage(messageId: string, emoji: string) {
  if (!supabase || !navigator.onLine) throw new Error('Conéctate para reaccionar.')
  const { masterKey, relationshipId, userId } = getPrivateSession()
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('sender_id', userId)
    .maybeSingle()
  const id = existing?.id ?? crypto.randomUUID(),
    logicalTimestamp = new Date().toISOString()
  const envelope = await encryptContent(
    masterKey,
    { emoji },
    {
      messageId: id,
      relationshipId,
      senderId: userId,
      logicalTimestamp,
      version: 1,
      contentType: 'message-reaction-v1',
    },
  )
  const { error } = await supabase
    .from('message_reactions')
    .upsert(
      {
        id,
        message_id: messageId,
        relationship_id: relationshipId,
        sender_id: userId,
        ciphertext: envelope.ciphertext,
        iv: envelope.iv,
        crypto_version: 1,
        logical_timestamp: logicalTimestamp,
      },
      { onConflict: 'message_id,sender_id' },
    )
  if (error) throw error
}
export async function toggleStar(id: string, starred: boolean) {
  if (!supabase) return
  const { relationshipId, userId } = getPrivateSession()
  const result = starred
    ? await supabase.from('starred_messages').delete().eq('message_id', id).eq('user_id', userId)
    : await supabase
        .from('starred_messages')
        .upsert(
          { message_id: id, relationship_id: relationshipId, user_id: userId },
          { onConflict: 'message_id,user_id' },
        )
  if (result.error) throw result.error
}
