import type { CryptoEnvelope } from '../../types'
import type { MediaKind } from '../../../supabase/functions/_shared/media-policy'
export type { MediaKind }
export interface MediaRef {
  id: string
  kind: MediaKind
  name: string
  size: number
  mime: string
  thumbnail?: MediaRef
  duration?: number
}
export interface MediaManifest extends MediaRef {
  version: 1
  chunks: { iv: string; size: number }[]
}
export interface MediaJob {
  id: string
  relationshipId: string
  userId: string
  kind: MediaKind
  mime: string
  size: number
  envelope: CryptoEnvelope
  logicalTimestamp: string
  createdAt: number
  state: 'queued' | 'uploading' | 'ready' | 'failed'
  error?: string
}
