# Pruebas

## Suite local

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npx playwright install
npm run test:e2e
```

Para RLS y SQL se necesita Docker:

```powershell
supabase start
supabase db reset
supabase test db
```

## Cobertura

Vitest comprueba AES-GCM, HKDF, AAD, IV único, manipulación, clave incorrecta,
recuperación y emparejamiento, además de componentes de biblioteca. Playwright
comprueba biblioteca, alta manual, rutas y manifest PWA en escritorio y móvil.
pgTAP verifica tablas, funciones, trigger de máximo dos y políticas críticas.

## Prueba manual de dos usuarios

Usa dos navegadores/perfiles. Crea relación, invita, acepta, envía mensajes en
ambas direcciones, responde, corta internet, reenvía al reconectar, prueba presencia,
señal, carta, pregunta, cita, bloqueo al cambiar de app, PIN incorrecto, recuperación,
revocación y desvinculación. Con una tercera cuenta intenta leer e insertar en la
relación y confirma HTTP 401/403. Prueba invitación usada y vencida.
