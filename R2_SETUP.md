# Configuración de R2 y publicación

## Hecho el 2 de septiembre de 2026

- Bucket `nuestra-historia-media` creado en la cuenta Cloudflare abierta por el propietario.
- Acceso público y dominio público desactivados.
- CORS guardado para:
  - https://jorgeduartee86-ux.github.io
  - http://localhost:5173
  - http://127.0.0.1:5173
- Métodos GET, PUT, HEAD; cabeceras Content-Type, Range, Content-Length; expuestas ETag, Content-Length, Content-Range; duración 300 segundos.
- Sin compra de planes, sin habilitar Workers Paid y sin cambiar servicios existentes.

El origen CORS no incluye la ruta /lectura-de-libros/. [Documentación oficial de CORS](https://developers.cloudflare.com/r2/buckets/cors/).

## Conexión realizada con autorización del propietario

La credencial con lectura/escritura de objetos exclusivamente en `nuestra-historia-media` se creó y guardó directamente en Supabase Secrets del proyecto `rwdnklbsfpsusdwyetxt`. No se copiaron claves al repositorio, frontend, archivos temporales ni conversación. El propietario no necesita conectar servicios manualmente.

Variables del servidor:

- R2_ACCOUNT_ID: ID de la cuenta verificada en Cloudflare.
- R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY: credencial limitada.
- R2_BUCKET: nuestra-historia-media.
- R2_ENDPOINT: https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com.

## Backend desplegado

1. Cinco variables R2 guardadas. VAPID y CRON_SECRET existentes conservados.
2. Migración 202609020007 aplicada con Supabase CLI. Se verificó el esquema heredado y se registraron las migraciones 001–006 ya existentes, cuyo historial no estaba creado; no se volvieron a ejecutar.
3. Desplegadas r2-create-upload-url, r2-complete-upload, r2-create-download-url, r2-delete-object, r2-abort-upload, chat-delete-message, register-push, send-push y process-chat-jobs.
4. Activa una sola tarea `chat-jobs-every-minute` con pg_cron + pg_net. Su encabezado x-cron-secret se obtiene de Vault sin exportarlo. Respuesta HTTP 200 comprobada. Las tareas anteriores de citas e invitaciones permanecen activas.
5. Integración real mediante usuarios y archivos sintéticos aislados: resultados en TESTING.md.
6. Frontend distribuido mediante el workflow GitHub Pages existente. Comprobar su resultado en [GitHub Actions](https://github.com/jorgeduartee86-ux/lectura-de-libros/actions).

No hay que reinstalar ni borrar los datos de la app. Al recibir el aviso de nueva versión, actualizar y volver a introducir la clave habitual. El permiso de notificaciones debe concederse una vez en cada dispositivo desde Ajustes → Notificaciones.
