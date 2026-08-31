# Prompt maestro para Codex
## Proyecto: **Lectura de libros — Nuestra Historia**

Actúa como un **arquitecto de software sénior, desarrollador full stack, especialista en PWA, React, TypeScript, Supabase, GitHub Pages, seguridad web, criptografía aplicada, experiencia móvil y pruebas automatizadas**.

Debes construir un proyecto completo, funcional y preparado para producción llamado **Lectura de libros**.

Exteriormente será una aplicación legítima de lectura, recomendaciones literarias, citas, autores y biblioteca personal. En su interior tendrá una zona privada llamada **Nuestra Historia**, destinada exclusivamente a dos adultos que aceptan voluntariamente utilizarla como un espacio romántico, interactivo y privado para comunicarse, jugar, sorprenderse, guardar recuerdos y fortalecer una relación a distancia.

La aplicación no debe funcionar como herramienta de vigilancia, control, rastreo, espionaje o manipulación.

---

# 1. Objetivo

Crear una **Progressive Web App instalable en iPhone y Android**, sin publicarla en App Store ni Google Play.

Debe:

1. Instalarse desde el navegador en la pantalla de inicio.
2. Abrirse en modo `standalone`.
3. Tener una apariencia exterior de aplicación de lectura.
4. Incluir una zona romántica privada para exactamente dos usuarios.
5. Permitir mensajería bidireccional en tiempo real.
6. Permitir que ambos usuarios envíen, respondan, reaccionen y creen contenido.
7. Enviar notificaciones discretas que no revelen contenido privado.
8. Usar cifrado de extremo a extremo.
9. Funcionar parcialmente sin conexión.
10. Alojar el frontend gratis en GitHub Pages.
11. Usar Supabase Free para Auth, PostgreSQL, Realtime, Storage y Edge Functions.
12. Incluir documentación para configuración, pruebas y despliegue desde Windows.
13. No depender de servicios pagos para la primera versión.
14. Mantener una arquitectura escalable.

---

# 2. Restricciones

La aplicación será para exactamente dos usuarios y ambos tendrán los mismos permisos.

No incluir:

- Registro público abierto.
- Panel para controlar al otro usuario.
- Rastreo de ubicación.
- Acceso a contactos.
- Lectura de otras aplicaciones.
- Captura silenciosa de cámara o micrófono.
- Monitoreo oculto.
- Instalación encubierta.
- Penalizaciones por no responder.
- Publicidad.
- Analítica de terceros por defecto.
- Contenido romántico visible en notificaciones.
- Secretos o claves privadas en el repositorio.

La experiencia debe transmitir ilusión, cercanía, juego y romanticismo, no presión.

---

# 3. Stack obligatorio

Usa:

- React.
- TypeScript estricto.
- Vite.
- Tailwind CSS.
- React Router.
- Supabase JavaScript SDK.
- Supabase Authentication.
- PostgreSQL de Supabase.
- Supabase Realtime.
- Supabase Edge Functions.
- Supabase Storage solo cuando sea necesario.
- Row Level Security.
- Web Crypto API.
- IndexedDB.
- `vite-plugin-pwa` o Workbox.
- Zustand.
- Zod.
- React Hook Form.
- Vitest.
- Testing Library.
- Playwright.
- ESLint.
- Prettier.
- GitHub Actions.
- GitHub Pages.

No uses Firebase.

---

# 4. Arquitectura

```text
PWA React + TypeScript
        |
        |--- GitHub Pages
        |      Interfaz, manifest, service worker y archivos estáticos
        |
        |--- Supabase Auth
        |      Inicio de sesión y cuentas de los dos usuarios
        |
        |--- Supabase PostgreSQL
        |      Mensajes cifrados, cartas, señales, juegos y metadatos
        |
        |--- Supabase Realtime
        |      Mensajes, presencia, escritura y actualizaciones
        |
        |--- Supabase Edge Functions
        |      Invitaciones, notificaciones y operaciones privilegiadas
        |
        |--- Web Push
               Notificaciones genéricas con VAPID
```

Todo el frontend debe desplegarse como sitio estático. Configura correctamente `base` en Vite y el manejo de rutas SPA para GitHub Pages.

---

# 5. Identidad visual

Nombre exterior: **Lectura de libros**.

Nombre interior: **Nuestra Historia**.

Diseño:

