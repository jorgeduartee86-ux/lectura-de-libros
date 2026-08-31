# Plan de implementación

Estado: versión 1.0 implementada y verificada localmente.

## Fases

- [x] Fase 1 — Inicializar React, TypeScript estricto y Vite.
- [x] Fase 1 — PWA, sistema visual y biblioteca pública.
- [x] Fase 2 — Supabase Auth, perfiles, relación, invitaciones y RLS.
- [x] Fase 3 — Zona privada, PIN, IndexedDB, bloqueo y salida rápida.
- [x] Fase 4 — Cifrado E2EE, recuperación y protocolo versionado.
- [x] Fase 5 — Conversación, Realtime, presencia y estados.
- [x] Fase 6 — Señales, coincidencias, cartas y pregunta diaria.
- [x] Fase 7 — Libro compartido, ruleta, citas, recuerdos, universo y regalos.
- [x] Fase 8 — Web Push, Edge Functions e instalación móvil.
- [x] Fase 9 — Cola offline, sincronización y rendimiento.
- [x] Fase 10 — Pruebas, seguridad, documentación y CI/CD.

## Criterio de terminación

Cada fase se considera completa únicamente cuando `npm run check` y
`npm run build` terminan sin errores. Los servicios remotos requieren que la
persona propietaria del proyecto complete las variables de entorno y despliegue
las migraciones y funciones incluidas.

## Última verificación local

- ESLint: correcto, 0 errores y 0 advertencias.
- TypeScript estricto: correcto.
- Vitest + Testing Library: 9/9 pruebas correctas.
- Cobertura criptográfica: 98,61 % de sentencias y 100 % de funciones y líneas.
- Playwright: 6/6 pruebas correctas en Chrome escritorio y móvil emulado.
- Build PWA: correcto; 11 recursos precacheados, `sw.js`, manifest y `404.html` generados.
- Auditoría npm: 0 vulnerabilidades.
- pgTAP/RLS: suite incluida; no se ejecutó localmente porque este equipo no tiene Docker/Supabase CLI.
