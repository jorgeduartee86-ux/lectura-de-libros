# Seguridad

## Principios

- Denegar por defecto en PostgreSQL y autorizar por relación activa.
- Cifrar antes de red, disco remoto o cola offline.
- Mantener la clave maestra solo en memoria y una copia envuelta en IndexedDB.
- Validar payloads en interfaz, Edge Function, constraints SQL y RLS.
- No registrar contenido, claves, PIN, ciphertext ni tokens de invitación.

## Reportar una vulnerabilidad

No abras un issue público con datos sensibles. Contacta privadamente al responsable
del repositorio e incluye versión, impacto y pasos mínimos sin contenido real.

## Cabeceras recomendadas

GitHub Pages no permite configurar todas las cabeceras. Si se usa un proxy/CDN,
aplica `Content-Security-Policy: default-src 'self'; connect-src 'self'
https://*.supabase.co wss://*.supabase.co; img-src 'self' blob: data:; style-src
'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self';
frame-ancestors 'none'`, además de `Referrer-Policy: no-referrer`,
`X-Content-Type-Options: nosniff` y `Permissions-Policy` restrictiva.

## Secretos

Solo `VITE_*` puede llegar al navegador. La anon key no es una clave privada y
depende de RLS. Service Role, VAPID private, cron y cualquier JWT secret son
secretos remotos. Rota una credencial inmediatamente si aparece en Git.

## Dependencias

El workflow ejecuta `npm audit --audit-level=high`. Revisa Dependabot y actualiza
en ramas separadas con todas las pruebas. No se usa `dangerouslySetInnerHTML`.
