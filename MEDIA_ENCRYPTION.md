# Formato multimedia v1

Se reutiliza Web Crypto y la clave maestra existente; no hay algoritmo criptográfico propio.

Cada archivo obtiene un UUID aleatorio, timestamp lógico y partes de 5 MiB. Cada parte usa AES-GCM-256, IV aleatorio nuevo de 96 bits y tag de 128 bits. HKDF-SHA-256 deriva claves separadas por relación, versión y tipo de contenido. El contexto autenticado incluye relación, UUID, remitente, versión, timestamp y `media-chunk-v1-{index}`; cambiar el número de parte o archivo invalida el tag.

El manifiesto, también AES-GCM, contiene nombre, MIME, tamaño, duración, miniatura y lista ordenada de IV/tamaños cifrados. Usa el dominio `media-manifest-v1`. Las miniaturas son archivos cifrados independientes.

R2 recibe application/octet-stream. IndexedDB almacena solo chunks y manifiestos cifrados; las claves de descifrado no se envían a R2 ni en firmas. Las fotos originales se procesan localmente antes de cifrar.

Descarga: autorizar ID, verificar relación, descifrar manifiesto, validar formato/cantidad/tamaño, pedir rangos, verificar tamaño exacto y descifrar cada parte autenticada. El Blob se crea bajo demanda y su object URL se revoca al desmontar el componente.

Pruebas unitarias cubren IV distinto, contexto alterado y límites multipart. La integración real comprobó subida interrumpida/reanudada de dos partes, descarga por rangos y descifrado idéntico de 6 MiB + 37 bytes, además de expiración real y aislamiento. La fortaleza de AES no compensa por sí sola la baja entropía del PIN compartido existente; ver R2_SECURITY.md.
