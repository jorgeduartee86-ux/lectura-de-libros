# Diagnóstico de avisos

Abrir Nuestra Historia → Cuenta → Notificaciones.

1. Revisar permiso: si está bloqueado, permitirlo en ajustes del navegador/teléfono.
2. En iPhone, usar la app añadida a pantalla de inicio desde Safari, no una pestaña normal.
3. Confirmar service worker activo, scope de la aplicación y suscripción activa.
4. Pulsar Activar o reparar avisos; guardar preferencias.
5. Pulsar Probar notificación. “Aceptada por el servicio” no garantiza visualización del sistema.
6. Revisar Último push aceptado y error legible. No compartir claves o el JSON de la suscripción.
7. Confirmar que el otro dispositivo está registrado, la relación sigue activa, no hay horario silencioso y el tipo de aviso está habilitado.
8. Actualizar desde el aviso de nueva versión. No borrar datos del sitio: eliminaría claves y colas locales.

## Operación del servidor

Verificar VAPID, APP_URL, ALLOWED_ORIGINS, migración 007, funciones desplegadas y tarea process-chat-jobs. Error 401: sesión inválida. 404/410 del proveedor: suscripción caducada; registrar de nuevo. Error de red: backoff. No rotar VAPID sin preparar renovación de todos los clientes.

Si un mensaje aparece pero no hubo aviso, el contador interno debe continuar indicando que no fue leído. Si el contador desaparece sin ver la burbuja, revisar pruebas de viewport/visibilidad antes de publicar.

Limitación conocida: no se garantiza orden de llegada de push ni actualización del badge en un dispositivo cerrado después de leer en otro; el contador se reconcilia al abrir/enfocar.
