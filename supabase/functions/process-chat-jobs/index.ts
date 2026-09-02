import { createClient } from 'npm:@supabase/supabase-js@2'
import { deliverJobs } from '../_shared/push-delivery.ts'
import { r2Client } from '../_shared/r2.ts'
import { AbortMultipartUploadCommand, DeleteObjectCommand } from 'npm:@aws-sdk/client-s3@3.1120.0'
Deno.serve(async (request) => {
  const expected = Deno.env.get('CRON_SECRET')
  if (!expected || request.headers.get('x-cron-secret') !== expected)
    return new Response('Unauthorized', { status: 401 })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  try {
    const { data: published, error } = await admin.rpc('publish_scheduled_messages')
    if (error) throw error
    const push = await deliverJobs(admin)
    // Incomplete transfers remain resumable for seven days. Unreferenced completed media gets a 7-day grace period.
    const { data: stale, error: staleError } = await admin.rpc('stale_media_candidates')
    if (staleError) throw staleError
    let cleaned = 0
    if (stale?.length) {
      const { s3, bucket } = r2Client()
      for (const asset of stale) {
        const { data: claimed } = await admin.rpc('claim_media_deletion', {
          p_id: asset.id,
          p_owner: asset.owner_id,
        })
        if (!claimed) continue
        if (asset.upload_id) {
          try {
            await s3.send(
              new AbortMultipartUploadCommand({
                Bucket: bucket,
                Key: asset.object_key,
                UploadId: asset.upload_id,
              }),
            )
          } catch (error) {
            if ((error as { name?: string }).name !== 'NoSuchUpload') continue
          }
        }
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: asset.object_key }))
        await admin
          .from('media_attachments')
          .update({ state: 'deleted', upload_id: null, ciphertext: '0'.repeat(32) })
          .eq('id', asset.id)
        cleaned++
      }
    }
    return Response.json({ published, ...push, cleaned })
  } catch {
    return Response.json({ error: 'job_processing_failed' }, { status: 500 })
  }
})