- Inspirado en libros, páginas, tinta, cartas y constelaciones.
- Exterior sobrio y literario.
- Interior cálido y romántico.
- Sin rosas típicas.
- Sin exceso de colores pastel.
- Sin apariencia infantil.
- Modo claro y oscuro.
- Animaciones suaves.
- WCAG AA.
- Responsive.
- Áreas táctiles de mínimo 44 × 44 píxeles.

Crea logotipo, icono SVG, iconos PWA, `apple-touch-icon`, iconos maskable y splash.

---

# 6. Aplicación exterior de lectura

Debe funcionar realmente como una pequeña aplicación literaria:

- Inicio.
- Recomendación del día.
- Biblioteca.
- Libros pendientes y terminados.
- Citas favoritas.
- Autores.
- Buscador y filtros.
- Estadísticas locales.
- Detalle de libro.
- Notas y marcadores.
- Frases del día.
- Contenido offline.

Incluye datos de demostración de dominio público o creados para el proyecto. No dependas obligatoriamente de APIs externas.

Permite agregar manualmente título, autor, género, estado, calificación, nota y cita favorita.

---

# 7. Acceso privado

Flujo:

1. El usuario inicia sesión.
2. La aplicación exterior abre normalmente.
3. En el buscador escribe una palabra acordada.
4. Se abre la pantalla de desbloqueo.
5. Introduce PIN o frase secreta.
6. Entra a **Nuestra Historia**.

También puede existir un gesto alternativo, como mantener presionado un marcapáginas. El gesto solo abre el desbloqueo; no sustituye autenticación ni PIN.

Implementa:

- Bloqueo automático.
- Bloqueo al minimizar.
- Bloqueo en `visibilitychange` y `pagehide`.
- Desenfoque inmediato.
- Limpieza de contenido sensible de la interfaz.
- Botón de salida rápida.
- Regreso inmediato a la biblioteca pública.
- Tiempo de bloqueo configurable.
- WebAuthn opcional cuando sea compatible.

---

# 8. Vinculación de los dos usuarios

No permitas registro público libre.

Flujo:

1. El primer usuario crea una cuenta.
2. Crea una relación privada.
3. Se genera una invitación de un solo uso con expiración.
4. El segundo usuario crea su cuenta.
5. Acepta la invitación.
6. Ambos aceptan explícitamente la vinculación.
7. La relación queda cerrada para dos miembros.
8. Ningún tercero puede entrar.
9. La invitación utilizada queda anulada.
10. Ambos pueden cerrar sesión, revocar dispositivos y desvincularse.

Incluye allowlist opcional de dos correos. Valida todo en frontend, Edge Functions y RLS.

---

# 9. Mensajería bidireccional

Ambos usuarios pueden:

- Enviar y recibir mensajes.
- Responder.
- Reaccionar.
- Editar sus propios mensajes.
- Eliminar para sí mismos.
- Solicitar eliminación para ambos.
- Ver estados pendiente, enviado, entregado, leído y error.
- Ver “escribiendo”.
- Ver presencia.
- Enviar enlaces.
- Destacar mensajes.
- Buscar localmente contenido descifrado.
- Citar mensajes.
- Reintentar mensajes fallidos.
- Escribir offline y sincronizar después.

La confirmación de lectura debe ser configurable.

---

# 10. Capítulos

La conversación no debe sentirse como un chat genérico. Cada día puede ser un capítulo.

Ejemplo:

```text
Capítulo 18
La noche en que volvimos a hablar con el corazón
```

Incluye:

- Capítulo diario automático.
- Título editable por ambos.
- Frase destacada.
- Mensajes del día.
- Recuerdos asociados.
- Pregunta del día.
- Estado romántico.

---

# 11. Marcapáginas románticos

Crea señales rápidas:

- Pensé en ti.
- Te extraño.
- Te mando un beso.
- Quiero abrazarte.
- Hazme sonreír.
- Quiero escuchar tu voz.
- Ven a nuestra historia.
- Estoy recordando algo bonito.
- Quiero hablar contigo.
- Tengo una sorpresa.

Al enviarlas:

1. Se crea un evento cifrado.
2. El otro recibe una notificación genérica.
3. Al desbloquear ve la señal real.
4. Puede responder, reaccionar o convertirla en mensaje.

Incluye animaciones suaves y cooldown opcional.

---

# 12. En la misma página

Crea una función en la que uno mantiene presionado un botón. Si el otro también lo hace dentro de una ventana de tiempo, ambos ven:

