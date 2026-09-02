import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from 'npm:@aws-sdk/client-s3@3.1120.0'
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.1120.0'
import { z } from 'npm:zod@4'
import { authenticatedClients, json, preflight, type Clients } from './http.ts'
import { validateMedia, encryptedSize, partSize, MEDIA_CHUNK_SIZE, SIGNED_URL_TTL } from './media-policy.ts'

const identifier = z.uuid()
const startSchema = z.object({
  id: identifier,
  relationshipId: identifier,
  kind: z.enum(['image', 'video', 'audio', 'document', 'sticker']),
  mime: z.string().max(160),
  size: z.number().int().positive(),
  ciphertext: z.string().min(16).max(32768),
  iv: z.string().min(16).max(64),
  logicalTimestamp: z.iso.datetime(),
})
export function r2Client() {
  const account = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucket = Deno.env.get('R2_BUCKET')
  const endpoint = Deno.env.get('R2_ENDPOINT')
  if (
    !account ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucket ||
    endpoint !== `https://${account}.r2.cloudflarestorage.com`
  )
    throw new Error('not_configured')
  return {
    bucket,
    s3: new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  }
}
export async function assertMember(clients: Clients, relationshipId: string) {
  const { data, error } = await clients.admin
    .from('relationship_members')
    .select('user_id')
    .eq('relationship_id', relationshipId)
    .eq('user_id', clients.user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (error || !data) throw new Error('forbidden')
}
async function attachment(clients: Clients, id: string, owner: boolean) {
  const { data, error } = await clients.admin.from('media_attachments').select('*').eq('id', id).maybeSingle()
  if (error || !data) throw new Error('not_found')
  await assertMember(clients, data.relationship_id)
  if (owner && data.owner_id !== clients.user.id) throw new Error('forbidden')
  // Never accept caller-supplied bucket/key/upload ID.
  if (
    !new RegExp(`^relationships/${data.relationship_id}/media/\\d{4}/\\d{2}/${data.id}\\.bin$`).test(
      data.object_key,
    )
  )
    throw new Error('invalid_object_key')
  return data
}
export async function deleteUnreferenced(clients: Clients, id: string) {
  const media = await attachment(clients, id, true)
  const { data: claimed, error } = await clients.admin.rpc('claim_media_deletion', {
    p_id: id,
    p_owner: clients.user.id,
  })
  if (error || !claimed) throw new Error('file_in_use')
  const { s3, bucket } = r2Client()
  if (media.upload_id) {
    try {
      await s3.send(
        new AbortMultipartUploadCommand({ Bucket: bucket, Key: media.object_key, UploadId: media.upload_id }),
      )
    } catch (error) {
      if ((error as { name?: string }).name !== 'NoSuchUpload') throw error
    }
  }
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: media.object_key }))
  const { error: updateError } = await clients.admin
    .from('media_attachments')
    .update({ state: 'deleted', upload_id: null, ciphertext: '0'.repeat(32) })
    .eq('id', id)
  if (updateError) throw updateError
}
export function mediaHandler(action: 'upload' | 'complete' | 'download' | 'delete' | 'abort') {
  return async (request: Request) => {
    const options = preflight(request)
    if (options) return options
    if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
    try {
      const clients = await authenticatedClients(request)
      const body = await request.json()
      const { s3, bucket } = r2Client()
      if (action === 'upload') {
        const input = startSchema.parse(body)
        await assertMember(clients, input.relationshipId)
        if (validateMedia(input.kind, input.mime, input.size)) throw new Error('invalid_media')
        const { data: allowed } = await clients.admin.rpc('consume_rate_limit', {
          p_key: `media:${clients.user.id}`,
          p_limit: 80,
          p_window_seconds: 3600,
        })
        if (!allowed) throw new Error('rate_limited')
        const { data: existing } = await clients.admin
          .from('media_attachments')
          .select('id')
          .eq('id', input.id)
          .maybeSingle()
        if (!existing) {
          const { count } = await clients.admin
            .from('media_attachments')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', clients.user.id)
            .eq('state', 'uploading')
          if ((count ?? 0) >= 20) throw new Error('too_many_uploads')
          const date = new Date()
          const key = `relationships/${input.relationshipId}/media/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${input.id}.bin`
          const { error } = await clients.admin
            .from('media_attachments')
            .insert({
              id: input.id,
              relationship_id: input.relationshipId,
              owner_id: clients.user.id,
              kind: input.kind,
              mime: input.mime,
              plain_size: input.size,
              encrypted_size: encryptedSize(input.size),
              object_key: key,
              ciphertext: input.ciphertext,
              iv: input.iv,
              logical_timestamp: input.logicalTimestamp,
            })
          if (error && error.code !== '23505') throw error
        }
        let media = await attachment(clients, input.id, true)
        if (
          media.plain_size !== input.size ||
          media.ciphertext !== input.ciphertext ||
          media.relationship_id !== input.relationshipId
        )
          throw new Error('upload_mismatch')
        if (media.state === 'ready') return json(request, { id: media.id, ready: true, parts: [] })
        if (media.state !== 'uploading') throw new Error('upload_unavailable')
        if (!media.upload_id) {
          const created = await s3.send(
            new CreateMultipartUploadCommand({
              Bucket: bucket,
              Key: media.object_key,
              ContentType: 'application/octet-stream',
              CacheControl: 'private, no-store',
            }),
          )
          const { data: updated, error } = await clients.admin
            .from('media_attachments')
            .update({ upload_id: created.UploadId })
            .eq('id', media.id)
            .is('upload_id', null)
            .select('*')
            .maybeSingle()
          if (error || !updated) {
            await s3.send(
              new AbortMultipartUploadCommand({
                Bucket: bucket,
                Key: media.object_key,
                UploadId: created.UploadId,
              }),
            )
            if (error) throw error
            media = await attachment(clients, input.id, true)
          } else media = updated
        }
        const listed = await s3.send(
          new ListPartsCommand({ Bucket: bucket, Key: media.object_key, UploadId: media.upload_id }),
        )
        const parts = await Promise.all(
          Array.from({ length: Math.ceil(input.size / MEDIA_CHUNK_SIZE) }, async (_, index) => ({
            number: index + 1,
            size: partSize(input.size, index),
            done:
              listed.Parts?.some(
                (p) => p.PartNumber === index + 1 && p.Size === partSize(input.size, index),
              ) ?? false,
            url: await getSignedUrl(
              s3,
              new UploadPartCommand({
                Bucket: bucket,
                Key: media.object_key,
                UploadId: media.upload_id,
                PartNumber: index + 1,
                ContentLength: partSize(input.size, index),
              }),
              { expiresIn: SIGNED_URL_TTL },
            ),
          })),
        )
        return json(request, { id: media.id, parts, expiresIn: SIGNED_URL_TTL })
      }
      const id = identifier.parse(body.id)
      if (action === 'delete' || action === 'abort') {
        try {
          await deleteUnreferenced(clients, id)
        } catch (error) {
          if (action !== 'abort' || (error as Error).message !== 'not_found') throw error
        }
        return json(request, { deleted: true })
      }
      const media = await attachment(clients, id, action === 'complete')
      if (action === 'complete') {
        if (media.state === 'ready') {
          if (media.kind === 'sticker') {
            const { error } = await clients.admin
              .from('custom_stickers')
              .upsert(
                { id, relationship_id: media.relationship_id, user_id: media.owner_id },
                { onConflict: 'id', ignoreDuplicates: true },
              )
            if (error) throw error
          }
          return json(request, { ready: true })
        }
        if (media.state !== 'uploading' || !media.upload_id) throw new Error('upload_unavailable')
        try {
          const listed = await s3.send(
            new ListPartsCommand({ Bucket: bucket, Key: media.object_key, UploadId: media.upload_id }),
          )
          const count = Math.ceil(media.plain_size / MEDIA_CHUNK_SIZE)
          if (
            listed.Parts?.length !== count ||
            listed.Parts.some((p, i) => p.PartNumber !== i + 1 || p.Size !== partSize(media.plain_size, i))
          )
            throw new Error('upload_incomplete')
          await s3.send(
            new CompleteMultipartUploadCommand({
              Bucket: bucket,
              Key: media.object_key,
              UploadId: media.upload_id,
              MultipartUpload: {
                Parts: listed.Parts.map((p) => ({ ETag: p.ETag, PartNumber: p.PartNumber })),
              },
            }),
          )
        } catch (error) {
          if ((error as { name?: string }).name !== 'NoSuchUpload') throw error
        }
        const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: media.object_key }))
        if (head.ContentLength !== media.encrypted_size || head.ContentType !== 'application/octet-stream')
          throw new Error('upload_mismatch')
        const { error } = await clients.admin
          .from('media_attachments')
          .update({ state: 'ready', completed_at: new Date().toISOString() })
          .eq('id', id)
          .eq('state', 'uploading')
        if (error) throw error
        if (media.kind === 'sticker') {
          const { error: stickerError } = await clients.admin
            .from('custom_stickers')
            .upsert(
              { id, relationship_id: media.relationship_id, user_id: media.owner_id },
              { onConflict: 'id', ignoreDuplicates: true },
            )
          if (stickerError) throw stickerError
        }
        return json(request, { ready: true })
      }
      if (media.state !== 'ready') throw new Error('not_found')
      if (media.owner_id !== clients.user.id) {
        const { count, error } = await clients.admin
          .from('media_references')
          .select('attachment_id', { count: 'exact', head: true })
          .eq('attachment_id', id)
        if (error || !count) throw new Error('forbidden')
      }
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: bucket,
          Key: media.object_key,
          ResponseContentType: 'application/octet-stream',
          ResponseCacheControl: 'private, no-store',
        }),
        { expiresIn: SIGNED_URL_TTL },
      )
      return json(request, {
        url,
        expiresIn: SIGNED_URL_TTL,
        media: {
          id: media.id,
          owner_id: media.owner_id,
          relationship_id: media.relationship_id,
          ciphertext: media.ciphertext,
          iv: media.iv,
          logical_timestamp: media.logical_timestamp,
        },
      })
    } catch (error) {
      const code =
        error instanceof z.ZodError
          ? 'invalid_payload'
          : error instanceof Error
            ? error.message
            : 'operation_failed'
      const safe = [
        'authentication_required',
        'forbidden',
        'not_configured',
        'not_found',
        'invalid_media',
        'rate_limited',
        'too_many_uploads',
        'upload_mismatch',
        'upload_unavailable',
        'upload_incomplete',
        'file_in_use',
        'invalid_payload',
      ]
      return json(
        request,
        { error: safe.includes(code) ? code : 'operation_failed' },
        code === 'authentication_required' ? 401 : code === 'forbidden' ? 403 : 400,
      )
    }
  }
}
