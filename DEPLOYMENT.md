# Despliegue

## Orden recomendado

1. Ejecuta `npm run check`.
2. Ejecuta `supabase db push` y `supabase test db`.
3. Configura secretos y despliega todas las Edge Functions.
4. Configura los cron de limpieza y recordatorios.
5. Añade GitHub Actions Secrets y publica GitHub Pages.
6. Prueba en dos cuentas reales: invitación, emparejamiento, mensaje, lectura,
   señal, bloqueo, offline y push.

## Reversión

El frontend se revierte desplegando un commit anterior. Las migraciones de base
de datos son progresivas: crea una migración correctiva; no edites una ya aplicada.
Antes de cambios destructivos, usa un entorno de staging y una copia de seguridad.

## Verificación posterior

Comprueba manifest, service worker, `display-mode: standalone`, CSP del hosting,
RLS con un usuario ajeno, invitación usada, intento de tercer miembro, revocación
de dispositivo y payload genérico de notificación.
