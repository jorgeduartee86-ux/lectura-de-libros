# Contribuir

1. Crea una rama pequeña por cambio.
2. No añadas secretos, datos reales ni fixtures románticos privados.
3. Conserva TypeScript estricto, WCAG AA, áreas táctiles de 44 px y reducción de
   movimiento.
4. No uses `dangerouslySetInnerHTML`, localStorage para secretos ni algoritmos
   criptográficos propios.
5. Toda tabla nueva requiere constraints, RLS, índice y prueba de usuario ajeno.
6. Toda Edge Function debe validar JWT cuando corresponda, Zod, CORS, autorización,
   rate limiting y no registrar contenido.
7. Ejecuta `npm run check`, `npm run test:e2e` y `supabase test db`.

Los cambios de protocolo incrementan `crypto_version` y documentan migración,
compatibilidad y recuperación. No cambies una migración ya aplicada; añade otra.
