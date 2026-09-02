import { describe, expect, it } from 'vitest'
import {
  createPairingEnvelope,
  createPairingSecret,
  createSharedVault,
  createVault,
  decryptBinary,
  decryptContent,
  encryptContent,
  encryptBinary,
  importPairingEnvelope,
  recoverVault,
  unlockVault,
} from './crypto'
import type { CryptoContext } from '../types'

const context: CryptoContext = {
  relationshipId: '5c6619d4-bb2d-42e4-bba9-a4317544f640',
  messageId: '414881e0-618d-4202-aa97-b7bf80f18130',
  senderId: 'f79d8230-9370-4397-9f31-e220c5187756',
  version: 1,
  logicalTimestamp: '2026-08-31T12:00:00.000Z',
  contentType: 'message',
}

describe('protocolo de cifrado', () => {
  it('cifra y descifra con AES-GCM, HKDF y AAD', async () => {
    const { masterKey } = await createVault('frase-secreta', context.relationshipId)
    const envelope = await encryptContent(masterKey, { text: 'Solo entre dos' }, context)
    await expect(decryptContent(masterKey, envelope, context)).resolves.toEqual({ text: 'Solo entre dos' })
    expect(envelope.ciphertext).not.toContain('Solo entre dos')
  })

  it('usa un IV nuevo en cada cifrado', async () => {
    const { masterKey } = await createVault('frase-secreta', context.relationshipId)
    const first = await encryptContent(masterKey, { text: 'igual' }, context)
    const second = await encryptContent(masterKey, { text: 'igual' }, context)
    expect(first.iv).not.toBe(second.iv)
    expect(first.ciphertext).not.toBe(second.ciphertext)
  })

  it('rechaza ciphertext manipulado, clave incorrecta y AAD distinto', async () => {
    const firstVault = await createVault('primera-frase', context.relationshipId)
    const secondVault = await createVault('segunda-frase', context.relationshipId)
    const envelope = await encryptContent(firstVault.masterKey, { text: 'íntegro' }, context)
    const changed = { ...envelope, ciphertext: `${envelope.ciphertext.slice(0, -2)}AA` }
    await expect(decryptContent(firstVault.masterKey, changed, context)).rejects.toThrow()
    await expect(decryptContent(secondVault.masterKey, envelope, context)).rejects.toThrow()
    await expect(
      decryptContent(firstVault.masterKey, envelope, { ...context, contentType: 'letter' }),
    ).rejects.toThrow()
  })

  it('no desbloquea la clave envuelta con un PIN incorrecto', async () => {
    const { record } = await createVault('pin-correcto', context.relationshipId)
    await expect(unlockVault('pin-incorrecto', record)).rejects.toThrow()
    await expect(unlockVault('pin-correcto', record)).resolves.toBeInstanceOf(CryptoKey)
  })

  it('recupera la misma clave y la vuelve a envolver con otro PIN', async () => {
    const created = await createVault('pin-anterior', context.relationshipId)
    const encrypted = await encryptContent(created.masterKey, { memory: 'siempre' }, context)
    const recovered = await recoverVault(created.recoveryCode, created.record, 'pin-nuevo')
    await expect(decryptContent(recovered.masterKey, encrypted, context)).resolves.toEqual({
      memory: 'siempre',
    })
    await expect(unlockVault('pin-nuevo', recovered.record)).resolves.toBeInstanceOf(CryptoKey)
  })

  it('empareja un segundo dispositivo sin enviar el secreto al servidor', async () => {
    const first = await createVault('primer-pin', context.relationshipId)
    const secret = createPairingSecret()
    const envelope = await createPairingEnvelope(first.masterKey, secret, context.relationshipId)
    const second = await importPairingEnvelope(secret, envelope, context.relationshipId, 'segundo-pin')
    const encrypted = await encryptContent(first.masterKey, { text: 'compartido' }, context)
    await expect(decryptContent(second.masterKey, encrypted, context)).resolves.toEqual({
      text: 'compartido',
    })
    await expect(
      importPairingEnvelope(createPairingSecret(), envelope, context.relationshipId, 'x'),
    ).rejects.toThrow()
  })

  it('permite que dos dispositivos con la misma clave abran los mismos mensajes', async () => {
    const firstDevice = await createSharedVault('test-only-shared-code', context.relationshipId)
    const secondDevice = await createSharedVault('test-only-shared-code', context.relationshipId)
    const envelope = await encryptContent(firstDevice.masterKey, { text: 'Nuestro capítulo' }, context)
    await expect(decryptContent(secondDevice.masterKey, envelope, context)).resolves.toEqual({
      text: 'Nuestro capítulo',
    })
    const wrongCode = await createSharedVault('000000', context.relationshipId)
    await expect(decryptContent(wrongCode.masterKey, envelope, context)).rejects.toThrow()
  })

  it('cifra archivos binarios con el mismo contexto autenticado', async () => {
    const { masterKey } = await createVault('frase-para-archivos', context.relationshipId)
    const source = new TextEncoder().encode('imagen privada').buffer
    const envelope = await encryptBinary(masterKey, source, { ...context, contentType: 'memory-image' })
    const plaintext = await decryptBinary(masterKey, envelope.ciphertext.buffer as ArrayBuffer, envelope.iv, {
      ...context,
      contentType: 'memory-image',
    })
    expect(new TextDecoder().decode(plaintext)).toBe('imagen privada')
    await expect(
      decryptBinary(masterKey, envelope.ciphertext.buffer as ArrayBuffer, envelope.iv, {
        ...context,
        messageId: crypto.randomUUID(),
        contentType: 'memory-image',
      }),
    ).rejects.toThrow()
  })
})
