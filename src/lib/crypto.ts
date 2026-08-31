import type { CryptoContext, CryptoEnvelope, VaultRecord } from '../types'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const PIN_ITERATIONS = 310_000
const masterBytesByKey = new WeakMap<CryptoKey, Uint8Array>()

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function randomBytes(length: number) {
  return crypto.getRandomValues(new Uint8Array(length))
}

async function importMasterKey(bytes: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', bytes as BufferSource, 'HKDF', false, ['deriveKey'])
  masterBytesByKey.set(key, new Uint8Array(bytes))
  return key
}

function aad(context: CryptoContext) {
  return encoder.encode(
    JSON.stringify([
      context.relationshipId,
      context.messageId,
      context.senderId,
      context.version,
      context.logicalTimestamp,
      context.contentType,
    ]),
  )
}

async function derivePinKey(pin: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PIN_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function wrapBytes(key: CryptoKey, bytes: Uint8Array, additionalData: string): Promise<CryptoEnvelope> {
  const iv = randomBytes(12)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: encoder.encode(additionalData) },
    key,
    bytes as BufferSource,
  )
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv), cryptoVersion: 1 }
}

async function unwrapBytes(key: CryptoKey, envelope: CryptoEnvelope, additionalData: string) {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(envelope.iv) as BufferSource,
      additionalData: encoder.encode(additionalData),
    },
    key,
    base64ToBytes(envelope.ciphertext) as BufferSource,
  )
  return new Uint8Array(plaintext)
}

async function createVaultFromBytes(pin: string, relationshipId: string, masterBytes: Uint8Array) {
  const masterKey = await importMasterKey(masterBytes)
  const salt = randomBytes(16)
  const pinKey = await derivePinKey(pin, salt)
  const recoveryBytes = randomBytes(32)
  const recoveryKey = await crypto.subtle.importKey('raw', recoveryBytes as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
  const createdAt = new Date().toISOString()
  const wrappedMasterKey = await wrapBytes(pinKey, masterBytes, `vault:${relationshipId}:1`)
  const recoveryWrappedMasterKey = await wrapBytes(recoveryKey, masterBytes, `recovery:${relationshipId}:1`)
  const record: VaultRecord = {
    id: relationshipId,
    relationshipId,
    pinSalt: bytesToBase64(salt),
    wrappedMasterKey,
    recoveryWrappedMasterKey,
    createdAt,
    updatedAt: createdAt,
    keyVersion: 1,
  }
  return { record, masterKey, recoveryCode: bytesToBase64(recoveryBytes) }
}

export async function createVault(pin: string, relationshipId: string) {
  return createVaultFromBytes(pin, relationshipId, randomBytes(32))
}

export async function createSharedVault(pin: string, relationshipId: string) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(`nuestra-historia:${relationshipId}:shared-v1`),
      iterations: PIN_ITERATIONS,
    },
    material,
    256,
  )
  return createVaultFromBytes(pin, relationshipId, new Uint8Array(bits))
}

export async function unlockVault(pin: string, record: VaultRecord) {
  const pinKey = await derivePinKey(pin, base64ToBytes(record.pinSalt))
  const bytes = await unwrapBytes(
    pinKey,
    record.wrappedMasterKey,
    `vault:${record.relationshipId}:${record.keyVersion}`,
  )
  return importMasterKey(bytes)
}

export async function recoverVault(recoveryCode: string, record: VaultRecord, newPin: string) {
  const recoveryKey = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(recoveryCode) as BufferSource,
    'AES-GCM',
    false,
    ['decrypt'],
  )
  const bytes = await unwrapBytes(
    recoveryKey,
    record.recoveryWrappedMasterKey,
    `recovery:${record.relationshipId}:${record.keyVersion}`,
  )
  const salt = randomBytes(16)
  const pinKey = await derivePinKey(newPin, salt)
  const wrappedMasterKey = await wrapBytes(
    pinKey,
    bytes,
    `vault:${record.relationshipId}:${record.keyVersion}`,
  )
  const updatedRecord = {
    ...record,
    pinSalt: bytesToBase64(salt),
    wrappedMasterKey,
    updatedAt: new Date().toISOString(),
  }
  const masterKey = await importMasterKey(bytes)
  return { record: updatedRecord, masterKey }
}

async function deriveContentKey(masterKey: CryptoKey, context: CryptoContext) {
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(context.relationshipId),
      info: encoder.encode(`nuestra-historia:${context.version}:${context.contentType}`),
    },
    masterKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptContent(
  masterKey: CryptoKey,
  value: unknown,
  context: CryptoContext,
): Promise<CryptoEnvelope> {
  const key = await deriveContentKey(masterKey, context)
  const iv = randomBytes(12)
  const plaintext = encoder.encode(JSON.stringify(value))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(context) },
    key,
    plaintext,
  )
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv), cryptoVersion: 1 }
}

export async function decryptContent<T>(
  masterKey: CryptoKey,
  envelope: CryptoEnvelope,
  context: CryptoContext,
): Promise<T> {
  const key = await deriveContentKey(masterKey, context)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) as BufferSource, additionalData: aad(context) },
    key,
    base64ToBytes(envelope.ciphertext) as BufferSource,
  )
  return JSON.parse(decoder.decode(plaintext)) as T
}

export async function encryptBinary(masterKey: CryptoKey, value: ArrayBuffer, context: CryptoContext) {
  const key = await deriveContentKey(masterKey, context)
  const iv = randomBytes(12)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(context) },
    key,
    value,
  )
  return { ciphertext: new Uint8Array(ciphertext), iv: bytesToBase64(iv), cryptoVersion: 1 as const }
}

export async function decryptBinary(
  masterKey: CryptoKey,
  ciphertext: ArrayBuffer,
  iv: string,
  context: CryptoContext,
) {
  const key = await deriveContentKey(masterKey, context)
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) as BufferSource, additionalData: aad(context) },
    key,
    ciphertext,
  )
}

export function createPairingSecret() {
  return bytesToBase64(randomBytes(32))
}

export async function createPairingEnvelope(
  masterKey: CryptoKey,
  pairingSecret: string,
  relationshipId: string,
) {
  const secret = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(pairingSecret) as BufferSource,
    'HKDF',
    false,
    ['deriveKey'],
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(relationshipId),
      info: encoder.encode('pairing:v1'),
    },
    secret,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
  const masterBytes = masterBytesByKey.get(masterKey)
  if (!masterBytes) throw new Error('master_key_material_unavailable')
  return wrapBytes(key, masterBytes, `pairing:${relationshipId}:1`)
}

export async function importPairingEnvelope(
  pairingSecret: string,
  envelope: CryptoEnvelope,
  relationshipId: string,
  pin: string,
) {
  const secret = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(pairingSecret) as BufferSource,
    'HKDF',
    false,
    ['deriveKey'],
  )
  const key = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(relationshipId),
      info: encoder.encode('pairing:v1'),
    },
    secret,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const masterBytes = await unwrapBytes(key, envelope, `pairing:${relationshipId}:1`)
  return createVaultFromBytes(pin, relationshipId, masterBytes)
}

export const cryptoInternals = { bytesToBase64, base64ToBytes }
