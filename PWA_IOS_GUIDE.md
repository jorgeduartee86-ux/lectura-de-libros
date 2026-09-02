# iPhone / iPad

1. Abrir la URL publicada en Safari.
2. Compartir → Añadir a pantalla de inicio.
3. Abrir desde el icono, entrar y activar avisos con un toque.
4. Revisar Cuenta → Notificaciones → Probar notificación.

Web Push para apps de pantalla de inicio requiere iOS/iPadOS 16.4 o posterior. Capacidad real detectada en ejecución; no se solicita permiso sin gesto. [Guía de WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Manifest standalone, apple-touch-icon, safe areas, worker y rutas existentes se conservan. MediaRecorder y micrófono se detectan; si no están disponibles puede adjuntarse audio. Cámara/galería dependen de los permisos y formatos del dispositivo.

Al ocultar la app se cubre la interfaz; cerrar o superar cinco minutos bloquea la bóveda. Volver de un selector del sistema no debe perder borradores o cargas.

No se probó esta actualización en un dispositivo físico iOS. Verificar teclado, cámara, grabación, reproducción, push, clic y badge antes de darla por finalizada. El sistema controla la permanencia y agrupación de notificaciones.
