# Lectura de libros — Nuestra Historia

PWA de biblioteca personal con una zona privada cifrada para una pareja, sin
límite de dos accesos o dispositivos. El exterior permite gestionar libros, progreso, notas, citas, autores,
búsqueda y estadísticas locales. La zona **Nuestra Historia** añade conversación,
señales, cartas, preguntas, historia por turnos, ruleta, citas, recuerdos,
constelación y regalos.

Aplicación publicada: [Lectura de libros](https://jorgeduartee86-ux.github.io/lectura-de-libros/).

## Usar la actualización 1.2

R2 y Supabase ya están conectados; no hay que crear cuentas ni copiar claves.
Abrir la aplicación y aceptar el aviso de actualización cuando aparezca, sin borrar
sus datos. Entrar en Nuestra Historia con la clave habitual. El clip del chat permite
adjuntar archivos, y el menú ofrece stickers, guardados y almacenamiento.

En cada teléfono, entrar en Notificaciones, pulsar Activar y aceptar el permiso del
sistema. Después usar la prueba de notificación. La aplicación no puede concederse
ese permiso sola. Ver [pruebas y limitaciones](TESTING.md).

## Inicio rápido en Windows

Requisitos: Node.js 24, Git y, para el backend local, Docker Desktop y Supabase CLI.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Abre `http://localhost:5173`. La biblioteca pública funciona sin Supabase. En la
versión publicada, cada una de las dos personas entra a **Nuestra Historia** con
la misma clave numérica de seis cifras; Supabase asigna una identidad distinta a
cada dispositivo sin pedir correo ni contraseña.

## Comandos

```text
npm run dev            servidor local
npm run build          compilación de producción y 404 para SPA
npm run preview        vista previa de dist
npm run lint           ESLint
npm run typecheck      TypeScript estricto
npm run test           pruebas unitarias
npm run test:coverage  cobertura
npm run test:e2e       Playwright
npm run format         Prettier
npm run check          lint + tipos + unitarias + build
npm run deploy         publicación manual con gh-pages
```

```text
supabase start
supabase stop
supabase db reset
supabase migration up
supabase functions serve
supabase functions deploy
```

## Variables públicas

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `VITE_APP_BASE_PATH` (`/` local; `/nombre-repositorio/` en GitHub Pages)

La Service Role Key, la clave privada VAPID y `CRON_SECRET` solo se configuran
como secretos de Supabase; nunca se copian a variables `VITE_*`.

## Garantías de diseño

- No hay rastreo de ubicación, contactos, cámara silenciosa ni analítica de terceros.
- El contenido privado se cifra en el dispositivo con AES-GCM; las subclaves se
  derivan con HKDF y el PIN envuelve la clave local mediante PBKDF2.
- El acceso numérico se valida en una Edge Function con límite de intentos y su
  hash se conserva como secreto de Supabase, nunca dentro del frontend.
- Los dos dispositivos derivan localmente la misma clave de cifrado a partir de
  la clave acordada y el identificador privado de la relación.
- RLS deniega por defecto y comprueba membresía, remitente y máximo dos miembros.
- Las notificaciones contienen únicamente frases literarias genéricas.
- La bóveda se bloquea al ocultar o cerrar la página y después de cinco minutos.

## Documentación

- [Arquitectura](ARCHITECTURE.md)
- [Configuración de Supabase](SETUP_SUPABASE.md)
- [GitHub Pages](SETUP_GITHUB_PAGES.md)
- [Despliegue](DEPLOYMENT.md)
- [Seguridad](SECURITY.md) y [modelo de amenazas](THREAT_MODEL.md)
- [Criptografía](CRYPTOGRAPHY.md)
- [Offline](OFFLINE.md) y [notificaciones](NOTIFICATIONS.md)
- [iPhone](PWA_IOS_GUIDE.md) y [Android](PWA_ANDROID_GUIDE.md)
- [Pruebas](TESTING.md), [privacidad](PRIVACY.md) y [contribución](CONTRIBUTING.md)

## Limitaciones reales

Web Push en iPhone requiere iOS/iPadOS 16.4 o posterior y que la PWA esté añadida
a la pantalla de inicio. Supabase, VAPID y los cron remotos no funcionan hasta
configurar credenciales. Las fotografías se limitan a 5 MiB y formatos JPEG,
PNG o WebP; el MVP prioriza texto. La privacidad frente a capturas de pantalla o
un dispositivo físicamente desbloqueado no puede garantizarse desde una PWA.
