import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (request) => {
  if (request.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET'))
    return new Response('Unauthorized', { status: 401 })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await admin
    .from('relationship_invites')
    .update({ revoked_at: new Date().toISOString() })
    .lt('expires_at', new Date().toISOString())
    .is('used_at', null)
    .is('revoked_at', null)
  return new Response(error ? 'Failed' : 'OK', { status: error ? 500 : 200 })
})
