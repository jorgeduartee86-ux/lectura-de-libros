import type { PrivateItem } from '../../types'
import type { MediaRef } from '../../lib/media/types'
export interface ChatContent extends Record<string, unknown> {
  text: string
  replyTo?: string
  replyPreview?: string
  replySource?: string
  attachments?: MediaRef[]
  sticker?: string
  event?: 'edit' | 'delete-self' | 'delete-request' | 'reaction' | 'motto'
  targetId?: string
  reaction?: string
}
export type ChatMessage = PrivateItem<ChatContent> & { edited?: boolean; legacyReactions?: number }
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
export function reconcileMessages(items: PrivateItem<ChatContent>[], userId: string): ChatMessage[] {
  const sorted = [...new Map(items.map((item) => [item.id, item])).values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )
  const events = sorted.filter((item) => item.content.event && item.content.targetId)
  const hidden = new Set(
    events
      .filter((item) => item.content.event === 'delete-self' && item.senderId === userId)
      .map((item) => item.content.targetId),
  )
  return sorted
    .filter((item) => !item.content.event && !hidden.has(item.id))
    .map((item) => {
      const edit = events
        .filter(
          (event) =>
            event.content.event === 'edit' &&
            event.content.targetId === item.id &&
            event.senderId === item.senderId,
        )
        .at(-1)
      return {
        ...item,
        content: edit ? { ...item.content, text: edit.content.text } : item.content,
        edited: !!edit,
        legacyReactions: events.filter(
          (event) => event.content.event === 'reaction' && event.content.targetId === item.id,
        ).length,
      }
    })
}
export function previewMessage(message: ChatMessage) {
  return message.deleted
    ? 'Mensaje eliminado'
    : message.content.text ||
        (message.content.sticker
          ? 'Sticker'
          : message.content.attachments
              ?.map((a) => (a.kind === 'audio' ? 'Nota de voz' : a.name))
              .join(', ')) ||
        'Mensaje'
}
export function canMarkRead(visible: boolean, focused: boolean, inViewport: boolean, mine: boolean) {
  return visible && focused && inViewport && !mine
}
export function filterMessages(
  messages: ChatMessage[],
  filter: { query: string; kind: string; sender: string; date: string; starsOnly: boolean },
  userId: string,
  stars: Set<string>,
) {
  const query = filter.query.toLocaleLowerCase()
  return messages.filter((message) => {
    const content = message.content
    return (
      (!query ||
        [content.text, ...(content.attachments?.map((a) => a.name) ?? [])]
          .join(' ')
          .toLocaleLowerCase()
          .includes(query)) &&
      (!filter.starsOnly || stars.has(message.id)) &&
      (!filter.date || message.createdAt.slice(0, 10) === filter.date) &&
      (!filter.sender ||
        (filter.sender === 'me' ? message.senderId === userId : message.senderId !== userId)) &&
      (!filter.kind ||
        (filter.kind === 'text'
          ? !!content.text
          : filter.kind === 'links'
            ? /https?:\/\//.test(content.text)
            : filter.kind === 'sticker'
              ? !!content.sticker || content.attachments?.some((a) => a.kind === 'sticker')
              : content.attachments?.some((a) => a.kind === filter.kind)))
    )
  })
}
