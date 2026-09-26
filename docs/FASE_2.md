# Fase 2 — Configuración, autenticación y dashboard

## Qué construimos y por qué

Next.js renderiza el catálogo en el servidor. Supabase Auth mantiene la identidad y la sesión mediante cookies administradas por `@supabase/ssr`. El proxy renueva tokens y las operaciones privadas verifican al usuario con `getUser()`. PostgreSQL aplica además las políticas RLS de la Fase 1.

Registro, login, reenvío de confirmación, recuperación, cambio de contraseña y logout se ejecutan mediante Server Actions con validación Zod. Next.js verifica el origen de estas acciones; no se implementan endpoints GET para mutaciones como el cierre de sesión. El enlace de correo es la excepción: su token de un solo uso se verifica en `/auth/confirm`, con destinos internos fijos y sin cachear la respuesta.

Las pantallas de autenticación y el dashboard son dinámicos. El catálogo requiere sesión, filtra por propietario y muestra sólo ejemplares no archivados. Incluye búsqueda por apodo, paginación de 12 elementos y contadores reales. La creación/edición de plantas y las fotos de sus fichas se implementarán en Fase 3; por eso las tarjetas actuales usan un icono botánico y no ofrecen acciones inexistentes.

## Stack instalado

- Next.js 16.3.6, React 19.3.0 y TypeScript 6.0.3.
- Supabase SSR 0.12.7 y supabase-js 2.117.2.
- Tailwind CSS 4.3.3, Zod 4.6.5 y Lucide.
- Vitest y Playwright para pruebas.

Las dependencias directas y transitivas están fijadas en `package-lock.json`. Se requiere Node.js 22 o superior; se verificó el entorno con Node.js 24.21.0. No se depende de fuentes remotas ni de imágenes de terceros para renderizar la interfaz.

## Archivos y modelo

```text
src/
  app/
    (auth)/
      layout.tsx
      login/page.tsx
      register/page.tsx
      forgot-password/page.tsx
      reset-password/page.tsx
    (dashboard)/
      layout.tsx
      plants/{page,loading}.tsx
    auth/confirm/route.ts
    auth/error/page.tsx
    setup/page.tsx
    {layout,page,error,not-found}.tsx
    globals.css
  components/{brand,plant-illustration,dashboard-shell}.tsx
  features/
    auth/{actions,session,validation}.ts
    auth/{auth-form,logout-button}.tsx
    plants/queries.ts
  lib/env.ts
  lib/supabase/server.ts
  proxy.ts
supabase/
  migrations/202609250001_initial_schema.sql
  migrations/202609250002_profile_display_name.sql
  tests/phase1.sql
tests/
  unit/auth.test.ts
  fixtures/supabase.mjs
  e2e/auth.spec.ts
```

Se reutilizan `auth.users`, `public.users`, `user_plants` y `plants`. La segunda migración actualiza el trigger para copiar el nombre de presentación durante el registro; no modifica permisos ni almacena contraseñas en tablas de negocio.

Schemas de entrada completos: `src/features/auth/validation.ts`. Las lecturas del catálogo y perfil se validan en runtime con Zod en `src/features/plants/queries.ts`, y `PlantCard` se deriva de ese schema. No se presentan tipos de base generados ficticiamente: cuando exista conexión, podremos generar el schema completo con la CLI de Supabase. En esta fase no se necesita un cliente de navegador ni una clave administrativa porque todas las operaciones van por el servidor.

## Inicialización reproducible

El proyecto ya está inicializado; no ejecutes create-next-app encima de estos archivos.

En PowerShell:

```powershell
Set-Location C:\Users\Matias\Desktop\PlantCare
npm.cmd ci
Copy-Item .env.example .env.local
```

Si `.env.local` ya existe, conservá su contenido y editá sólo las variables necesarias.

1. En Supabase creá un proyecto de desarrollo.
2. En SQL Editor, como postgres, ejecutá `202609250001_initial_schema.sql` si aún no fue aplicada. No la repitas sobre tablas existentes.
3. Ejecutá `202609250002_profile_display_name.sql`.
4. Ejecutá `supabase/tests/phase1.sql`. Debe devolver PASS; la prueba revierte sus datos.
5. En Connect / API Keys copiá Project URL y la clave **publishable**, que comienza por `sb_publishable_`.
6. En `.env.local`, completá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Dejá `APP_URL=http://localhost:3000` en desarrollo. Nunca pegues una clave `sb_secret_`, service_role o JWT legacy: esta implementación sólo acepta claves públicas modernas.

## Configurar Auth y los correos

En Supabase Authentication:

1. Habilitá Email/password y **Confirm email**.
2. Configurá una longitud mínima de contraseña de **12** caracteres, consistente con la aplicación. Permitimos frases y hasta 128 caracteres; no recortamos ni transformamos contraseñas.
3. En URL Configuration, establecé Site URL como `http://localhost:3000`.
4. Agregá `http://localhost:3000/auth/confirm` a Redirect URLs.
5. En Email Templates reemplazá el enlace de **Confirm signup** por:

```html
<h2>Tu jardín te espera</h2>
<p>Confirmá tu correo para comenzar a usar PlantCare.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=signup">Confirmar mi cuenta</a></p>
```

