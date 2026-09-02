# Seguridad de R2

## Controles implementados

- JWT comprobado con Supabase Auth `getUser`, no únicamente decodificado.
- Relación activa comprobada en cada operación.
- Nunca aceptar bucket, object key ni upload ID arbitrarios del cliente.
- Ruta generada y validada: `relationships/{uuid}/media/{year}/{month}/{uuid}.bin`.
- Metadatos de carga solo mutables por funciones del servidor.
- MIME permitido, tamaño centralizado, extensión validada en cliente y comprobación básica de firmas PDF/ejecutables. No se afirma disponer de antivirus: E2EE impide al servidor analizar el contenido.
- Firmas temporales, tamaño de cada parte firmado y tamaño final verificado con HEAD.
- Descarga de material ajeno solo dentro de la relación y si está referenciado.
- Borrado con bloqueo SQL de la fila y comprobación de referencias, incluidas bibliotecas de stickers.
- Límites por usuario y máximo de sesiones incompletas.
- RLS y privilegios mínimos explícitos en las nueve tablas nuevas.
- Mensajes de error reducidos a códigos conocidos; no registrar URLs firmadas ni claves.

## Secretos

Las cinco variables R2 están únicamente en Supabase Secrets. Nunca usar prefijo VITE para ellas. La credencial creada con autorización del propietario permite lectura/escritura de objetos solo en este bucket, sin administración de cuenta. Se guardó directamente en el servidor y no en archivos del proyecto.

Una URL prefirmada permite operar a quien la posea hasta que venza. CORS no sustituye autorización ni revoca una firma. No compartirla, guardarla en notificaciones o incluirla en analítica. [Cloudflare: URLs prefirmadas](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

## Límites de privacidad

La relación, remitente, tipo, tamaño y tiempos son metadatos visibles al backend. El contenido y nombres privados van cifrados. Se conserva el sistema de clave existente: un PIN de seis dígitos tiene poca entropía frente a ataques offline. Esto no equivale a un protocolo con forward secrecy, verificación de identidad fuera de banda o auditoría criptográfica independiente. No se ha reemplazado silenciosamente la clave del usuario.

Un receptor que ya descargó un archivo puede conservar una copia. Borrar del servidor no borra capturas o descargas externas.
