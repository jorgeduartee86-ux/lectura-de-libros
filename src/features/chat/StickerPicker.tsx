import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { getSetting, putSetting } from '../../lib/storage'
import { Modal } from '../../components/ui'
import { stickerGroups, stickers } from './stickers'
import { listCustomStickers, type CustomSticker } from './customStickers'
import { MediaBubble } from './MediaBubble'
import { supabase } from '../../lib/supabase'
import type { MediaRef } from '../../lib/media/types'

export function StickerArt({ id, small = false }: { id: string; small?: boolean }) {
  const sticker = stickers.find((s) => s.id === id)
  if (!sticker) return <span>Sticker</span>
  const lines =
    sticker.label.length > 19 ? sticker.label.replace(/ (\S+)$/, '\n$1').split('\n') : [sticker.label]
  return (
    <svg
      className={`romantic-sticker ${small ? 'small' : ''}`}
      viewBox="0 0 200 160"
      role="img"
      aria-label={sticker.label}
    >
      <path
        d="M100 111C80 94 34 77 41 47C46 24 80 20 100 44C120 20 154 24 159 47C166 77 120 94 100 111Z"
        fill={sticker.index % 2 ? '#5C068C' : '#7A26A8'}
        stroke="#fff"
        strokeWidth="5"
      />
      <path
        d="M57 53Q62 38 77 44M142 75L151 83M31 28L34 40M26 34L39 34M164 106L170 118M162 115L174 109"
        stroke="#C394DC"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={
          sticker.category === 'Día y noche'
            ? 'M118 48A18 18 0 1 0 133 77A21 21 0 0 1 118 48'
            : 'M81 69Q100 88 119 69'
        }
        stroke="#fff"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      {lines.map((line, i) => (
        <text
          key={line}
          x="100"
          y={lines.length > 1 ? 127 + i * 21 : 136}
          textAnchor="middle"
          fontSize="17"
          fontFamily="system-ui,sans-serif"
          fontWeight="750"
          fill="#5C068C"
          stroke="#fff"
          strokeWidth="5"
          paintOrder="stroke"
        >
          {line}
        </text>
      ))}
    </svg>
  )
}
export function StickerPicker({
  onSelect,
  onClose,
  onCustom,
  onCustomSelect,
}: {
  onSelect: (id: string) => void
  onClose: () => void
  onCustom: () => void
  onCustomSelect: (media: MediaRef) => void
}) {
  const [category, setCategory] = useState('Amor'),
    [query, setQuery] = useState(''),
    [favorites, setFavorites] = useState<string[]>([]),
    [recent, setRecent] = useState<string[]>([])
  useEffect(() => {
    void Promise.all([
      getSetting<string[]>('sticker-favorites'),
      getSetting<string[]>('sticker-recents'),
    ]).then(([f, r]) => {
      setFavorites(f ?? [])
      setRecent(r ?? [])
    })
  }, [])
  const [custom, setCustom] = useState<CustomSticker[]>([])
  useEffect(() => {
    void listCustomStickers()
      .then(setCustom)
      .catch(() => {})
  }, [])
  const select = (id: string) => {
    const next = [id, ...recent.filter((x) => x !== id)].slice(0, 16)
    void putSetting('sticker-recents', next)
    onSelect(id)
  }
  return (
    <Modal title="Un gesto entre páginas" onClose={onClose}>
      <input
        className="chat-search-input"
        aria-label="Buscar sticker"
        placeholder="Busca un gesto…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="sticker-tabs" role="group" aria-label="Categorías de stickers">
        {['Recientes', 'Favoritos', 'Mis stickers', ...Object.keys(stickerGroups)].map((c) => (
          <button key={c} className={c === category ? 'selected' : ''} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      {(category === 'Mis stickers' || category === 'Favoritos') && (
        <div className="custom-sticker-grid">
          {custom
            .filter(
              (s) =>
                (category !== 'Favoritos' || s.favorite) &&
                s.media.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
            )
            .map((s) => (
              <article key={s.media.id}>
                <MediaBubble media={s.media} />
                <button className="private-secondary" onClick={() => onCustomSelect(s.media)}>
                  Enviar sticker
                </button>
                <button
                  aria-label="Favorito personalizado"
                  aria-pressed={s.favorite}
                  onClick={async () => {
                    const result = await supabase
                      ?.from('custom_stickers')
                      .update({ favorite: !s.favorite })
                      .eq('id', s.media.id)
                    if (!result?.error)
                      setCustom((current) =>
                        current.map((item) =>
                          item.media.id === s.media.id ? { ...item, favorite: !item.favorite } : item,
                        ),
                      )
                  }}
                >
                  <Star size={16} fill={s.favorite ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={async () => {
                    if (
                      !window.confirm(
                        '¿Quitar este sticker de tu colección? Los mensajes enviados se conservan.',
                      )
                    )
                      return
                    const result = await supabase?.from('custom_stickers').delete().eq('id', s.media.id)
                    if (!result?.error)
                      setCustom((current) => current.filter((item) => item.media.id !== s.media.id))
                  }}
                >
                  Quitar
                </button>
              </article>
            ))}
        </div>
      )}
      <div className="sticker-grid">
        {stickers
          .filter((s) =>
            query
              ? s.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())
              : category === 'Favoritos'
                ? favorites.includes(s.id)
                : category === 'Recientes'
                  ? recent.includes(s.id)
                  : s.category === category,
          )
          .map((s) => (
            <div key={s.id}>
              <button
                className="sticker-send"
                title={`Enviar ${s.label}`}
                aria-label={`Enviar sticker: ${s.label}`}
                onClick={() => select(s.id)}
              >
                <StickerArt id={s.id} />
              </button>
              <button
                className="sticker-favorite"
                aria-label={`${favorites.includes(s.id) ? 'Quitar de' : 'Añadir a'} favoritos: ${s.label}`}
                aria-pressed={favorites.includes(s.id)}
                onClick={() => {
                  const next = favorites.includes(s.id)
                    ? favorites.filter((f) => f !== s.id)
                    : [...favorites, s.id]
                  setFavorites(next)
                  void putSetting('sticker-favorites', next)
                }}
              >
                <Star size={16} fill={favorites.includes(s.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
          ))}
      </div>
      <button className="private-secondary" onClick={onCustom}>
        Crear sticker con una foto
      </button>
    </Modal>
  )
}
