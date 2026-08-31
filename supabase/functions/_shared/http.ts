import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

export function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? ''
  const allowed = configuredOrigins.includes(origin) ? origin : configuredOrigins[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export function preflight(request: Request) {
  return request.method === 'OPTIONS'
    ? new Response(null, { status: 204, headers: corsHeaders(request) })
    : null
}

export interface Clients {
  user: User
  userClient: SupabaseClient
  admin: SupabaseClient
}

export async function authenticatedClients(request: Request): Promise<Clients> {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) throw new Error('authentication_required')
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) throw new Error('authentication_required')
  const admin = createClient(url, service, { auth: { persistSession: false } })
  return { user: data.user, userClient, admin }
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes))
  return btoa(String.fromCharCode(...value))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

export function publicError(error: unknown) {
  const code = error instanceof Error ? error.message : 'operation_failed'
  const allowed = new Set([
    'authentication_required',
    'forbidden',
    'already_linked',
    'relationship_full',
    'invite_invalid_or_expired',
    'cannot_accept_own_invite',
    'rate_limited',
    'invalid_payload',
    'not_configured',
    'device_not_found',
  ])
  return allowed.has(code) ? code : 'operation_failed'
}
