import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createPrivateItem,
  flushOutbox,
  getPrivateSession,
  listPrivateItems,
  subscribeToTable,
} from '../../lib/privateRepository'
import { supabase } from '../../lib/supabase'
import type { PrivateItem } from '../../types'
import { receipt, useChatActivity } from './activity'
import { reconcileMessages, type ChatContent } from './model'
import { listReactions, type Reaction } from './repository'

export function useActivityStream(active: boolean) {
  useEffect(() => {
    if (!active) return
    const refresh = () => {
      if (document.visibilityState === 'visible') void useChatActivity.getState().refresh()
    }
    refresh()
    const timer = setInterval(refresh, 15000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    const push = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_RECEIVED') refresh()
    }
    navigator.serviceWorker?.addEventListener('message', push)
    const relation = getPrivateSession().relationshipId
    const channel =
      supabase && !relation.startsWith('local-')
        ? supabase
            .channel(`unread:${relation}:${crypto.randomUUID()}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'messages', filter: `relationship_id=eq.${relation}` },
              refresh,
            )
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'message_receipts',
                filter: `relationship_id=eq.${relation}`,
              },
              refresh,
            )
            .subscribe()
        : null
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', refresh)
      navigator.serviceWorker?.removeEventListener('message', push)
      if (channel) void supabase?.removeChannel(channel)
    }
  }, [active])
}
export function useChat() {
  const [items, setItems] = useState<PrivateItem<ChatContent>[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('')
  const [limit, setLimit] = useState(150),
    [reactions, setReactions] = useState<Reaction[]>([]),
    [stars, setStars] = useState<Set<string>>(new Set())
  const [receipts, setReceipts] = useState<Record<string, 'delivered' | 'read'>>({}),
    [pinned, setPinned] = useState<string>()
  const { relationshipId, userId } = getPrivateSession()
  const sequence = useRef(0)
  const reload = useCallback(async () => {
    const request = ++sequence.current
    try {
      await flushOutbox()
      const messages = await listPrivateItems<ChatContent>('messages', limit)
      if (request !== sequence.current) return
      setItems((current) => [
        ...new Map(
          [...current.filter((i) => i.pending && !messages.some((m) => m.id === i.id)), ...messages].map(
            (m) => [m.id, m],
          ),
        ).values(),
      ])
      setError('')
      if (supabase && !relationshipId.startsWith('local-')) {
        const [reactionRows, starRows, receiptRows, pinRows] = await Promise.all([
          listReactions(),
          supabase
            .from('starred_messages')
            .select('message_id')
            .eq('user_id', userId)
            .eq('relationship_id', relationshipId),
          supabase
            .from('message_receipts')
            .select('message_id,status,user_id')
            .eq('relationship_id', relationshipId)
            .neq('user_id', userId)
            .order('occurred_at', { ascending: false })
            .limit(2000),
          supabase
            .from('pinned_messages')
            .select('message_id')
            .eq('relationship_id', relationshipId)
            .maybeSingle(),
        ])
        if (request !== sequence.current) return
        setReactions(reactionRows)
        if (!starRows.error) setStars(new Set((starRows.data ?? []).map((r) => r.message_id)))
        if (!pinRows.error) setPinned(pinRows.data?.message_id)
        if (!receiptRows.error) {
          const next: Record<string, 'delivered' | 'read'> = {}
          for (const row of receiptRows.data ?? [])
            if (row.status === 'read' || (row.status === 'delivered' && next[row.message_id] !== 'read'))
              next[row.message_id] = row.status
          setReceipts(next)
        }
      }
      for (const message of messages
        .filter((m) => m.senderId !== userId && !m.content.event && !m.deleted)
        .slice(-100))
        void receipt(message.id, 'delivered').catch(() => {})
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo actualizar el chat. Se conserva la copia local.',
      )
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [limit, relationshipId, userId])
  useEffect(() => {
    queueMicrotask(() => void reload())
    const unsubscribe = subscribeToTable<ChatContent>('messages', (item) => {
      setItems((current) => [...current.filter((i) => i.id !== item.id), item])
      void useChatActivity.getState().refresh()
    })
    const refresh = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    const timer = setInterval(refresh, 10000)
    const client = supabase
    let channel = client?.channel(`chat-meta:${relationshipId}:${crypto.randomUUID()}`)
    for (const table of ['message_reactions', 'message_receipts', 'starred_messages', 'pinned_messages'])
      channel = channel?.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `relationship_id=eq.${relationshipId}` },
        refresh,
      )
    channel?.subscribe((status) => {
      if (status === 'SUBSCRIBED') refresh()
    })
    for (const name of ['online', 'focus', 'private-sync']) window.addEventListener(name, refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      unsubscribe()
      clearInterval(timer)
      if (channel) void client?.removeChannel(channel)
      for (const name of ['online', 'focus', 'private-sync']) window.removeEventListener(name, refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [reload, relationshipId])
  const send = useCallback(async (content: ChatContent) => {
    const ids = content.attachments?.flatMap((a) => [a.id, ...(a.thumbnail ? [a.thumbnail.id] : [])])
    const item = await createPrivateItem(
      'messages',
      content.sticker || content.attachments?.some((a) => a.kind === 'sticker') ? 'sticker' : 'message',
      content,
      { attachmentIds: ids },
    )
    setItems((current) => [...current.filter((i) => i.id !== item.id), item])
    return item
  }, [])
  const messages = useMemo(() => reconcileMessages(items, userId), [items, userId])
  const sharedPhrase =
    items.filter((item) => item.content.event === 'motto').at(-1)?.content.text ??
    'Aquí, cada palabra cuenta nuestra historia.'
  const savePhrase = async (text: string) => {
    await createPrivateItem('messages', 'message-motto', { text: text.trim().slice(0, 120), event: 'motto' })
    await reload()
  }
  return {
    messages,
    loading,
    error,
    reload,
    send,
    reactions,
    stars,
    receipts,
    pinned,
    sharedPhrase,
    savePhrase,
    loadMore: () => setLimit((l) => Math.min(1000, l + 150)),
    hasMore: items.length >= limit && limit < 1000,
  }
}

export function useChatPresence() {
  const [remote, setRemote] = useState(''),
    channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)
  useEffect(() => {
    if (!supabase) return
    const { relationshipId, userId } = getPrivateSession()
    if (relationshipId.startsWith('local-')) return
    const channel = supabase.channel(`chat-activity:${relationshipId}`, {
      config: { presence: { key: userId } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const others = Object.entries(channel.presenceState())
          .filter(([id]) => id !== userId)
          .flatMap(([, states]) => states as unknown as { state: string; at: number }[])
        const latest = others.sort((a, b) => b.at - a.at)[0]
        setRemote(latest?.state ?? '')
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void channel.track({ state: 'Viendo el chat', at: Date.now() })
      })
    channelRef.current = channel
    return () => {
      channelRef.current = null
      void supabase?.removeChannel(channel)
    }
  }, [])
  const activity = useCallback((state: string) => {
    void channelRef.current?.track({ state, at: Date.now() })
  }, [])
  return { remote, activity }
}
