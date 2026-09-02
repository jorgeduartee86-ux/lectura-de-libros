# Almacenamiento multimedia

R2 y Supabase conectados el 2 de septiembre de 2026; backend desplegado. Consulta TESTING.md para distinguir pruebas reales, simuladas y pendientes en teléfonos físicos.

Supabase conserva autenticación, relaciones, RLS, mensajes cifrados, recibos y metadatos. R2 guarda únicamente archivos cifrados. El bucket creado es `nuestra-historia-media`, privado, Standard, región automática ENAM. Las imágenes antiguas de Supabase Storage siguen siendo legibles mediante el adaptador de images.ts; no se han trasladado ni borrado.

## Flujo

1. El dispositivo valida, prepara y cifra partes de 5 MiB mediante Web Crypto.
2. La cola IndexedDB conserva partes y manifiesto cifrados.
3. La función autenticada crea una sesión multipart y firmas PUT de 300 segundos.
4. La carga directa a R2 se reanuda consultando las partes ya existentes.
5. El servidor verifica cantidad, tamaño y objeto final antes de marcarlo disponible.
6. El mensaje referencia los IDs mediante un trigger transaccional.
7. Para leer, el servidor autoriza una firma GET temporal; el dispositivo descarga y descifra bajo demanda.

No se usa R2 como almacenamiento público. Los nombres originales y los IV de las partes están dentro del manifiesto cifrado. La ruta contiene UUID y fecha, no nombres de personas ni nombres de archivo.

## Límites

Configuración compartida: `supabase/functions/_shared/media-policy.ts`.

| Tipo              |  Máximo |
| ----------------- | ------: |
| Imagen            |  15 MiB |
| Video             | 100 MiB |
| Audio             |  25 MiB |
| Documento         |  25 MiB |
| Sticker preparado |   2 MiB |

Hasta cinco adjuntos por mensaje, más sus miniaturas. Las cargas actuales son secuenciales. Imágenes hasta 1920 px y stickers hasta 512 px, WebP con fallback de canvas. Video: thumbnail pequeño y descarga explícita; no hay transcodificación de video.

Almacenamiento muestra hasta 500 archivos visibles y uso local estimado; no es una factura ni incluye imágenes antiguas. Los originales descargados se mantienen en Blob en memoria mientras el componente vive, no en una caché persistente en texto claro.

## Limpieza

Eliminar para ambos deja una lápida sin contenido. Solo se borra un objeto propio sin referencias a mensajes, recuerdos o biblioteca de stickers. La tarea del servidor está activa y limpia huérfanos tras siete días, filtrando referencias antes de limitar el lote. R2 también incluye una regla de aborto de multipart incompleto tras siete días. No configurar una regla general de borrado de objetos completos: desconocería las referencias en Supabase.
