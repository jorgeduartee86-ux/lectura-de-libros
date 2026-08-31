import { decryptBinary, encryptBinary } from './crypto'
import { getPrivateSession } from './privateRepository'
import { supabase } from './supabase'
import type { CryptoContext } from '../types'

export interface EncryptedImageRef {
  path: string
  assetId: string
  iv: string
  mime: 'image/webp'
  logicalTimestamp: string
}

async function compressImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('image_type_not_allowed')
  if (file.size > 10 * 1024 * 1024) throw new Error('image_too_large')
  const image = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('image_compression_failed'))),
      'image/webp',
      0.78,
    ),
  )
  if (blob.size > 4 * 1024 * 1024) throw new Error('compressed_image_too_large')
  return blob
}

function contextFor(
  reference: Omit<EncryptedImageRef, 'path' | 'iv' | 'mime'>,
  relationshipId: string,
  userId: string,
): CryptoContext {
  return {
    relationshipId,
    messageId: reference.assetId,
    senderId: userId,
    version: 1,
    logicalTimestamp: reference.logicalTimestamp,
    contentType: 'memory-image',
  }
}

export async function uploadEncryptedMemoryImage(file: File): Promise<EncryptedImageRef> {
  if (!supabase) throw new Error('storage_not_configured')
  const { masterKey, relationshipId, userId } = getPrivateSession()
  const compressed = await compressImage(file)
  const reference = { assetId: crypto.randomUUID(), logicalTimestamp: new Date().toISOString() }
  const encrypted = await encryptBinary(
    masterKey,
    await compressed.arrayBuffer(),
    contextFor(reference, relationshipId, userId),
  )
  const path = `${relationshipId}/${userId}/${reference.assetId}.bin`
  const { error } = await supabase.storage
    .from('memories')
    .upload(path, encrypted.ciphertext, { contentType: 'application/octet-stream', upsert: false })
  if (error) throw error
  return { ...reference, path, iv: encrypted.iv, mime: 'image/webp' }
}

export async function downloadEncryptedMemoryImage(reference: EncryptedImageRef, senderId: string) {
  if (!supabase) throw new Error('storage_not_configured')
  const { masterKey, relationshipId } = getPrivateSession()
  const { data, error } = await supabase.storage.from('memories').download(reference.path)
  if (error) throw error
  const plaintext = await decryptBinary(
    masterKey,
    await data.arrayBuffer(),
    reference.iv,
    contextFor(reference, relationshipId, senderId),
  )
  return URL.createObjectURL(new Blob([plaintext], { type: reference.mime }))
}
