import { decryptContent } from '../../lib/crypto'
import { getPrivateSession } from '../../lib/privateRepository'
import { mediaContext } from '../../lib/media/repository'
import { supabase } from '../../lib/supabase'
import type { MediaManifest, MediaRef } from '../../lib/media/types'
export interface CustomSticker {
  media: MediaRef
  favorite: boolean
}
export async function listCustomStickers(): Promise<CustomSticker[]> {
  if (!supabase) return []
  const { masterKey, userId, relationshipId } = getPrivateSession()
  const { data } = await supabase
    .from('custom_stickers')
    .select('id,favorite')
    .eq('user_id', userId)
    .eq('relationship_id', relationshipId)
    .limit(100)
  if (!data?.length) return []
  const { data: media } = await supabase
    .from('media_attachments')
    .select('*')
    .in(
      'id',
      data.map((s) => s.id),
    )
    .eq('state', 'ready')
  const decoded = await Promise.allSettled(
    (media ?? []).map(async (row) => {
      const manifest = await decryptContent<MediaManifest>(
        masterKey,
        { ciphertext: row.ciphertext, iv: row.iv, cryptoVersion: 1 },
        mediaContext({
          id: row.id,
          userId: row.owner_id,
          relationshipId,
          logicalTimestamp: row.logical_timestamp,
        }),
      )
      return {
        media: {
          id: manifest.id,
          kind: manifest.kind,
          name: manifest.name,
          size: manifest.size,
          mime: manifest.mime,
        },
        favorite: data.find((s) => s.id === row.id)?.favorite ?? false,
      }
    }),
  )
  return decoded
    .filter((r): r is PromiseFulfilledResult<CustomSticker> => r.status === 'fulfilled')
    .map((r) => r.value)
}
