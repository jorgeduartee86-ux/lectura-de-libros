import { describe, expect, it } from 'vitest'
import { canMarkRead, filterMessages, reconcileMessages, type ChatMessage } from './model'
import { stickers } from './stickers'
const message = (id: string, senderId = 'me', text = 'Hola'): ChatMessage =>
  ({
    id,
    senderId,
    text,
    table: 'messages',
    createdAt: `2026-09-02T10:00:0${id}.000Z`,
    content: { text },
  }) as ChatMessage
describe('chat compatible y estable', () => {
  it('ordena y deduplica por identidad', () => {
    const a = message('1'),
      b = message('2')
    expect(reconcileMessages([b, a, a], 'me').map((m) => m.id)).toEqual(['1', '2'])
  })
  it('respeta ediciones antiguas propias y rechaza edición de otro usuario', () => {
    const a = message('1'),
      edit = {
        ...message('2', 'other'),
        content: { text: 'alterado', event: 'edit' as const, targetId: '1' },
      }
    expect(reconcileMessages([a, edit], 'me')[0].content.text).toBe('Hola')
    expect(reconcileMessages([a, { ...edit, senderId: 'me' }], 'me')[0].content.text).toBe('alterado')
  })
  it('ocultar para mí no oculta el mensaje a otra persona', () => {
    const a = message('1'),
      hide = { ...message('2'), content: { text: '', event: 'delete-self' as const, targetId: '1' } }
    expect(reconcileMessages([a, hide], 'me')).toHaveLength(0)
    expect(reconcileMessages([a, hide], 'other')).toHaveLength(1)
  })
  it.each([
    [false, true, true, false],
    [true, false, true, false],
    [true, true, false, false],
    [true, true, true, true],
  ])('no lee si falta alguna condición', (...args) => {
    expect(canMarkRead(...(args as [boolean, boolean, boolean, boolean]))).toBe(false)
  })
  it('solo lee un mensaje recibido visible con la app activa', () =>
    expect(canMarkRead(true, true, true, false)).toBe(true))
  it('busca localmente por texto, tipo, autor, fecha y guardados', () => {
    const a = message('1', 'me', 'Te mando una foto'),
      b = message('2', 'other', 'Hola')
    a.content.attachments = [
      { id: 'file', kind: 'image', name: 'juntos.webp', size: 123, mime: 'image/webp' },
    ]
    expect(
      filterMessages(
        [a, b],
        { query: 'juntos', kind: 'image', sender: 'me', date: '2026-09-02', starsOnly: true },
        'me',
        new Set(['1']),
      ),
    ).toEqual([a])
  })
  it('incluye los 26 stickers originales sin IDs duplicados', () => {
    expect(stickers).toHaveLength(26)
    expect(new Set(stickers.map((s) => s.id)).size).toBe(stickers.length)
  })
})
