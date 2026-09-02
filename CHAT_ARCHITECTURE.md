# Arquitectura incremental del chat

## Organización

`src/features/chat` separa modelo, repositorio, actividad, presencia, compositor, mensajes virtualizados, medios, stickers, voz, almacenamiento y preferencias. PrivatePages conserva las herramientas anteriores y reutiliza ChatPage para la conversación. App añade Momentos guardados, Almacenamiento y Notificaciones, sin cambiar rutas antiguas.

La interfaz mantiene Biblioteca / Nuestra Historia, con aproximación digital Pantone 2597 C #5C068C, variables semánticas, modo claro/oscuro, focus visible y movimiento reducido. El menú agrupa las herramientas existentes.

## Mensajes y actividad

- Inserción optimista con UUID estable y copia cifrada persistida antes de red.
- Cola offline idempotente, reintentos con backoff y conciliación por ID.
- Polling como respaldo de Realtime; cambios remotos nunca son la única copia.
- Estado pendiente/enviado/entregado/leído/fallido. Entregado significa cargado por un cliente receptor, no entrega push.
- Leído exige conversación enfocada, documento visible y al menos 50% de la burbuja en viewport durante 650 ms.
- RPC unread se calcula por usuario a partir de mensajes y recibos protegidos por RLS.
- Nunca marcar leído en push, Realtime o por abrir otra herramienta.
- Edición propia conserva contexto de cifrado. Borrado para ambos es una lápida; ocultar para mí conserva compatibilidad con eventos anteriores.
- Borradores y referencias se cifran en IndexedDB; limpiar caché no elimina outbox, borradores o cargas.
- Búsqueda local por texto, tipo, fecha, remitente y favoritos. Solo sobre mensajes cargados; actualmente carga progresiva hasta 1000 y caché local. No se anuncia búsqueda ilimitada de todo el archivo.
- Frase compartida cifrada como evento message-motto, excluida de contadores y push.
- Respuestas a mensajes multimedia; cartas y señales preparan un borrador cifrado y enlazan al registro original.
- Virtualización a partir de 100 mensajes, separadores, posición recordada y salto a nuevos/último.

## Migración 007

Añade media_attachments, media_references, custom_stickers, starred_messages, pinned_messages, user_notification_settings, scheduled_messages, push_jobs y push_job_deliveries. Reutiliza recibos, reacciones, dispositivos y suscripciones. Añade IDs de adjuntos y lápida a mensajes; conserva ciphertext antiguo y claves.

Lectura de medios requiere relación y referencia o propiedad. Los paths, finalización de cargas, colas push y publicación programada son exclusivamente del servidor.

## Límites pendientes

No hay llamadas, ubicación ni rastreo. R2 y Realtime se comprueban con sesiones reales aisladas; push visible en teléfonos físicos sigue pendiente. Descarga de videos bajo demanda en partes, pero el Blob final puede ocupar hasta el límite de 100 MiB; no es streaming descifrado continuo. No hay caché cifrada LRU de medios descargados. Ver TESTING.md.
