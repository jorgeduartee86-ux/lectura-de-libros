# Verificación de la actualización

Versión 1.2.0. Backend R2/Supabase desplegado y conexión real verificada el 2026-09-02. El frontend se publica con las comprobaciones del workflow GitHub Pages; su resultado queda en GitHub Actions.

## Ejecutado

- npm run lint, npm run typecheck, npm run test y npm run build: pasaron en la revisión final.
- 30 pruebas unitarias pasaron, incluida la regresión de limpieza de caché/outbox sin llamadas de red.
- npm run test:coverage pasó: crypto.ts alcanzó 98,66% de sentencias, 100% de líneas/funciones y 50% de ramas; esto NO es cobertura de toda la aplicación.
- 18 pruebas de navegador pasaron (escritorio y Pixel 7 emulado), con Supabase simulado y Web Crypto real. Cubren navegación pública, acceso, texto offline/reconexión, no texto plano en solicitudes, respuesta, stickers, menú, borrador tras bloqueo, ausencia de overflow, mensaje recibido en Ajustes sin lectura automática, tema oscuro y frase compartida.
- Migración 007 validada primero con ROLLBACK y aplicada después mediante Supabase CLI, conservando el historial. Las migraciones heredadas 001–006 se verificaron y registraron, sin volver a ejecutarlas.
- 19 comprobaciones pgTAP de esquema/privilegios/RLS sobre el esquema desplegado, más un fixture transaccional de aislamiento entre relaciones, unread, recibos y cancelación de avisos. Las comprobaciones temporales se revierten.
- Deno check pasó para las cinco entradas que cubren R2, push, jobs, registro y borrado.
- npm ci y auditoría: cero vulnerabilidades reportadas.
- Cloudflare: bucket privado y CORS guardado, comprobados en UI y mediante solicitudes reales desde el origen de la app. Cinco variables R2 guardadas exclusivamente en Supabase Secrets.
- Nueve funciones desplegadas. Cron cada minuto activo con respuesta HTTP 200, sin reemplazar VAPID ni las tareas anteriores.
- 36 comprobaciones reales de integración: sesión multipart de 6 MiB + 37 bytes, AES-GCM por dos partes, CORS, interrupción/reanudación, finalización idempotente, rangos y descifrado exacto, rechazo de tamaño/MIME, objeto sin acceso público, aislamiento de tercero y de material no enviado, referencias transaccionales, unread/lectura, Realtime entre dos sesiones, aborto, expiración real de firma tras cinco minutos, publicación programada por cron y borrado del objeto propio.
- La prueba Realtime espera el aviso «Subscribed to PostgreSQL», no solo la apertura del canal. [Protocolo oficial de Supabase](https://supabase.com/docs/guides/realtime/protocol).
- Prueba real del acceso de seis cifras con una clave deliberadamente incorrecta: JWT ES256 aceptado por el servidor y clave rechazada correctamente, sin entrar en la conversación del propietario.
- Se eliminaron los objetos y cuentas temporales de integración. Se conservaron los 27 mensajes previos y 0 recuerdos. Comprobación del bundle sin identificadores de claves privadas del servidor y git diff --check sin errores de espacios.
- División del cliente Supabase en un archivo separado; compilación final sin aviso de chunks mayores de 500 kB.

## No confundir con pruebas reales

Las 18 pruebas E2E de interfaz simulan respuestas del backend. Las 36 comprobaciones de integración son independientes, contra R2/Supabase reales, con cuentas aisladas y credenciales solo en memoria. No certifican visualización push, cámara, grabación ni reproducción en teléfonos físicos.

## Comprobaciones pendientes en dispositivos

- Archivos multimedia reales de cámara/galería: compatibilidad de formatos, reproducción de videos/audios grandes y memoria en cada modelo de teléfono. La integración R2 prueba bytes cifrados, no todos los codecs físicos.
- Dos teléfonos reales: editar, reaccionar, cargar historia, fijar, guardar y respuestas a carta/señal. Texto y referencias ya se comprobaron entre sesiones de API reales; acciones de interfaz están cubiertas parcialmente con backend simulado.
- Notificaciones reales: suscripción, endpoint inválido, multidispositivo, clic, badge, lectura en otra pantalla, recordatorios, silencio y lectura simultánea.
- iPhone y Android físicos: instalación, teclado, safe area, cámara, galería, formatos de grabación y consumo de memoria.
- Auditoría de accesibilidad completa (no afirmar certificación WCAG por pruebas parciales).
- No interpretar una respuesta HTTP del proveedor push como prueba de que un teléfono mostró la notificación.

## Límites de implementación que requieren seguimiento

- Búsqueda sobre mensajes cargados, con límite remoto actual de 1000; no archivo ilimitado.
- Blob final de video completo bajo demanda; no streaming descifrado continuo.
- Sin caché LRU de medios descargados: evita texto claro persistente pero puede repetir descargas.
- Zoom con control y zoom nativo; no gesto pinch personalizado.
- Recorte centrado; sin eliminación de fondo.
- Sonido/vibración opcionales implementados; reproducción local sujeta a autoplay del navegador, sin prueba en teléfonos físicos.
- La navegación a carta/señal señala su tarjeta cargada; no carga automática de registros muy antiguos fuera de la ventana.
