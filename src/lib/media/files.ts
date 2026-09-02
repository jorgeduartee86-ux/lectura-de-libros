import { validateMedia, type MediaKind } from '../../../supabase/functions/_shared/media-policy'

export function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
export async function imageFile(
  file: File,
  options: { rotation?: number; crop?: boolean; text?: string; sticker?: boolean } = {},
) {
  const error = validateMedia(options.sticker ? 'sticker' : 'image', file.type, file.size)
  // Custom stickers accept a normal input image and enforce their smaller limit after compression.
  if (error && !options.sticker) throw new Error(error)
  if (
    !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type) ||
    file.size > 15 * 1024 * 1024
  )
    throw new Error('Imagen no permitida.')
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const angle = (options.rotation ?? 0) % 360
    const square = options.crop || options.sticker
    const side = Math.min(bitmap.width, bitmap.height)
    const width = square ? side : bitmap.width,
      height = square ? side : bitmap.height
    const scale = Math.min(1, (options.sticker ? 512 : 1920) / Math.max(width, height))
    const canvas = document.createElement('canvas')
    const rotated = angle === 90 || angle === 270
    canvas.width = Math.round((rotated ? height : width) * scale)
    canvas.height = Math.round((rotated ? width : height) * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la imagen.')
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate((angle * Math.PI) / 180)
    context.drawImage(
      bitmap,
      (bitmap.width - width) / 2,
      (bitmap.height - height) / 2,
      width,
      height,
      (-width * scale) / 2,
      (-height * scale) / 2,
      width * scale,
      height * scale,
    )
    context.setTransform(1, 0, 0, 1, 0, 0)
    if (options.text) {
      context.font = `700 ${Math.max(20, canvas.width / 13)}px system-ui`
      context.textAlign = 'center'
      context.lineWidth = 6
      context.strokeStyle = '#ffffff'
      context.strokeText(options.text.slice(0, 40), canvas.width / 2, canvas.height - 28, canvas.width - 24)
      context.fillStyle = '#5C068C'
      context.fillText(options.text.slice(0, 40), canvas.width / 2, canvas.height - 28, canvas.width - 24)
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir.'))), 'image/webp', 0.84),
    )
    const ext = blob.type === 'image/webp' ? 'webp' : 'png'
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${ext}`, { type: blob.type })
  } finally {
    bitmap.close()
  }
}
export async function validateFile(file: File, kind: MediaKind) {
  const error = validateMedia(kind, file.type, file.size, file.name)
  if (error) throw new Error(error)
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  // Reject executable formats even when renamed. Encrypted files cannot be scanned on the server.
  if (
    (bytes[0] === 0x4d && bytes[1] === 0x5a) ||
    (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46)
  )
    throw new Error('No se permiten archivos ejecutables.')
  if (file.type === 'application/pdf' && String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-')
    throw new Error('El archivo no parece un PDF válido.')
}
export async function videoInfo(file: File): Promise<{ duration: number; thumbnail?: File }> {
  const video = document.createElement('video'),
    url = URL.createObjectURL(file)
  video.preload = 'metadata'
  video.muted = true
  video.playsInline = true
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No se pudo leer el video.')), 12000)
      video.onloadeddata = () => {
        clearTimeout(timer)
        resolve()
      }
      video.onerror = () => {
        clearTimeout(timer)
        reject(new Error('Video no compatible.'))
      }
      video.src = url
    })
    const canvas = document.createElement('canvas'),
      scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.7))
    return {
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      thumbnail: blob ? new File([blob], 'vista.webp', { type: blob.type }) : undefined,
    }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