**Coincidieron en la misma página.**

Incluye animación, vibración suave cuando sea compatible, sonido opcional e historial de coincidencias. No debe existir penalización si no coinciden.

---

# 13. Cartas escondidas

Categorías:

- Ábrela cuando me extrañes.
- Ábrela cuando quieras sonreír.
- Ábrela cuando recuerdes algo bonito.
- Ábrela cuando dudes de nosotros.
- Ábrela esta noche.
- Ábrela en una fecha especial.
- Ábrela cuando quieras sentirme cerca.
- Carta libre.

Opciones de apertura:

- Inmediata.
- En fecha determinada.
- Con palabra secreta.
- Después de responder una pregunta.
- Por sorpresa.

Todo el contenido debe almacenarse cifrado.

---

# 14. Preguntas para enamorarse

Crea una pregunta diaria con modos de respuesta libre, corta, revelación simultánea, inmediata o salto sin penalización.

Ejemplos:

- ¿Qué recuerdo nuestro te hace sonreír?
- ¿Qué te gustaría vivir conmigo?
- ¿En qué momento comenzaste a quererme?
- ¿Qué parte de mí extrañas?
- ¿Cómo sería un día perfecto juntos?
- ¿Qué canción te hace pensar en nosotros?
- ¿Qué deseas que vivamos cuando nos encontremos?
- ¿Qué detalle mío te hace sentir especial?
- ¿Qué te gustaría que construyéramos juntos?
- ¿Cuál sería nuestro viaje soñado?

---

# 15. Nuestro libro

Ambos escriben una historia por turnos.

Funciones:

- Crear historia.
- Título y portada.
- Escritura por turnos.
- Capítulos.
- Reacciones.
- Borradores.
- Historial de versiones.
- Prevención de conflictos.
- Funcionamiento parcial offline.

Texto inicial opcional:

> Había una vez dos personas separadas por muchos kilómetros que siempre terminaban regresando a la misma historia.

---

# 16. Ruleta romántica

Opciones iniciales:

- Mándame una canción.
- Cuéntame un recuerdo.
- Dime tres cosas que te gustan de mí.
- Elige una película.
- Grábame un mensaje.
- Escríbeme algo que nunca me hayas dicho.
- Planeemos una cita futura.
- Dime cómo me abrazarías.
- Envíame una foto de lo que estás viendo.
- Hazme una pregunta nueva.
- Describe nuestro día perfecto.
- Elige una promesa para esta semana.

Ambos pueden girar, aceptar, rechazar sin penalización, guardar, completar, comentar y crear actividades.

---

# 17. Citas virtuales

Crea **Nuestra cita**:

- Invitar al otro.
- Elegir fecha y hora.
- Elegir tema, película, canción o libro.
- Añadir preguntas, carta o sorpresa.
- Cuenta regresiva.
- Confirmación.
- Recordatorio.
- Historial.

La notificación exterior debe ser neutra, por ejemplo:

> Hay un nuevo evento en tu agenda de lectura.

---

# 18. Cofre de recuerdos

Permite guardar:

- Frases.
- Fechas.
- Promesas.
- Canciones.
- Enlaces.
- Lugares.
- Planes.
- Capturas.
- Fotografías.
- Recuerdos.
- Metas.
- Cosas que quieren hacer juntos.

Prioriza texto. Permite enlaces e imágenes pequeñas, comprimidas en cliente y validadas. Usa Supabase Storage con políticas seguras.

---

# 19. Nuestro universo

Cada interacción significativa crea una estrella: carta, recuerdo, cita, capítulo, promesa, canción, coincidencia, pregunta o sorpresa.

Al tocar una estrella se abre el recuerdo descifrado con su fecha, categoría y reacciones. Debe ser ligero en móviles.

---

# 20. Regalos digitales

Ambos pueden crear:

- Cartas.
- Listas de canciones.
- Diez razones por las que te amo.
- Álbumes.
- Rompecabezas.
- Mensajes revelados palabra por palabra.
- Cajas con fecha.
- Boletos para citas.
- Promesas.
- Libros de recuerdos.

Incluye un creador paso a paso.

---

# 21. Presencia y estados

De forma configurable:

- En línea.
- Desconectado.
- Escribiendo.
- Leyendo nuestra historia.
- Última actividad.
- Mensaje entregado y leído.
- En una cita.
- Escribiendo una carta.

