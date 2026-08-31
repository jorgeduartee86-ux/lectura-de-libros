# Notificaciones discretas

El permiso nunca se solicita al cargar. En Nuestra Historia → Configuración,
**Activar** registra un dispositivo y una suscripción Web Push. Se requiere la
clave pública VAPID en el frontend y las dos claves en Supabase Secrets.

La función `send-push` acepta solo un índice dentro de una lista fija. Nunca acepta
texto arbitrario, PIN, ciphertext, ids internos ni vista previa romántica. Valida
JWT, relación y destinatario, limita a 20 avisos por hora y elimina endpoints 404/410.

Ejemplos: “Hay una página nueva disponible”, “Se añadió un nuevo marcapáginas” y
“Hay un nuevo evento en tu agenda de lectura”. Los recordatorios consultan solo la
hora mínima de una cita y siguen enviando un payload genérico.

Si el permiso fue denegado, debe reactivarse desde los ajustes del navegador o del
sistema. En iPhone solo funciona para PWAs instaladas desde iOS 16.4.
