# Funcionamiento sin conexión

Workbox precachea el app shell, rutas y activos. La biblioteca pública vive en
IndexedDB y funciona sin red. El contenido privado descargado se conserva solo
como ciphertext.

Al enviar sin conexión:

1. Se cifra inmediatamente.
2. Se guarda en `privateCache` y `outbox` con id UUID.
3. La interfaz muestra estado pendiente.
4. Al volver internet, `flushOutbox` hace upsert idempotente.
5. Un error aumenta el contador y aplica backoff exponencial hasta 60 segundos.

El bloqueo elimina la clave de memoria y desmonta las vistas descifradas. No se
usa localStorage para claves, sesiones ni mensajes. La sesión de Supabase usa un
adaptador IndexedDB. Para forzar una actualización del app shell, acepta el aviso
**Hay una edición nueva**.
