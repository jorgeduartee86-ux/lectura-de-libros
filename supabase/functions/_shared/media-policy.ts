// Shared by the browser and Edge Functions. No credentials or environment access here.
const MiB = 1024 * 1024
export const MAX_IMAGE_SIZE = 15 * MiB
export const MAX_VIDEO_SIZE = 100 * MiB
export const MAX_AUDIO_SIZE = 25 * MiB
export const MAX_DOCUMENT_SIZE = 25 * MiB
export const MAX_STICKER_SIZE = 2 * MiB
export const MAX_SIMULTANEOUS_UPLOADS = 2
export const SIGNED_URL_TTL = 300
export const MEDIA_CHUNK_SIZE = 5 * MiB
export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'sticker'
export const MEDIA_LIMITS: Record<MediaKind, number> = {
  image: MAX_IMAGE_SIZE,
  video: MAX_VIDEO_SIZE,
  audio: MAX_AUDIO_SIZE,
  document: MAX_DOCUMENT_SIZE,
  sticker: MAX_STICKER_SIZE,
}
export const MEDIA_MIMES: Record<MediaKind, readonly string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  sticker: ['image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/wav', 'audio/x-m4a'],
  document: [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
}
const extensions: Record<MediaKind, RegExp> = {
  image: /\.(jpe?g|png|webp|avif)$/i,
  sticker: /\.(png|webp)$/i,
  video: /\.(mp4|webm|mov)$/i,
  audio: /\.(m4a|mp3|ogg|webm|wav|mp4)$/i,
  document: /\.(pdf|txt|csv|zip|docx?|xlsx?|pptx?)$/i,
}
export function validateMedia(kind: MediaKind, mime: string, size: number, name?: string): string | null {
  if (!Object.hasOwn(MEDIA_LIMITS, kind)) return 'Tipo de archivo no permitido.'
  if (!Number.isSafeInteger(size) || size < 1 || size > MEDIA_LIMITS[kind])
    return `El límite es ${MEDIA_LIMITS[kind] / MiB} MB.`
  if (!MEDIA_MIMES[kind].includes(mime.split(';')[0].trim().toLowerCase())) return 'Formato no permitido.'
  if (name && (!extensions[kind].test(name) || /[\u0000-\u001f]/.test(name)))
    return 'La extensión no corresponde a un archivo permitido.'
  return null
}
export function encryptedSize(size: number) {
  return size + Math.ceil(size / MEDIA_CHUNK_SIZE) * 16
}
export function partSize(size: number, index: number) {
  return Math.min(MEDIA_CHUNK_SIZE, size - index * MEDIA_CHUNK_SIZE) + 16
}
