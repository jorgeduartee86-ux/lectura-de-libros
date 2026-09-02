import { useCallback, useEffect, useState } from 'react'
import { Cloud, HardDrive, Image, RefreshCw, Trash2 } from 'lucide-react'
import { Notice } from '../../components/ui'
import { decryptContent } from '../../lib/crypto'
import { getPrivateSession } from '../../lib/privateRepository'
import { clearSensitiveCache, listMediaJobs, removeMediaJob } from '../../lib/storage'
import { edgeCall, mediaContext } from '../../lib/media/repository'
import { sizeLabel } from '../../lib/media/files'
import type { MediaManifest } from '../../lib/media/types'
import { supabase } from '../../lib/supabase'
type Stored = {
  id: string
  owner_id: string
  kind: string
  plain_size: number
  state: string
  created_at: string
  references: number
  name: string
}
export function StoragePage() {
  const [files, setFiles] = useState<Stored[]>([]),
    [pending, setPending] = useState(0),
    [estimate, setEstimate] = useState(0),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const { userId, relationshipId, masterKey } = getPrivateSession()
  const load = useCallback(async () => {
    const jobs = (await listMediaJobs()).filter(
      (job) => job.userId === userId && job.relationshipId === relationshipId,
    )
    setPending(jobs.length)
    if (navigator.storage?.estimate) setEstimate((await navigator.storage.estimate()).usage ?? 0)
    if (!supabase || relationshipId.startsWith('local-')) return
    const { data, error } = await supabase
      .from('media_attachments')
      .select('*')
      .eq('relationship_id', relationshipId)
      .not('state', 'in', '(deleted,aborted)')
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) {
      setError('No se pudo consultar el almacenamiento.')
      return
    }
    const { data: refs } = await supabase.from('media_references').select('attachment_id')
    const { data: stickers } = await supabase.from('custom_stickers').select('id').eq('user_id', userId)
    const result = await Promise.all(
      (data ?? []).map(async (row) => {
        let name = 'Archivo cifrado'
        try {
          name = (
            await decryptContent<MediaManifest>(
              masterKey,
              { ciphertext: row.ciphertext, iv: row.iv, cryptoVersion: 1 },
              mediaContext({
                id: row.id,
                userId: row.owner_id,
                relationshipId,
                logicalTimestamp: row.logical_timestamp,
              }),
            )
          ).name
        } catch {
          /* damaged metadata does not break the list */
        }
        return {
          ...row,
          name,
          references:
            (refs ?? []).filter((ref) => ref.attachment_id === row.id).length +
            (stickers?.some((sticker) => sticker.id === row.id) ? 1 : 0),
        } as Stored
      }),
    )
    setFiles(result)
  }, [userId, relationshipId, masterKey])
  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])
  const remove = async (file: Stored) => {
    if (
      !window.confirm(
        `¿Eliminar el archivo sin referencias «${file.name}»? Esta acción no se puede deshacer.`,
      )
    )
      return
    try {
      await edgeCall('r2-delete-object', { id: file.id })
      await removeMediaJob(file.id)
      await load()
      setNotice('Archivo propio eliminado del almacenamiento.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar.')
    }
  }
  return (
    <main className="private-page storage-page">
      <header className="private-page-heading">
        <div>
          <p className="private-eyebrow">LO QUE CONSERVAMOS</p>
          <h1>Nuestro espacio</h1>
          <p>Archivos cifrados. Recuerdos a salvo.</p>
        </div>
        <button className="icon-button" aria-label="Actualizar archivos" onClick={() => void load()}>
          <RefreshCw />
        </button>
      </header>
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}
      <div className="storage-summary">
        <article>
          <Cloud />
          <strong>{sizeLabel(files.reduce((sum, file) => sum + file.plain_size, 0))}</strong>
          <span>Multimedia visible en R2</span>
        </article>
        <article>
          <HardDrive />
          <strong>{sizeLabel(estimate)}</strong>
          <span>Uso local estimado</span>
        </article>
        <article>
          <Image />
          <strong>{pending}</strong>
          <span>Cargas locales pendientes</span>
        </article>
      </div>
      <section className="settings-card notification-card">
        <h2>Por tipo</h2>
        <div className="storage-types">
          {[
            ['image', 'Fotos'],
            ['video', 'Videos'],
            ['audio', 'Audios'],
            ['document', 'Documentos'],
            ['sticker', 'Stickers'],
          ].map(([kind, label]) => (
            <span key={kind}>
              {label}
              <strong>
                {sizeLabel(
                  files.filter((file) => file.kind === kind).reduce((sum, file) => sum + file.plain_size, 0),
                )}
              </strong>
            </span>
          ))}
        </div>
        <button
          className="private-secondary"
          onClick={async () => {
            await clearSensitiveCache()
            setNotice(
              'Caché de mensajes eliminada. La bóveda, los borradores y todas las cargas pendientes se conservaron.',
            )
            await load()
          }}
        >
          Limpiar caché local de mensajes
        </button>
        <small>Las fotos anteriores siguen en Supabase y no se borran ni se incluyen en estos totales.</small>
      </section>
      <section className="settings-card notification-card">
        <h2>Archivos y cargas</h2>
        <p>
          Los archivos en uso se eliminan desde su mensaje. Los archivos propios sin referencias pueden
          limpiarse aquí.
        </p>
        <div className="storage-file-list">
          {files.map((file) => (
            <article key={file.id}>
              <FileIcon kind={file.kind} />
              <div>
                <strong>{file.name}</strong>
                <small>
                  {sizeLabel(file.plain_size)} ·{' '}
                  {file.state === 'uploading'
                    ? 'Carga incompleta'
                    : file.references
                      ? `${file.references} referencia(s)`
                      : 'Sin referencias'}{' '}
                  · {new Date(file.created_at).toLocaleDateString('es-CO')}
                </small>
              </div>
              {file.owner_id === userId && file.references === 0 && (
                <button
                  aria-label={`Eliminar ${file.name}`}
                  className="icon-button"
                  onClick={() => void remove(file)}
                >
                  <Trash2 />
                </button>
              )}
            </article>
          ))}
        </div>
        {!files.length && <p>Aún no hay archivos nuevos en R2.</p>}
      </section>
    </main>
  )
}
function FileIcon({ kind }: { kind: string }) {
  return (
    <span className="storage-file-icon" aria-label={kind}>
      <Cloud />
    </span>
  )
}
