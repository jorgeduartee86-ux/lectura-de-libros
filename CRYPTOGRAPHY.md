# Criptografía

## Protocolo versión 1

1. Se genera una clave maestra aleatoria de 256 bits con Web Crypto.
2. Para cada tipo se deriva una subclave AES-256-GCM con HKDF-SHA-256.
3. Cada registro usa un IV aleatorio nuevo de 96 bits.
4. El AAD serializa en orden: `relationshipId`, `messageId`, `senderId`, versión,
   timestamp lógico y `contentType`.
5. Se almacenan `ciphertext`, IV, versión y metadatos mínimos.

El PIN no cifra directamente los mensajes. PBKDF2-SHA-256 con 310.000 iteraciones
y sal aleatoria deriva una KEK que envuelve la clave maestra con AES-GCM. El PIN
no se guarda. Una frase larga es preferible a seis dígitos.

## Recuperación

Se genera una clave de recuperación de 256 bits y se muestra una sola vez. Esa
clave envuelve la misma clave maestra. Recuperar crea una nueva sal y vuelve a
envolverla con el PIN nuevo; no cambia el ciphertext remoto.

## Emparejamiento

El primer dispositivo genera un secreto aleatorio. La clave maestra se cifra con
una clave derivada de ese secreto. Supabase guarda solo el sobre. El secreto viaja
en `#s=`: los fragmentos URL no se incluyen en solicitudes HTTP. El segundo
dispositivo descarga el sobre, lo abre localmente y crea su propio PIN y código de
recuperación. La invitación es de un uso y caduca.

## Rotación

`crypto_version` y `keyVersion` permiten evolución. Una rotación completa debe
descifrar y volver a cifrar por lotes en un dispositivo autorizado, conservando
la versión anterior hasta verificar todos los registros. Nunca reutilices un IV
ni cambies AAD de un registro existente sin volver a cifrar.

Las pruebas cubren cifrado, descifrado, manipulación, IV, clave incorrecta, AAD,
recuperación y emparejamiento.