6. Reemplazá el enlace de **Reset password** por:

```html
<h2>Recuperá tu acceso a PlantCare</h2>
<p>Abrí este enlace para elegir una nueva contraseña.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Cambiar mi contraseña</a></p>
<p>Si no solicitaste este cambio, podés ignorar el mensaje.</p>
```

No uses el enlace predeterminado basado en fragmentos del navegador: esta aplicación verifica `token_hash` en el servidor. Si un escáner de correo consume el enlace, solicitá otro; los tokens no se reutilizan. En producción configurá un origen HTTPS, Site URL y Redirect URLs consistentes, y SMTP transaccional con remitente verificado. El proveedor de correo predeterminado de Supabase está limitado y no reemplaza una configuración de entrega para usuarios reales.

Las cuotas y límites de Auth se configuran en Supabase. Sin SMTP propio, usá para las pruebas una dirección autorizada del equipo del proyecto; el correo predeterminado no entrega a destinatarios arbitrarios. Los correos de registro y recuperación se solicitan allí; el código no incorpora un servicio de correo independiente ni realiza envíos durante las pruebas simuladas.

## Ejecutar

```powershell
npm.cmd run dev
```

Abrí http://localhost:3000. Sin variables válidas, `/plants` redirige a `/setup` y `/login` permite revisar la interfaz con el formulario deshabilitado. Después de modificar variables reiniciá Next.js. Configurá las variables antes de compilar para despliegue: Next.js fija variables NEXT_PUBLIC durante el build.
  
Para probar la compilación de producción, detené el servidor de desarrollo y ejecutá:

```powershell
npm.cmd run build
npm.cmd run start
```

## Prueba manual con Supabase real

1. Sin sesión, abrir `/plants`: debe redirigir a `/login`.
2. Crear una cuenta A con un correo que controles. Probar contraseña corta y confirmación diferente: no deben aceptarse.
3. Abrir el correo de confirmación: debe terminar en `/plants`, con saludo y colección vacía. En Supabase, verificar la fila `public.users` y su nombre.
4. Recargar y abrir una nueva pestaña: la sesión debe persistir. Abrir `/login` con sesión debe volver al dashboard.
5. Cerrar sesión. Volver a `/plants`: debe pedir autenticación. Un intento con contraseña incorrecta debe mostrar un error comprensible.
6. Solicitar recuperación. Abrir el enlace, cambiar la contraseña, cerrar sesión y entrar con la nueva. Reutilizar el enlace consumido debe mostrar la pantalla de enlace inválido.
7. Solicitar reenvío para otra cuenta todavía sin confirmar y comprobar el correo.
8. Crear una cuenta B en una ventana privada. Para probar el catálogo antes de Fase 3, agregar un ejemplar de prueba desde Supabase Table Editor en `user_plants`: `user_id` de A, `nickname` de tu elección, `placement=indoor` y `plant_id=NULL`. Debe aparecer sólo en A. No hace falta inventar una especie global.
9. En A buscar el apodo y otro texto que no coincida. Verificar tarjeta, contadores y estado sin resultados. Para paginación, crear al menos 13 registros y recorrer ambas páginas.
10. Probar la interfaz a 390 px de ancho y la navegación por teclado. Los campos tienen etiquetas, errores asociados y estados pendientes; se respeta movimiento reducido.

El logout cierra la sesión de este navegador. Los JWT ya emitidos pueden seguir siendo válidos hasta expirar para acceso directo a APIs; no se promete revocación instantánea de todos los dispositivos.

## Pruebas automatizadas y límites

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

- Vitest comprueba validación de formularios, límites de contraseñas, errores seguros y configuración pública.
- Playwright inicia un servidor HTTP de contrato en 54329 y Next.js en 3100, con variables ficticias sólo para ese proceso. Verifica registro, confirmación, login, recuperación, persistencia, logout, búsqueda y ausencia de desbordamiento horizontal. Las capturas se guardan en `test-results`.
- Los datos del servidor de contrato están en `tests/fixtures`; la aplicación no importa ese código ni puede activar un acceso de prueba.
- Estas pruebas no comprueban que Supabase real envíe correos, aplique migraciones o imponga RLS. Ejecutá el protocolo manual y la prueba SQL antes de aprobar el cierre de esta fase para producción.
- El acceso al catálogo ya está implementado. CRUD, diario, subida de fotos, IA, agenda adaptativa, notificaciones y PWA siguen reservados a sus fases.

## Fuentes oficiales

Validación local realizada el 25/09/2026: ESLint sin advertencias, TypeScript correcto, 8 pruebas unitarias y 5 pruebas Playwright aprobadas, build de producción exitoso. Se inspeccionaron capturas de escritorio y móvil. No se conectó un proyecto Supabase real ni se ejecutaron sus migraciones desde este entorno.

- Next.js: https://nextjs.org/docs/app/getting-started/installation
- Supabase SSR: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- Flujo de confirmación: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- Sesiones y revocación: https://supabase.com/docs/guides/auth/server-side/advanced-guide
- SMTP: https://supabase.com/docs/guides/auth/auth-smtp
