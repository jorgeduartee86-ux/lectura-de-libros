import { beforeAll, describe, expect, it } from 'vitest'
import {
  encryptedSize,
  MEDIA_CHUNK_SIZE,
  partSize,
  validateMedia,
} from '../../../supabase/functions/_shared/media-policy'
import { createVault, decryptBinary, encryptBinary } from '../crypto'
import { mediaContext } from './repository'
import {
  clearSensitiveCache,
  getMediaJob,
  getSetting,
  putMediaJob,
  putSetting,
  removeMediaJob,
} from '../storage'
import { activatePrivateSession, createPrivateItem, listPrivateItems } from '../privateRepository'
import { loadDraft, saveDraft } from '../../features/chat/repository'
const identity = {
  id: '2c10a2b0-a2b9-42ce-9938-004bcf498cb7',
  relationshipId: 'a789c630-2931-48cb-90be-1651c2f26960',
  userId: '52670b38-9ed4-4981-abf1-72e09c50e414',
  logicalTimestamp: '2026-09-02T14:00:00.000Z',
}
let key: CryptoKey
beforeAll(async () => {
  key = (await createVault('unit-test-password', identity.relationshipId)).masterKey
  activatePrivateSession(key, identity.relationshipId, identity.userId)
})
describe('multimedia cifrada en partes', () => {
  it('limpiar caché conserva visible el mensaje de la cola offline', async () => {
    activatePrivateSession(key, 'local-offline-regression', identity.userId)
    try {
      const item = await createPrivateItem('messages', 'message', { text: 'seguir en cola' })
      await clearSensitiveCache()
      expect(
        (await listPrivateItems<{ text: string }>('messages')).find((row) => row.id === item.id)?.content
          .text,
      ).toBe('seguir en cola')
    } finally {
      activatePrivateSession(key, identity.relationshipId, identity.userId)
    }
  })
  it('limita tipo, tamaño y extensión', () => {
    expect(validateMedia('image', 'image/webp', 400, 'foto.webp')).toBeNull()
    expect(validateMedia('document', 'text/html', 100, 'index.html')).not.toBeNull()
    expect(validateMedia('document', 'application/pdf', 100, 'virus.exe')).not.toBeNull()
    expect(validateMedia('video', 'video/mp4', 101 * 1024 * 1024, 'video.mp4')).not.toBeNull()
    expect(validateMedia('audio', 'audio/webm;codecs=opus', 100, 'nota.webm')).toBeNull()
    expect(validateMedia('image', 'image/webp', 0)).not.toBeNull()
  })
  it('calcula el tag GCM de cada parte y los tamaños multipart', () => {
    expect(encryptedSize(1)).toBe(17)
    expect(encryptedSize(MEDIA_CHUNK_SIZE)).toBe(MEDIA_CHUNK_SIZE + 16)
    expect(encryptedSize(MEDIA_CHUNK_SIZE + 1)).toBe(MEDIA_CHUNK_SIZE + 33)
    expect(partSize(MEDIA_CHUNK_SIZE + 1, 0)).toBe(MEDIA_CHUNK_SIZE + 16)
    expect(partSize(MEDIA_CHUNK_SIZE + 1, 1)).toBe(17)
  })
  it('autentica archivo, remitente y número de parte sin reutilizar IV', async () => {
    const bytes = new TextEncoder().encode('contenido privado').buffer
    const a = await encryptBinary(key, bytes, mediaContext(identity, 0)),
      b = await encryptBinary(key, bytes, mediaContext(identity, 1))
    expect(a.iv).not.toBe(b.iv)
    expect(
      new TextDecoder().decode(
        await decryptBinary(key, a.ciphertext.buffer as ArrayBuffer, a.iv, mediaContext(identity, 0)),
      ),
    ).toBe('contenido privado')
    await expect(
      decryptBinary(key, a.ciphertext.buffer as ArrayBuffer, a.iv, mediaContext(identity, 1)),
    ).rejects.toThrow()
    await expect(
      decryptBinary(
        key,
        a.ciphertext.buffer as ArrayBuffer,
        a.iv,
        mediaContext({ ...identity, id: crypto.randomUUID() }, 0),
      ),
    ).rejects.toThrow()
  })
  it('guarda borradores cifrados y la última escritura gana', async () => {
    await Promise.all([saveDraft({ text: 'primero' }), saveDraft({ text: 'secreto más reciente' })])
    expect((await loadDraft()).text).toBe('secreto más reciente')
    const stored = await getSetting(`chat-draft:${identity.relationshipId}:${identity.userId}`)
    expect(JSON.stringify(stored)).not.toContain('secreto más reciente')
  })
  it('retirar una carga no borra preferencias ni la cola de otras cargas', async () => {
    const job = {
      ...identity,
      kind: 'image' as const,
      mime: 'image/webp',
      size: 2,
      envelope: { ciphertext: 'opaque', iv: 'opaque', cryptoVersion: 1 as const },
      createdAt: 1,
      state: 'queued' as const,
    }
    await putSetting('keep-me', 'preserved')
    await putMediaJob(job)
    await putMediaJob({ ...job, id: 'another' })
    await removeMediaJob(job.id)
    expect(await getMediaJob(job.id)).toBeUndefined()
    expect(await getMediaJob('another')).toBeDefined()
    expect(await getSetting('keep-me')).toBe('preserved')
  })
})