No mostrar ubicación ni generar alertas por ausencia.

Estados románticos:

- Pensando en ti.
- Te extraño.
- Quiero hablar contigo.
- Estoy feliz de tenerte.
- Quiero escuchar tu voz.
- Tengo una sorpresa.
- Estoy recordándonos.
- Disponible para una cita.
- Escribiéndote algo bonito.

---

# 22. Notificaciones discretas

Soporta Web Push.

En iPhone:

- Detecta modo standalone.
- Explica cómo agregar a pantalla de inicio.
- No pide permiso automáticamente.
- Usa un botón: **Activar avisos de nuevos capítulos**.
- Maneja permiso denegado y navegadores no compatibles.

En Android:

- Detecta instalación.
- Muestra botón de instalación.
- Permite activar notificaciones.

Notificaciones permitidas:

- Tienes una nueva recomendación de lectura.
- Se añadió un nuevo marcapáginas.
- Hay una página nueva disponible.
- Tu biblioteca fue actualizada.
- Tienes una nueva cita guardada.
- Se abrió un nuevo capítulo.
- Hay una sorpresa entre páginas.

Nunca incluir contenido, PIN, claves, ciphertext, identificadores internos ni vista previa romántica.

Crea una Edge Function que valide JWT y relación, identifique destinatario, envíe payload genérico, aplique rate limiting, elimine suscripciones inválidas y nunca descifre contenido.

---

# 23. Cifrado de extremo a extremo

No inventes algoritmos.

Usa:

- Clave maestra aleatoria de 256 bits.
- AES-GCM.
- IV aleatorio único de 96 bits.
- HKDF para subclaves.
- AAD con `relationshipId`, `messageId`, `senderId`, versión, timestamp lógico y tipo.
- PIN solo para desbloquear una clave local envuelta.
- PBKDF2 o Argon2id cuando sea viable.
- IndexedDB para claves cifradas.
- Versionado del protocolo.
- Rotación de claves.
- Código de recuperación mostrado una vez.

Nunca guardes claves maestras ni mensajes privados en texto plano. No los incluyas en logs.

El intercambio inicial debe usar un secreto aleatorio de emparejamiento, cifrar la clave maestra, generar código o QR, expirar e invalidar el secreto y evitar que Supabase conozca la clave.

Crea pruebas de cifrado, descifrado, manipulación, IV, clave incorrecta, AAD, rotación, recuperación y emparejamiento.

---

# 24. Modelo de datos

Crea tablas semejantes a:

- `profiles`
- `relationships`
- `relationship_members`
- `relationship_invites`
- `devices`
- `push_subscriptions`
- `messages`
- `message_receipts`
- `message_reactions`
- `signals`
- `letters`
- `daily_questions`
- `daily_answers`
- `chapters`
- `chapter_items`
- `shared_stories`
- `story_entries`
- `romantic_challenges`
- `challenge_results`
- `virtual_dates`
- `memories`
- `memory_stars`
- `gifts`
- `presence`
- `settings`
- `audit_events`

Los contenidos privados guardan solo `ciphertext`, `iv`, `crypto_version`, `content_type`, `sender_id`, `relationship_id`, timestamps y metadatos mínimos.

Crea migraciones SQL, índices y restricciones.

---

# 25. Row Level Security

Habilita RLS en todas las tablas privadas.

Reglas:

- Solo usuarios autenticados.
- Solo miembros de la relación.
- Máximo dos miembros.
- El remitente coincide con el usuario autenticado.
- Nadie agrega un tercer miembro.
- Nadie lee datos de otra relación.
- Nadie lee suscripciones push ajenas.
- Nadie modifica membresías directamente.
- Invitaciones vencidas o usadas no funcionan.
- Validar propietario de dispositivo.
- Validar tamaños y campos inmutables.
- Denegar por defecto.
- Operaciones privilegiadas mediante Edge Functions.

Incluye pruebas automatizadas.

---

# 26. Offline y PWA

La aplicación debe:

- Cachear app shell y biblioteca pública.
- Mostrar página offline.
- Permitir escribir mensajes sin conexión.
- Guardar cola local en IndexedDB.
- Reintentar con backoff.
- Evitar duplicados.
- Resolver conflictos.
- Mostrar conectividad.
- Sincronizar al recuperar internet.
- No guardar contenido descifrado permanentemente.
- Limpiar memoria sensible al bloquear.
- No usar localStorage para secretos.

