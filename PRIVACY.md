# Privacidad

La aplicación está diseñada para dos adultos que aceptan voluntariamente usarla.
No debe emplearse para vigilar, presionar, rastrear ni castigar a la otra persona.

## Datos locales

Libros, progreso, notas y citas públicas se guardan en IndexedDB. La bóveda guarda
la clave maestra envuelta, ciphertext de caché y una cola cifrada. El contenido
descifrado solo permanece en memoria mientras la zona está abierta.

## Datos remotos

Supabase recibe cuenta, membresía, dispositivos, suscripción push, timestamps,
tipo de contenido y ciphertext. Las fechas de citas se guardan como metadato mínimo
para recordatorios genéricos. Storage conserva solo archivos privados autorizados.

## No recopilado

No se solicita ubicación, contactos, SMS, contenido de otras aplicaciones, cámara
o micrófono silenciosos. No hay publicidad ni analítica de terceros por defecto.

## Control

Cada miembro puede cerrar sesión, revocar dispositivos, desvincularse y eliminar
su cuenta. Eliminar una cuenta no puede borrar copias ya exportadas o capturas
realizadas por la otra persona. Las notificaciones se activan solo mediante un
botón explícito y pueden desactivarse desde el sistema operativo.
