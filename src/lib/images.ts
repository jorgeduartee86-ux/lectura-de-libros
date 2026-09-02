import { decryptBinary } from './crypto'
import { getPrivateSession } from './privateRepository'
import { supabase } from './supabase'
import { imageFile } from './media/files'
import { downloadMedia, prepareMedia, uploadMedia } from './media/repository'
import { removeMediaJob } from './storage'

interface LegacyImageRef {
  storage?: 'supabase'
  path: string
  assetId: string
  iv: string
  mime: 'image/webp'
  logicalTimestamp: string
}
export type EncryptedImageRef = LegacyImageRef | { storage: 'r2'; assetId: string }

export async function uploadEncryptedMemoryImage(file: File): Promise<EncryptedImageRef> {
  const compressed = await imageFile(file)
  const ref = await prepareMedia(compressed, 'image')
  await uploadMedia(ref.id)
  await removeMediaJob(ref.id)
  return { storage: 'r2', assetId: ref.id }
}

export async function downloadEncryptedMemoryImage(reference: EncryptedImageRef, senderId: string) {
  if (reference.storage === 'r2') return URL.createObjectURL((await downloadMedia(reference.assetId)).blob)
  if (!supabase) throw new Error('storage_not_configured')
  const { masterKey, relationshipId } = getPrivateSession()
  const { data, error } = await supabase.storage.from('memories').download(reference.path)
  if (error) throw error
  const plaintext = await decryptBinary(masterKey, await data.arrayBuffer(), reference.iv, {
    relationshipId,
    messageId: reference.assetId,
    senderId,
    version: 1,
    logicalTimestamp: reference.logicalTimestamp,
    contentType: 'memory-image',
  })
  return URL.createObjectURL(new Blob([plaintext], { type: reference.mime }))
}