Configura `manifest.webmanifest`, `display: standalone`, `start_url`, `scope`, `id`, colores, iconos, service worker, actualización controlada, página offline, instalación Android, guía iOS y badges cuando sean compatibles.

---

# 27. GitHub Pages y CI/CD

Configura:

- GitHub Actions.
- Build automático.
- Publicación de `dist`.
- GitHub Secrets.
- Rutas SPA.
- `404.html` cuando sea necesario.
- `.gitignore`.
- `.env.example`.

Nunca publiques Service Role Key, JWT secret, VAPID private key o credenciales personales.

El workflow debe ejecutar instalación, lint, typecheck, pruebas, build, auditoría básica y despliegue. No despliegues si algo falla.

---

# 28. Edge Functions

Crea funciones para:

- Crear, aceptar y revocar invitaciones.
- Validar máximo dos miembros.
- Enviar push.
- Eliminar suscripciones inválidas.
- Desvincular.
- Revocar dispositivos.
- Eliminar cuenta.
- Rate limiting.
- Limpiar invitaciones vencidas.
- Recordatorios de citas.
- Operaciones sensibles.

Todas validan autenticación, autorización y payload con Zod, aplican CORS seguro, manejan errores y no registran contenido privado.

---

# 29. Pantallas

Crea al menos:

1. Splash.
2. Inicio de lectura.
3. Biblioteca.
4. Buscador.
5. Detalle de libro.
6. Citas favoritas.
7. Instalación PWA.
8. Inicio de sesión.
9. Registro autorizado.
10. Crear invitación.
11. Aceptar invitación.
12. Consentimiento.
13. Configurar PIN.
14. Recuperación.
15. Desbloqueo.
16. Nuestra Historia.
17. Capítulo del día.
18. Conversación.
19. Marcapáginas.
20. En la misma página.
21. Cartas.
22. Pregunta del día.
23. Nuestro libro.
24. Ruleta romántica.
25. Nuestra cita.
26. Cofre de recuerdos.
27. Nuestro universo.
28. Regalos.
29. Estados y presencia.
30. Notificaciones.
31. Privacidad.
32. Dispositivos.
33. Seguridad.
34. Configuración.
35. Desvinculación.
36. Eliminación de cuenta.
37. Página offline.
38. Error 404.
39. Error general.

Incluye estados de carga, vacío, error, sin conexión, permiso denegado, sesión expirada, invitación vencida, clave incorrecta, dispositivo revocado y sincronización pendiente.

---

# 30. Seguridad, accesibilidad y rendimiento

Crea `THREAT_MODEL.md` analizando XSS, CSRF, robo de sesión, exposición de claves, reutilización de IV, invitaciones, enumeración, abuso de push, RLS incorrecta, IndexedDB, dispositivo desbloqueado, capturas, logs, dependencias y Storage.

Mitiga con CSP, validación estricta, RLS, rotación, revocación, rate limiting, protección de rutas, auditoría de dependencias, no usar `dangerouslySetInnerHTML` y no guardar secretos en localStorage.

Implementa WCAG AA, navegación por teclado, ARIA, foco visible, contraste, `prefers-reduced-motion`, code splitting, lazy loading, optimización de imágenes y buen rendimiento en teléfonos modestos.

---

# 31. Pruebas

Crea pruebas:

- Unitarias.
- Componentes.
- Integración.
- End-to-end.
- Seguridad.
- Criptografía.
- Auth.
- Invitaciones.
- RLS.
- Realtime.
- Mensajes.
- Presencia.
- Offline.
- Notificaciones.
- Bloqueo.
- Recuperación.
- Revocación.
- Desvinculación.
- Usuario ajeno.
- Intento de tercer miembro.
- Invitación vencida.
- Lectura de otra relación.
- Escritura no autorizada.
- Payload excesivo.

---

# 32. Documentación

Entrega:

- `README.md`
- `IMPLEMENTATION_PLAN.md`
- `ARCHITECTURE.md`
- `SETUP_SUPABASE.md`
- `SETUP_GITHUB_PAGES.md`
- `DEPLOYMENT.md`
- `SECURITY.md`
- `THREAT_MODEL.md`
- `PRIVACY.md`
- `CRYPTOGRAPHY.md`
- `PWA_IOS_GUIDE.md`
- `PWA_ANDROID_GUIDE.md`
- `NOTIFICATIONS.md`
- `OFFLINE.md`
- `TESTING.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `.env.example`
- `LICENSE`
- Migraciones SQL.
- Políticas RLS.
- Edge Functions.
- Workflows.
- Pruebas.

Variables de frontend:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
VITE_APP_BASE_PATH=
```

