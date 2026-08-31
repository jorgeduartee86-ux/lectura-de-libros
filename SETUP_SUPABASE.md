# Configurar Supabase desde Windows

1. Crea un proyecto gratuito en Supabase y copia **Project URL** y **anon public key**.
2. Instala Supabase CLI y Docker Desktop.
3. Inicia sesión y vincula el proyecto:

```powershell
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

4. En `.env`, completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Genera claves VAPID, por ejemplo con `npx web-push generate-vapid-keys`.
6. Configura secretos remotos (reemplaza todos los valores):

```powershell
supabase secrets set SUPABASE_URL="https://TU_REF.supabase.co"
supabase secrets set SUPABASE_ANON_KEY="TU_ANON_KEY"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="TU_SERVICE_ROLE_KEY"
supabase secrets set VAPID_PUBLIC_KEY="TU_VAPID_PUBLIC_KEY"
supabase secrets set VAPID_PRIVATE_KEY="TU_VAPID_PRIVATE_KEY"
supabase secrets set VAPID_SUBJECT="mailto:tu-correo@example.com"
supabase secrets set ALLOWED_ORIGINS="https://TU_USUARIO.github.io,http://localhost:5173"
supabase secrets set CRON_SECRET="UN_SECRETO_ALEATORIO_LARGO"
```

`RELATIONSHIP_EMAIL_ALLOWLIST` es opcional y admite dos correos separados por coma.
Si se define, las Edge Functions rechazan cualquier otro correo.

7. Despliega funciones:

```powershell
Get-ChildItem supabase/functions -Directory |
  Where-Object Name -NotLike '_*' |
  ForEach-Object { supabase functions deploy $_.Name }
```

8. Programa `cleanup-invites` cada hora y `appointment-reminders` cada cinco
   minutos con Supabase Cron; envía `x-cron-secret` en la solicitud.

## Entorno local

```powershell
supabase start
supabase db reset
supabase functions serve --env-file .env
```

La migración crea el bucket privado `memories`, activa Realtime y aplica RLS.
Comprueba las políticas con `supabase test db`.

## Crear la relación

1. Inicia sesión con la primera cuenta.
2. Acepta el consentimiento y pulsa **Crear relación privada**.
3. Configura el PIN y guarda el código de recuperación.
4. En Nuestra Historia → Configuración, crea la invitación.
5. La segunda persona abre el enlace completo, crea su cuenta autorizada, inicia
   sesión, acepta el consentimiento y define su PIN.
6. El fragmento secreto descifra la misma clave maestra en su dispositivo; la
   invitación se invalida y la relación queda cerrada para dos miembros.
