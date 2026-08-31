# Arquitectura

## Vista general

```text
GitHub Pages: React + TypeScript + Vite + PWA
  ├─ Biblioteca pública → IndexedDB
  ├─ Bóveda local → clave maestra envuelta en IndexedDB
  ├─ Cola offline → ciphertext en IndexedDB
  └─ Supabase
       ├─ Auth: dos cuentas invitadas
       ├─ PostgreSQL + RLS: ciphertext y metadatos mínimos
       ├─ Realtime: mensajes, señales, presencia y estados
       ├─ Storage: imágenes pequeñas privadas
       └─ Edge Functions: membresías, invitaciones, push y revocación
```

El frontend es estático. `src/lib/crypto.ts` mantiene la clave maestra únicamente
en memoria mientras la bóveda está abierta. `privateRepository.ts` cifra antes de
insertar, conserva una caché cifrada y reintenta la cola con backoff exponencial.

## Límites de confianza

El navegador desbloqueado es el único lugar donde existe contenido en claro.
Supabase es un transporte y almacén no confiable para el contenido. Las Edge
Functions pueden autorizar metadatos, pero nunca reciben la clave maestra ni
descifran mensajes. La Service Role Key solo vive en Supabase Secrets.

## Módulos

- `src/pages/PublicPages.tsx`: biblioteca, libro, citas, autores, instalación y Auth.
- `src/pages/PrivatePages.tsx`: desbloqueo, bloqueo y módulos de Nuestra Historia.
- `src/lib/crypto.ts`: PBKDF2, HKDF, AES-GCM, recuperación y emparejamiento.
- `src/lib/storage.ts`: IndexedDB tipada.
- `src/lib/privateRepository.ts`: Realtime, cifrado, caché y outbox.
- `supabase/migrations`: esquema, restricciones, RLS y funciones SQL atómicas.
- `supabase/functions`: operaciones privilegiadas con JWT, Zod y rate limiting.

## Escalabilidad

Los registros privados son independientes y se indexan por relación y fecha. El
repositorio limita cada lectura a 200 elementos; el siguiente paso para volúmenes
altos es paginación por cursor. Las funciones son idempotentes donde hay riesgo de
reintentos y `client_id` evita duplicados.