Variables privadas de Edge Functions:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

Nunca expongas variables privadas al frontend.

---

# 33. Comandos

Incluye:

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run test:coverage
npm run format
npm run check
npm run deploy
```

Y comandos Supabase:

```bash
supabase start
supabase stop
supabase db reset
supabase migration up
supabase functions serve
supabase functions deploy
```

---

# 34. Fases

1. Proyecto, PWA, diseño y biblioteca pública.
2. Supabase, Auth, perfiles, relación, invitaciones y RLS.
3. Zona privada, PIN, IndexedDB, bloqueo y salida rápida.
4. Cifrado, emparejamiento, recuperación y rotación.
5. Chat, Realtime, presencia, escritura, entrega, lectura y reacciones.
6. Marcapáginas, En la misma página, cartas y pregunta diaria.
7. Nuestro libro, ruleta, citas, recuerdos, universo y regalos.
8. Web Push, Edge Functions e instalación iOS/Android.
9. Offline, sincronización, conflictos y rendimiento.
10. Pruebas, seguridad, documentación, CI/CD y despliegue.

Después de cada fase ejecuta lint, typecheck, pruebas y build. Corrige todos los errores y actualiza `IMPLEMENTATION_PLAN.md`. No te detengas solo en el plan.

---

# 35. Criterios de aceptación

El proyecto está terminado solo cuando:

- Se instala en Android.
- Se agrega a pantalla de inicio en iPhone.
- Abre en modo standalone.
- La biblioteca pública funciona.
- Dos usuarios pueden vincularse.
- Ningún tercero puede entrar.
- Ambos envían y responden mensajes.
- Realtime, presencia y “escribiendo” funcionan.
- Entregado y leído funcionan.
- Los mensajes se almacenan cifrados.
- Supabase no recibe contenido secreto en claro.
- Las notificaciones no revelan contenido.
- El PIN no se guarda en texto plano.
- El bloqueo al minimizar funciona.
- La salida rápida funciona.
- Marcapáginas, cartas, preguntas, citas y recuerdos funcionan.
- Offline funciona en lo previsto.
- RLS bloquea accesos indebidos.
- Todas las pruebas pasan.
- GitHub Actions pasa.
- GitHub Pages despliega correctamente.
- La documentación permite instalar todo desde Windows.

No dejes botones sin funcionalidad, TODO esenciales, código simulado, credenciales embebidas, RLS incompleta, pruebas falsas ni documentación contradictoria. No afirmes que algo funciona si no fue implementado o probado.

---

# 36. Entrega final

Al finalizar:

1. Muestra la estructura del proyecto.
2. Resume lo implementado.
3. Enumera variables que debo completar.
4. Explica cómo crear y configurar Supabase.
5. Explica cómo ejecutar localmente.
6. Explica cómo desplegar Edge Functions.
7. Explica cómo desplegar GitHub Pages.
8. Explica cómo instalar en iPhone y Android.
9. Explica cómo activar notificaciones.
10. Explica cómo crear la relación e invitar al segundo usuario.
11. Enumera limitaciones reales.
12. Indica qué pruebas ejecutaste.
13. Incluye resultados de lint, typecheck, test y build.

---

# 37. Instrucción final para Codex

Inspecciona el repositorio actual. Si está vacío:

1. Inicializa el proyecto.
2. Crea `IMPLEMENTATION_PLAN.md`.
3. Define la arquitectura.
4. Implementa fase por fase.
5. Ejecuta validaciones.
6. Corrige errores.
7. No te detengas hasta dejar una versión funcional.

Prioriza un MVP operativo con:

- PWA.
- Biblioteca pública.
- Dos usuarios.
- Invitación.
- Acceso privado.
- PIN.
- Chat bidireccional.
- Cifrado.
- Realtime.
- Estados de mensaje.
- Presencia.
- Marcapáginas románticos.
- Cartas.
- Pregunta diaria.
- Notificaciones discretas.
- GitHub Pages.
- Supabase.
- Documentación.

Después implementa los módulos románticos adicionales.

La experiencia debe sentirse como **un libro privado que dos personas escriben, viven y construyen juntas**.
