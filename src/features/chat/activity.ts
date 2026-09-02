import { create } from 'zustand'
import { supabase } from '../../lib/supabase'
import { getPrivateSession } from '../../lib/privateRepository'

interface Activity {
  unread: string[]
  count: number
  refresh: () => Promise<void>
}
export const useChatActivity = create<Activity>((set) => ({
  unread: [],
  count: 0,
  async refresh() {
    if (!supabase) return
    let session
    try {
      session = getPrivateSession()
    } catch {
      return
    }
    if (session.relationshipId.startsWith('local-')) return
    const { data, error, count } = await supabase.rpc(
      'chat_unread',
      { p_relationship: session.relationshipId },
      { count: 'exact' },
    )
    if (error) return
    const unread = (data ?? []).map((row: { message_id: string }) => row.message_id)
    const total = count ?? unread.length
    set({ unread, count: total })
    updateBadge(total)
  },
}))
export function updateBadge(count: number) {
  document.title = count ? `(${count}) Lectura de libros` : 'Lectura de libros'
  if ('setAppBadge' in navigator) {
    void (count ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => {})
  }
  navigator.serviceWorker?.controller?.postMessage({ type: 'UNREAD_COUNT', count })
}
const reading = new Set<string>()
export async function receipt(id: string, status: 'delivered' | 'read') {
  if (!supabase || reading.has(`${id}:${status}`)) return
  const { relationshipId, userId } = getPrivateSession()
  if (relationshipId.startsWith('local-')) return
  reading.add(`${id}:${status}`)
  try {
    const { error } = await supabase
      .from('message_receipts')
      .upsert(
        { message_id: id, relationship_id: relationshipId, user_id: userId, status },
        { onConflict: 'message_id,user_id,status', ignoreDuplicates: true },
      )
    if (error) throw error
    if (status === 'read') await useChatActivity.getState().refresh()
  } finally {
    reading.delete(`${id}:${status}`)
  }
}
