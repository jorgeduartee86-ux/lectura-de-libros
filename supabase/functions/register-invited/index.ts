import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'
import { json, preflight, publicError, sha256 } from '../_shared/http.ts'

const schema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(128),
  invitation: z.string().min(20).max(200),
})

Deno.serve(async (request) => {
  const options = preflight(request)
  if (options) return options
  try {
    const body = schema.parse(await request.json())
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })
    const inviteHash = await sha256(body.invitation)
    const { data: invite } = await admin
      .from('relationship_invites')
      .select('id')
      .eq('token_hash', inviteHash)
      .is('used_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (!invite) throw new Error('invite_invalid_or_expired')
    const allowlist = (Deno.env.get('RELATIONSHIP_EMAIL_ALLOWLIST') ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
    if (allowlist.length && !allowlist.includes(body.email.toLowerCase())) throw new Error('forbidden')
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
    const { data: allowed } = await admin.rpc('consume_rate_limit', {
      p_key: `register:${await sha256(ip)}`,
      p_limit: 5,
      p_window_seconds: 3600,
    })
    if (!allowed) throw new Error('rate_limited')
    const { error } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: { invited: true },
    })
    if (error && !error.message.toLowerCase().includes('already')) throw error
    return json(request, { accepted: true }, 202)
  } catch (error) {
    const code = error instanceof z.ZodError ? 'invalid_payload' : publicError(error)
    return json(request, { error: code }, 400)
  }
})
