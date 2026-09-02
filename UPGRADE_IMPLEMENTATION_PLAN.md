# Plan incremental · Nuestra Historia + R2

Fecha: 2026-09-02. Especificación: `PROMPT_MAESTRO_CODEX_NUESTRA_HISTORIA_R2.md` proporcionada por el propietario.

## Estado y arquitectura de partida

- React 19 + TypeScript + Vite, React Router y Zustand. Biblioteca pública y rutas privadas existentes en `App.tsx`, `PublicPages.tsx` y `PrivatePages.tsx`.
- Supabase conserva autenticación, relaciones, Postgres/RLS, Realtime, funciones y Web Push. GitHub Pages conserva el alojamiento. No se crea otra aplicación ni se cambia de proveedor de base de datos.
- WebCrypto AES-GCM + HKDF cifra contenido y fotos; IndexedDB conserva bóveda, sesión, caché cifrada y cola offline. La entrada actual de seis dígitos y las relaciones existentes se conservan.
- Las fotos anteriores residen cifradas en el bucket privado `memories` de Supabase. Deben seguir leyéndose: R2 se aplicará a nuevas cargas sin migración destructiva.
- El acceso ya admite más de dos sesiones/dispositivos. No debe reintroducirse el límite.

## Riesgos y compatibilidad

1. No cambiar las derivaciones de claves, formatos antiguos, IDs o rutas. Un PIN de seis dígitos tiene poca entropía y no protege como una contraseña de alta entropía frente a ataques offline; se documentará sin prometer seguridad absoluta.
2. Migraciones SQL aditivas, RLS por relación y propietario, sin borrar mensajes, relaciones, fotos o suscripciones. Reutilizar recibos y reacciones existentes.
3. Actualización no destructiva de IndexedDB: conservar bóvedas y colas. El service worker no debe borrar mensajes pendientes.
4. Claves permanentes R2 solamente en Supabase Secrets. Ninguna en `VITE_*`, repositorio, logs o respuestas al cliente. Bucket privado, autorización de cada firma y CORS de orígenes concretos.
5. El navegador exige permiso del usuario para avisos; no se puede conceder automáticamente. iOS, Android y ahorro de batería pueden limitar la entrega y persistencia. No confundir notificación cerrada con mensaje leído.
6. No asumir que una sesión web autoriza nuevas compras, planes de pago o permisos amplios. Revisar la cuenta y solicitar cualquier decisión sensible que no esté cubierta.

## Fases de implementación

### 1. Datos y almacenamiento

- Añadir metadatos de adjuntos, cargas, preferencias, guardados y programación con RLS; reutilizar `message_receipts` y `message_reactions`.
- Crear funciones autenticadas para preparar/finalizar/subir/descargar/eliminar objetos R2. Validar tamaños, categorías, relación, propietario y estados. Firmas temporales y claves aleatorias.
- Cifrar medios y metadatos privados en el dispositivo, IV único y versión de formato. Mantener descarga de imágenes antiguas.
- Revisar bucket, CORS y credenciales de alcance mínimo; probar rechazo de acceso ajeno y descarga sin firma.

### 2. Chat y experiencia móvil

- Extraer el chat a un módulo mantenible conservando las demás herramientas.
- Añadir compositor multimedia, grabadora, stickers originales, respuestas, reacciones, favoritos, búsqueda local, estados de envío y lectura.
- Persistir borradores y cola cifrada, conciliar IDs y reintentar; lectura basada en visibilidad real y contadores por usuario.
- Menú agrupado de una mano y tokens accesibles Pantone 2597 C digital `#5C068C`, con modo oscuro y movimiento reducido.

### 3. Notificaciones y operación

- Preferencias y diagnóstico, renovación multi-dispositivo, prueba real desde backend, payload discreto sin contenido privado.
- Mejorar service worker: enlace a conversación/mensaje, marcas de tiempo, deduplicación y badges cuando exista soporte. No marcar leído desde push.
- Programación/recordatorios con límites, silencio y cancelación al leer. Activar automatismos únicamente si la infraestructura queda configurada y comprobada.

### 4. Verificación y entrega

- Ejecutar lint, TypeScript, pruebas unitarias, compilación y pruebas de navegador. Añadir pruebas de cifrado, validación, permisos y regresión según los cambios.
- Verificar migraciones y funciones en Supabase y carga/lectura R2 cuando las credenciales estén disponibles. No presentar pruebas simuladas como pruebas de producción.
- Actualizar documentación requerida y `CHANGELOG.md`, enumerando implementado, comprobado y cualquier límite o pendiente real.
- Publicar por el flujo GitHub existente una vez superadas las comprobaciones y revisar la versión publicada.

## Funciones y archivos previstos

Nuevos módulos bajo `src/features/chat` y `src/lib/media`; funciones bajo `supabase/functions/r2-*`; migración SQL aditiva posterior a `006`; ajustes focalizados de navegación, tema, almacenamiento local, push y repositorio privado.

Documentos: `R2_STORAGE.md`, `R2_SECURITY.md`, `R2_SETUP.md`, `CHAT_ARCHITECTURE.md`, `MEDIA_ENCRYPTION.md`, `NOTIFICATIONS.md`, `NOTIFICATION_TROUBLESHOOTING.md`, `STICKERS.md`, `PWA_IOS_GUIDE.md`, `PWA_ANDROID_GUIDE.md`, `TESTING.md`, `CHANGELOG.md`.

## Criterio de cierre

No basta compilar. Indicar pruebas realmente ejecutadas, servicios desplegados, configuración comprobada y limitaciones de dispositivos físicos. Si faltan credenciales, decisiones o funciones de la especificación, deben quedar explícitas; no afirmar que todo quedó terminado.

## Estado de implementación y conexión

Fases 1–3 implementadas, con límites concretos en TESTING.md. Tras la autorización expresa del propietario, se creó la credencial limitada, se guardó en Supabase Secrets y se desplegaron la migración y nueve funciones. La tarea del servidor quedó activa. Fase 4: pruebas locales, de seguridad SQL y conexión real R2/Realtime; entrega por el workflow GitHub Pages existente. Push físico, formatos en teléfonos y los límites de funcionalidad documentados no se presentan como certificados.
