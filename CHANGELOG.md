# Cambios

## 1.2.0 — 2026-09-02 — Chat multimedia + R2

Conexión R2 autorizada y configurada. Backend desplegado y comprobado con sesiones aisladas; publicación del frontend mediante GitHub Pages. Las comprobaciones en teléfonos físicos y los límites concretos están detallados en TESTING.md.

### Implementado

- Chat modular, diseño Pantone digital, menú agrupado móvil, modo claro/oscuro.
- Texto offline persistente, borradores cifrados, recibos visibles, unread, búsqueda, guardados y fijado.
- Fotos/videos/documentos/audio, notas de voz, preview, progreso, cancelación/reintento, preparación cifrada por partes.
- Stickers originales y biblioteca cifrada de personalizados.
- Respuestas, reacciones, edición propia, ocultar para mí y eliminación para ambos.
- Preferencias push, diagnóstico, registro multidispositivo, trabajos duraderos y recordatorios limitados.
- Frase compartida, accesos románticos y compatibilidad de fotos antiguas.
- Migración SQL aditiva y nueve funciones nuevas/actualizadas de almacenamiento y entrega.
- Actualización PWA con aviso y colas preservadas.

### Infraestructura verificada

Bucket R2 privado y CORS restringido; credencial limitada guardada directamente en Supabase Secrets. Migración 007 aplicada sin reemplazar datos, nueve funciones desplegadas y tarea de mensajes/avisos activa cada minuto. Se conservaron VAPID, las tareas anteriores y los 27 mensajes existentes. Sin cambios de plan. Las cuentas y objetos sintéticos de validación se eliminan después de las pruebas.

### Inventario

Frontend: App, PrivatePages, AccessCodePanel, NotificationOnboarding, ui, lib/storage, lib/privateRepository, lib/images, lib/notifications, types, features/chat, lib/media y worker push.

Servidor: migración 202609020007_chat_media; funciones r2-create-upload-url, r2-complete-upload, r2-create-download-url, r2-delete-object, r2-abort-upload, chat-delete-message, register-push, process-chat-jobs y send-push; utilidades compartidas y config.

Pruebas: modelo, cifrado/media, política push, chat-upgrade E2E y SQL RLS/pgTAP. CI conserva GitHub Pages y añade configuración pública para pruebas del chat.

Consulta TESTING.md para resultados, pendientes y limitaciones; R2_SETUP.md para el orden seguro de despliegue.

## Historial anterior

### 1.1.0 — 2026-08-31

- Instalación Android mediante captura persistente del aviso PWA y guía de Chrome.
- Acceso de seis cifras sin correo; identidades anónimas y clave compartida derivada localmente.
- Rediseño de portada, entrada y conversación; pruebas móviles.

### 1.0.0 — 2026-08-31

- PWA React/Vite/TypeScript con biblioteca, notas, citas, autores y estadísticas.
- Autenticación invitada, relación originalmente limitada a dos, consentimiento y recuperación.
- AES-GCM/HKDF, emparejamiento y outbox cifrado.
- Conversación, señales, cartas, preguntas, libro, juegos, citas, recuerdos, universo y regalos.
- Supabase/RLS/Realtime/Storage/Edge Functions/Web Push y CI con pruebas.
