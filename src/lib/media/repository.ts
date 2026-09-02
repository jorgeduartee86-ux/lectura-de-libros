import { decryptBinary, decryptContent, encryptBinary, encryptContent } from '../crypto'
import { getPrivateSession } from '../privateRepository'
import { getMediaChunk, getMediaJob, putMediaChunk, putMediaJob, removeMediaJob } from '../storage'
import { supabase } from '../supabase'
import type { CryptoContext } from '../../types'
import { MEDIA_CHUNK_SIZE, partSize } from '../../../supabase/functions/_shared/media-policy'
import { validateFile } from './files'
import type { MediaJob, MediaKind, MediaManifest, MediaRef } from './types'

export function mediaContext(
  job: Pick<MediaJob, 'id' | 'userId' | 'relationshipId' | 'logicalTimestamp'>,
  part?: number,
): CryptoContext {
  return {
    relationshipId: job.relationshipId,
    senderId: job.userId,
    messageId: job.id,
    logicalTimestamp: job.logicalTimestamp,
    version: 1,
    contentType: part === undefined ? 'media-manifest-v1' : `media-chunk-v1-${part}`,
  }
}
export async function edgeCall<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('El servidor no está configurado.')
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error || data?.error) {
    let code = data?.error
    if (error && 'context' in error) {
      try {
        code = (await (error.context as Response).json()).error
      } catch {
        /* network error */
      }
    }
    const messages: Record<string, string> = {
      not_configured: 'El almacenamiento todavía no está conectado.',
      forbidden: 'No tienes acceso a este archivo.',
      upload_incomplete: 'Faltan partes por subir. Puedes reintentar.',
      rate_limited: 'Demasiadas solicitudes. Espera un momento.',
      file_in_use: 'Este archivo todavía aparece en un mensaje o recuerdo.',
      not_found: 'El archivo ya no está disponible.',
    }
    throw new Error(
      messages[code] ?? 'No se pudo completar la operación. Reintenta cuando vuelva la conexión.',
    )
  }
  return data as T
}
export async function prepareMedia(
  file: File,
  kind: MediaKind,
  extra: Partial<Pick<MediaRef, 'thumbnail' | 'duration'>> = {},
): Promise<MediaRef> {
  await validateFile(file, kind)
  const { masterKey, relationshipId, userId } = getPrivateSession()
  const id = crypto.randomUUID(),
    logicalTimestamp = new Date().toISOString()
  const identity = { id, relationshipId, userId, logicalTimestamp }
  const ref: MediaRef = { id, kind, name: file.name, size: file.size, mime: file.type, ...extra }
  const manifest: MediaManifest = { ...ref, version: 1, chunks: [] }
  try {
    for (let i = 0; i < Math.ceil(file.size / MEDIA_CHUNK_SIZE); i++) {
      const encrypted = await encryptBinary(
        masterKey,
        await file.slice(i * MEDIA_CHUNK_SIZE, (i + 1) * MEDIA_CHUNK_SIZE).arrayBuffer(),
        mediaContext(identity, i),
      )
      await putMediaChunk(
        id,
        i,
        new Blob([encrypted.ciphertext as BlobPart], { type: 'application/octet-stream' }),
      )
      manifest.chunks.push({ iv: encrypted.iv, size: encrypted.ciphertext.byteLength })
    }
    const envelope = await encryptContent(masterKey, manifest, mediaContext(identity))
    await putMediaJob({
      ...identity,
      kind,
      mime: file.type,
      size: file.size,
      envelope,
      createdAt: Date.now(),
      state: 'queued',
    })
    return ref
  } catch (error) {
    await removeMediaJob(id)
    throw error
  }
}
export async function readQueuedManifest(job: MediaJob) {
  const session = getPrivateSession()
  if (job.relationshipId !== session.relationshipId || job.userId !== session.userId)
    throw new Error('La carga pertenece a otra sesión.')
  return decryptContent<MediaManifest>(session.masterKey, job.envelope, mediaContext(job))
}
function putPart(url: string, blob: Blob, signal: AbortSignal, onProgress: (bytes: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    const cleanup = () => signal.removeEventListener('abort', abort)
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', 'application/octet-stream')
    xhr.timeout = 120000
    xhr.upload.onprogress = (event) => onProgress(event.loaded)
    xhr.onload = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error('La firma venció o la subida falló. Reintenta.'))
    }
    xhr.onerror = xhr.ontimeout = () => {
      cleanup()
      reject(new Error('La conexión se interrumpió. La carga puede continuar.'))
    }
    xhr.onabort = () => {
      cleanup()
      reject(new DOMException('Carga pausada', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      cleanup()
      reject(new DOMException('Carga pausada', 'AbortError'))
      return
    }
    xhr.send(blob)
  })
}
export async function uploadMedia(
  id: string,
  onProgress: (percent: number) => void = () => {},
  signal = new AbortController().signal,
) {
  const job = await getMediaJob(id)
  if (!job) throw new Error('No se encontró el archivo pendiente.')
  await readQueuedManifest(job)
  try {
    await putMediaJob({ ...job, state: 'uploading', error: undefined })
    const result = await edgeCall<{
      ready?: boolean
      parts: { number: number; size: number; done: boolean; url: string }[]
    }>('r2-create-upload-url', {
      id,
      relationshipId: job.relationshipId,
      kind: job.kind,
      mime: job.mime.split(';')[0],
      size: job.size,
      ciphertext: job.envelope.ciphertext,
      iv: job.envelope.iv,
      logicalTimestamp: job.logicalTimestamp,
    })
    if (!result.ready) {
      const total = result.parts.reduce((sum, p) => sum + p.size, 0)
      let completed = result.parts.filter((p) => p.done).reduce((sum, p) => sum + p.size, 0)
      onProgress(Math.round((completed / total) * 100))
      for (const part of result.parts.filter((p) => !p.done)) {
        if (signal.aborted) throw new DOMException('Carga pausada', 'AbortError')
        const blob = await getMediaChunk(id, part.number - 1)
        if (!blob || blob.size !== part.size)
          throw new Error('La copia local está incompleta. Selecciona el archivo de nuevo.')
        await putPart(part.url, blob, signal, (bytes) =>
          onProgress(Math.round(((completed + bytes) / total) * 100)),
        )
        completed += part.size
      }
    }
    // Completion is idempotent and also repairs a sticker-library registration
    // if the preceding request finished remotely but its response was lost.
    await edgeCall('r2-complete-upload', { id })
    await putMediaJob({ ...job, state: 'ready', error: undefined })
    onProgress(100)
  } catch (error) {
    await putMediaJob({
      ...job,
      state: signal.aborted ? 'queued' : 'failed',
      error: error instanceof Error ? error.message : 'Subida fallida',
    })
    throw error
  }
}
export async function downloadMedia(
  id: string,
  signal?: AbortSignal,
): Promise<{ blob: Blob; manifest: MediaManifest }> {
  const { masterKey, relationshipId } = getPrivateSession()
  const result = await edgeCall<{
    url: string
    media: {
      owner_id: string
      relationship_id: string
      iv: string
      ciphertext: string
      logical_timestamp: string
    }
  }>('r2-create-download-url', { id })
  if (result.media.relationship_id !== relationshipId) throw new Error('Archivo de otra relación.')
  const identity = {
    id,
    relationshipId,
    userId: result.media.owner_id,
    logicalTimestamp: result.media.logical_timestamp,
  }
  const manifest = await decryptContent<MediaManifest>(
    masterKey,
    { ciphertext: result.media.ciphertext, iv: result.media.iv, cryptoVersion: 1 },
    mediaContext(identity),
  )
  if (
    manifest.version !== 1 ||
    manifest.id !== id ||
    manifest.chunks.length !== Math.ceil(manifest.size / MEDIA_CHUNK_SIZE)
  )
    throw new Error('Formato multimedia no válido.')
  const plaintext: BlobPart[] = []
  let offset = 0
  for (let index = 0; index < manifest.chunks.length; index++) {
    const chunk = manifest.chunks[index]
    if (chunk.size !== partSize(manifest.size, index)) throw new Error('Tamaño cifrado no válido.')
    const response = await fetch(result.url, {
      headers: { Range: `bytes=${offset}-${offset + chunk.size - 1}` },
      signal,
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    })
    if (response.status !== 206) throw new Error('No se pudo descargar esta parte. Vuelve a intentarlo.')
    const encrypted = await response.arrayBuffer()
    if (encrypted.byteLength !== chunk.size) throw new Error('Archivo incompleto.')
    plaintext.push(await decryptBinary(masterKey, encrypted, chunk.iv, mediaContext(identity, index)))
    offset += chunk.size
  }
  return { blob: new Blob(plaintext, { type: manifest.mime }), manifest }
}
export async function cancelMedia(id: string) {
  const job = await getMediaJob(id)
  if (job && navigator.onLine) await edgeCall('r2-abort-upload', { id })
  // Only drop the encrypted local queue after server cancellation succeeded.
  if (job && !navigator.onLine) throw new Error('Conéctate para cancelar la carga en el servidor.')
  await removeMediaJob(id)
}
