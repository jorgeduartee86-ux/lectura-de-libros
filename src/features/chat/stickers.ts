export const stickerGroups = {
  Amor: ['Te amo', 'Me encantas', 'Te extraño', 'Pienso en ti', 'Beso', 'Abrazo', 'Corazón'],
  Nosotros: ['Tú + yo', 'Siempre nosotros', 'Nuestro capítulo', 'Nuestra historia', 'Te elegiría otra vez'],
  Coquetos: ['Ven acá', 'Dame un beso', 'Quiero verte', 'Repórtate', 'Estoy pensando en ti'],
  'Día y noche': ['Buenos días amor', 'Buenas noches', 'Sueña conmigo', 'Que tengas un lindo día'],
  Reacciones: ['Me hiciste sonreír', 'Awww', 'Estoy feliz', 'Te leo', 'Cuéntame más'],
} as const
export const stickers = Object.entries(stickerGroups).flatMap(([category, labels]) =>
  labels.map((label, index) => ({ id: `${category}-${index}`, label, category, index })),
)
