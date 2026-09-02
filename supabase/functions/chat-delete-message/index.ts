import { z } from 'npm:zod@4'
import { authenticatedClients, json, preflight } from '../_shared/http.ts'
import { assertMember, deleteUnreferenced } from '../_shared/r2.ts'
Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options
  try {
    const { id } = z.object({ id: z.uuid() }).parse(await request.json())
    const clients = await authenticatedClients(request)
    const { data: message, error } = await clients.admin
      .from('messages')
      .select('id,relationship_id,sender_id,attachment_ids')
      .eq('id', id)
      .single()
    if (error || message.sender_id !== clients.user.id) throw new Error('forbidden')
    await assertMember(clients, message.relationship_id)
    const { error: changed } = await clients.admin
      .from('messages')
      .update({ deleted_at: new Date().toISOString(), ciphertext: '0'.repeat(32), attachment_ids: [] })
      .eq('id', id)
    if (changed) throw changed
    await clients.admin
      .from('push_jobs')
      .update({ state: 'cancelled' })
      .eq('message_id', id)
      .in('state', ['pending', 'processing'])
    let cleanupPending = 0
    for (const asset of message.attachment_ids ?? []) {
      try {
        await deleteUnreferenced(clients, asset)
      } catch (error) {
        if ((error as Error).message !== 'file_in_use') cleanupPending++
      }
    }
    return json(request, { deleted: true, cleanupPending })
  } catch {
    return json(request, { error: 'operation_failed' }, 400)
  }
})
