# Publicar en GitHub Pages

1. Crea un repositorio en GitHub y sube el proyecto a la rama `main`.
2. En **Settings → Pages → Build and deployment**, elige **GitHub Actions**.
3. En **Settings → Secrets and variables → Actions**, crea:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_VAPID_PUBLIC_KEY`.
4. Ejecuta el workflow **Verificar y publicar** o haz push a `main`.

El workflow calcula `VITE_APP_BASE_PATH` con el nombre del repositorio, ejecuta
lint, tipos, pruebas, auditoría, build, RLS y E2E, y solo entonces publica `dist`.
`postbuild` copia `index.html` a `404.html` para rutas SPA directas.

Publicación manual:

```powershell
$env:VITE_APP_BASE_PATH = "/NOMBRE_REPOSITORIO/"
npm run deploy
```

Tras cambiar el dominio, actualiza `ALLOWED_ORIGINS` en Supabase Secrets y las
URL de redirección de Auth.
