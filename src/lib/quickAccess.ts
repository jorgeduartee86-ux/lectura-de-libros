import { createSharedVault } from './crypto'
import { activatePrivateSession } from './privateRepository'
import { putVault } from './storage'
import { supabase } from './supabase'
import { useAppStore } from '../store/app'

interface QuickAccessResponse {
  relationshipId: string
  memberLabel: string
}

export async function enterWithAccessCode(accessCode: string) {
  const code = accessCode.replace(/\D/g, '')
  if (!/^\d{6}$/.test(code)) throw new Error('invalid_code_format')
  if (!supabase) throw new Error('service_unavailable')

  const { data: sessionData } = await supabase.auth.getSession()
  let user = sessionData.session?.user ?? null
  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: { access_mode: 'private_story' } },
    })
    if (error) throw new Error('anonymous_access_unavailable')
    user = data.user
  }
  if (!user) throw new Error('anonymous_access_unavailable')

  const { data, error } = await supabase.functions.invoke<QuickAccessResponse>('quick-access', {
    body: { accessCode: code },
  })
  if (error || !data?.relationshipId) {
    const context = await error?.context?.json?.().catch(() => null)
    throw new Error((context as { error?: string } | null)?.error ?? 'access_failed')
  }

  const created = await createSharedVault(code, data.relationshipId)
  await putVault(created.record)
  activatePrivateSession(created.masterKey, data.relationshipId, user.id)
  useAppStore.getState().setSession({
    userId: user.id,
    email: data.memberLabel || 'Entre páginas',
    relationshipId: data.relationshipId,
  })
  useAppStore.getState().setPrivateLocked(false)
  return data
}
