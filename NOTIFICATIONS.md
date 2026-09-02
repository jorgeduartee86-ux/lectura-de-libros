# Notificaciones y mensajes no leídos

Backend desplegado y tarea periódica activa desde el 2 de septiembre de 2026. La visualización de avisos en teléfonos físicos requiere el permiso del sistema y sigue pendiente de comprobación en esos dispositivos.

## Registro y envío

register-push verifica identidad, registra dispositivo, deduplica endpoint y actualiza suscripción. Solo acepta endpoints HTTPS conocidos de proveedores push. El cliente detecta cambio de VAPID, renueva cuando el permiso ya está concedido y respeta preferencias desactivadas.

Los triggers insertan trabajos duraderos para mensajes, stickers, cartas, señales, regalos y citas. send-push dispara el procesamiento autorizado; process-chat-jobs ofrece recuperación periódica. La tarea `chat-jobs-every-minute` está activa, reutiliza Vault y responde HTTP 200; ver R2_SETUP.md.

Los trabajos tienen lease, intentos y backoff; máximo cinco intentos. Se recuerda entrega por dispositivo para reducir duplicados. Los endpoints 404/410 se eliminan. La prueba desde Ajustes usa realmente el backend y el dispositivo actual. Aceptación por el proveedor no prueba que el teléfono mostró el aviso.

## Privacidad y lectura

Por defecto: “Tienes una nueva página”. Nivel medio: aviso genérico. Directo solo incluye nombre si ambos eligen ese nivel. Nunca texto de mensaje, imagen, carta, ciphertext, clave o URL firmada.

Badge y título reflejan unread del servidor. El worker NO marca leído ni lo hace el clic en el aviso. Se conserva hasta la lectura visible de la burbuja. Los tags distinguen mensajes; el clic respeta origen/ruta de la PWA y lleva al chat o herramienta.

Recordatorios opcionales de 30/60/180 minutos; máximo dos por mensaje. Cancelación al leer, respeto de horario silencioso y zona horaria. Un envío ya en tránsito no puede retirarse del proveedor.

## Compatibilidad

Payload estándar más `web_push:8030` con fallback declarativo, navegación y app_badge. El worker usa showNotification, timestamp y requireInteraction solo si existe la capacidad. [WebKit: Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/).

El permiso siempre requiere acción del usuario. iOS/Android pueden agrupar o retirar avisos; una PWA no puede mantenerlos físicamente para siempre. Sonido, vibración y badge dependen del navegador y sistema. Los indicadores dentro de la app son independientes.

No se ha comprobado push en iPhone o Android físicos en esta entrega.
