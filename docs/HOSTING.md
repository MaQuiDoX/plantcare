# Publicar PlantCare con planes gratuitos

Guía revisada el 26 de septiembre de 2026. Las cuotas y condiciones pueden cambiar; revisalas en las páginas oficiales antes de contratar o activar facturación.

## Qué opción elegir

Para una primera versión **personal y no comercial**, recomiendo Vercel Hobby con Supabase. Este proyecto utiliza servidor Next.js, Server Actions, procesamiento de imágenes y secretos: no se publica como HTML estático en GitHub Pages.

| Alternativa | Dirección incluida | Ventaja para PlantCare | Límite relevante |
|---|---|---|---|
| Vercel Hobby | Subdominio `vercel.app` | Integración directa con Next.js | Solo uso personal no comercial. Cron gratuito una vez al día y con precisión de una hora. |
| Render Free, Web Service Node | Subdominio `onrender.com` | Ejecuta el servidor Node completo | Se suspende tras 15 minutos sin tráfico; despertar puede tardar aproximadamente un minuto. 750 horas gratuitas compartidas por workspace al mes. |
| Netlify Free | Subdominio `netlify.app` | Adaptador Next.js/OpenNext administrado | 300 créditos mensuales; el proyecto puede pausarse al agotarlos. Las funciones síncronas tienen 60 segundos: los análisis de IA o lotes lentos requieren adaptación y validación. |

Fuentes: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [cron Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Render Free](https://render.com/docs/free), [Netlify Free](https://www.netlify.com/pricing/), [funciones Netlify](https://docs.netlify.com/build/functions/configuration/).

**Hosting gratuito no incluye normalmente registrar un dominio propio** como `plantcare.com`. Podés empezar sin pagar con el subdominio del proveedor y conectar después un dominio comprado a un registrador. Tampoco incluye automáticamente consumos de IA, clima, correo o almacenamiento externo.

## Preparación común

1. Comprobá localmente:

   ```powershell
   npm.cmd ci
   npm.cmd run lint
   npm.cmd run typecheck
   npm.cmd run test
   npm.cmd run build
   npm.cmd run test:e2e
   ```

2. En Supabase, verificá las migraciones 001–006 en orden, Auth y los buckets privados de las fases anteriores. Hacé una copia de seguridad antes de modificar una base con datos reales. No ejecutes scripts de `supabase/tests` contra producción.
3. Creá un repositorio privado en GitHub y publicá el proyecto usando GitHub Desktop o Git. Antes del commit revisá los archivos seleccionados: incluí `package-lock.json`, migraciones e iconos; excluí `.env.local`, `.next`, `node_modules` y resultados de pruebas. Podés verificar que el archivo local no esté versionado con `git ls-files .env.local`: no debe devolver nada. Si alguna clave ya llegó a Git, rotala; borrar el archivo no la quita del historial.
4. Generá las claves VAPID y el secreto del programador según [FASE_6.md](FASE_6.md). Conservá las credenciales en un gestor de contraseñas y configurá los valores en el panel del hosting, no dentro del código.

| Variable | Dónde obtenerla / valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publishable de Supabase, `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | Clave privada Supabase, `sb_secret_...`; solo servidor |
| `APP_URL` | Origen definitivo HTTPS sin ruta; debe coincidir con Supabase Auth |
| `PLANTNET_API_KEY` | Clave de tu cuenta Pl@ntNet |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Clave y modelo disponible en tu proyecto Google; no asumas que el modelo de ejemplo está habilitado |
| `OPENWEATHER_API_KEY` | Clave habilitada para Current Weather |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Par generado con `npm.cmd run push:keys` |
| `VAPID_SUBJECT` | `mailto:` seguido de tu correo de contacto |
| `CRON_SECRET` | Secreto aleatorio independiente, mínimo 32 caracteres |
| `NOTIFICATIONS_ENABLED` | Inicialmente `false`; `true` después de configurar y probar |
| `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL` | Opcionales; correo de recordatorios y dirección de dominio verificado |
| `NEXT_PUBLIC_ENABLE_PWA_DEV` | Omitir o `false` en producción |

Las claves públicas Supabase se exponen por diseño y dependen de RLS. Ninguna otra clave privada debe llevar prefijo `NEXT_PUBLIC_`. Cambiar variables públicas exige un nuevo build. Conservá envíos desactivados y una base independiente en entornos de preview.

## Opción recomendada: Vercel, paso a paso

1. Creá una cuenta en Vercel y elegí el plan Hobby si tu uso cumple su condición personal no comercial.
2. Seleccioná **Add New → Project**, conectá GitHub y elegí el repositorio de PlantCare. La carpeta raíz debe ser la que contiene `package.json`.
3. Elegí el preset **Next.js**. Build: `npm run build`. Instalación: `npm ci`. Conservá la salida predeterminada del preset; no uses exportación estática ni carpeta `out`. Seleccioná Node.js 22.x en la configuración del proyecto.
4. Agregá las variables anteriores para **Production**. Usá la dirección estable asignada al proyecto en `APP_URL`. Si todavía no la conocés, publicá inicialmente con notificaciones desactivadas, obtené esa dirección, corregí la variable y hacé **Redeploy** antes de probar Auth.
5. Pulsá **Deploy**. Ante un fallo revisá Build Logs. El proyecto necesita sus dependencias de desarrollo durante el build; no uses `npm ci --omit=dev` para esa etapa.
6. Configurá Supabase Auth como se explica en la sección siguiente. Probá acceso, una planta, una foto, agenda, calculadora e IA si configuraste sus claves.
7. Abrí `/manifest.webmanifest` y `/sw.js`; deben responder correctamente. Instalá la PWA y registrá tu dispositivo desde Avisos e instalación.
8. Completá la configuración del programador más abajo, activá `NOTIFICATIONS_ENABLED=true` y redesplegá. Probá con tu propia cuenta antes de invitar usuarios.

El archivo `vercel.json` incluido programa `/api/jobs/notifications` a las 12:15 UTC una vez al día. En Argentina corresponde a las 09:15 con UTC−3, pero Hobby puede ejecutarlo dentro de esa hora. Vercel envía `CRON_SECRET` como `Authorization: Bearer ...` cuando está configurado. El endpoint admite GET y POST y rechaza el secreto en query string. [Seguridad del cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)

**Ese cron diario no alcanza para alertas climáticas oportunas ni para vaciar una cola grande.** Cada llamada revisa hasta cinco usuarios y diez entregas. Si preferís el programador horario que se describe abajo, quitá la propiedad `crons` de `vercel.json` y redesplegá para no mantener dos programadores. Los bloqueos evitan reservar simultáneamente el mismo trabajo, pero ejecutar dos cron no aporta precisión.

## Supabase Auth y correo después del despliegue

1. En Supabase → Authentication → URL Configuration, fijá **Site URL** al mismo origen HTTPS de `APP_URL`.
2. En **Redirect URLs**, agregá ese origen seguido de `/auth/confirm`. Conservá `http://localhost:3000/auth/confirm` solo si seguís usando ese proyecto para desarrollo. Evitá comodines amplios en producción.
3. Usá las plantillas de [FASE_2.md](FASE_2.md): esta aplicación verifica `token_hash`. Para confirmación el enlace es `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=signup`; para recuperación termina en `type=recovery`.
4. Configurá SMTP y remitente verificado para enviar registro y recuperación a usuarios reales. La API Resend de recordatorios no configura SMTP de Supabase automáticamente. Si no usás email para avisos, podés dejar vacías las dos variables Resend del hosting.
5. Probá un registro y una recuperación reales. Los enlaces deben volver al dominio correcto y terminar en una sesión válida, sin redirección a localhost.

## Dominio propio y HTTPS

Podés conservar el subdominio gratuito indefinidamente mientras el proveedor lo permita. Para un dominio que ya tengas o decidas comprar:

1. En Vercel → proyecto → Settings → Domains, agregá el dominio y, si corresponde, `www`. Elegí cuál será el principal.
2. En el panel DNS de tu registrador, copiá **exactamente** los registros que indique Vercel para ese proyecto. Habitualmente hay A/ALIAS para la raíz y CNAME para subdominios; no copies una IP genérica de una guía vieja.
3. Conservá los registros MX/TXT/DKIM que utilicen tus correos. Esperá la propagación y la verificación de Vercel; el certificado HTTPS se emite automáticamente cuando la configuración es válida.
4. Actualizá `APP_URL`, Site URL y Redirect URLs de Supabase al dominio principal. Redesplegá y repetí confirmación y recuperación.
5. Abrí PlantCare desde el nuevo dominio, instalala y reconectá push: sesiones, permisos y suscripciones pertenecen al origen anterior. No cambies el par VAPID por cambiar el dominio.

[Agregar dominio en Vercel](https://vercel.com/docs/domains/working-with-domains/add-a-domain), [configuración DNS y certificado](https://vercel.com/docs/domains/set-up-custom-domain).

## Programador horario con GitHub Actions

Esta opción llama a tu servidor; no aloja Next.js ni sustituye Supabase. Es apropiada para una prueba personal con tolerancia a retrasos, no para alarmas exactas. GitHub puede demorar ejecuciones programadas; el archivo debe estar en la rama predeterminada. En repositorios públicos, los horarios pueden desactivarse tras 60 días sin actividad. [Programación de workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

GitHub Free incluye 2.000 minutos al mes para repositorios privados. Una ejecución horaria son aproximadamente 720–744 trabajos mensuales, pero el costo real depende de duración, redondeo y otros workflows; revisá Billing y no habilites gasto adicional si querés mantenerte en la cuota. [Cuotas incluidas](https://docs.github.com/en/billing/reference/product-usage-included)

1. Publicá y verificá el servidor primero. Si usás esta opción, retirale el cron diario de Vercel.
2. En GitHub → repositorio → Settings → Secrets and variables → Actions, creá el **secret** `PLANTCARE_CRON_SECRET` con el mismo valor que `CRON_SECRET` del hosting.
3. En **Variables**, creá `PLANTCARE_URL` con el origen HTTPS definitivo, sin barra final. No uses una dirección temporal de preview.
4. Creá `.github/workflows/plantcare-notifications.yml` con el siguiente contenido y guardalo en la rama predeterminada. El código queda aquí como ejemplo para activarlo cuando publiques; esta implementación no lo ejecuta en tus cuentas.

```yaml
name: Recordatorios PlantCare
on:
  workflow_dispatch:
  schedule:
    - cron: '17 * * * *'
permissions: {}
concurrency:
  group: plantcare-notifications
  cancel-in-progress: false
jobs:
  dispatch:
    runs-on: ubuntu-latest
    timeout-minutes: 4
    env:
      PLANTCARE_URL: ${{ vars.PLANTCARE_URL }}
      JOB_SECRET: ${{ secrets.PLANTCARE_CRON_SECRET }}
    steps:
      - name: Revisar avisos y despachar pendientes
        shell: bash
        run: |
          set -euo pipefail
          test -n "$PLANTCARE_URL"
          test -n "$JOB_SECRET"
          curl --fail --silent --show-error --max-time 130 \
            --proto '=https' \
            --request POST \
            --header "Authorization: Bearer $JOB_SECRET" \
            "$PLANTCARE_URL/api/jobs/notifications" > result.json
          cat result.json
          jq -e '.enabled != false and .scanFailures == 0 and .weatherFailures == 0 and .deliveryFailures == 0' result.json
```

5. En Actions ejecutá **Run workflow**. Debe mostrar contadores, sin secretos, y finalizar correctamente. `enabled:false` hará fallar la verificación hasta que actives envíos en el hosting. Los fallos parciales también requieren revisar configuración y cola.
6. Verificá la próxima ejecución automática. Una hora es un compromiso de costo; puede perder extremos entre observaciones y retrasar riegos. Para mayor precisión necesitás otro presupuesto/frecuencia y comprobar que la cola no crezca. No cambies a cada cinco minutos sin calcular cuotas.

## Alternativa: Render Free

1. Creá una cuenta, conectá el repositorio y seleccioná **New → Web Service**, no Static Site.
2. Seleccioná el runtime Node y la instancia Free. Configurá Node 22 mediante `NODE_VERSION=22` y las variables de la tabla anterior. [Versión de Node](https://render.com/docs/node-version)
3. Build command: `npm ci && npm run build`. Start command: `npm run start -- --hostname 0.0.0.0 --port $PORT`. Estos comandos corren en Linux en Render.
4. Desplegá, copiá el origen `onrender.com` a `APP_URL`, actualizá Supabase Auth y volvé a desplegar. Aplicá las mismas pruebas funcionales y de fotos; Sharp y el build consumen memoria, por lo que verificá que tu instancia complete ambos antes de elegirla definitivamente.
5. Para dominio propio abrí Settings → Custom Domains y seguí los registros DNS que muestre Render. Mantené el origen principal coherente en Auth. [Dominios Render](https://render.com/docs/custom-domains)
6. Render no interpreta el cron de `vercel.json`. Si necesitás despachos, configurá el programador externo anterior y medí sus tiempos incluyendo el arranque en frío.

Supabase conserva las fotos y los datos; no uses el disco temporal del servicio para guardarlos. La suspensión del plan gratuito y los límites de recursos lo hacen más adecuado para demostraciones que para recordatorios puntuales. No dependas de llamadas de mantenimiento para simular disponibilidad garantizada.

## Alternativa condicionada: Netlify Free

Netlify administra la integración Next.js mediante OpenNext. La app utiliza funciones de servidor, por lo que hay que conservar esa integración. [Compatibilidad Next.js](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)

1. Conectá el repositorio mediante **Add new project → Import an existing project**.
2. Aceptá la detección de Next.js y su salida predeterminada; build `npm run build`, Node 22. No configures exportación estática ni agregues una versión antigua del adaptador manualmente.
3. Agregá las variables de entorno, con `NOTIFICATIONS_ENABLED=false` al principio. Desplegá y fijá `APP_URL` al origen `netlify.app` asignado; actualizá Auth y redesplegá.
4. Probá acceso, acciones, subida/procesamiento de imágenes y análisis de IA con tiempos reales. **El código actual permite operaciones que pueden superar los 60 segundos de una función síncrona de Netlify**. `maxDuration=120` en Next no aumenta ese límite. Antes de habilitar trabajos, hay que adaptar los casos lentos a ejecución en segundo plano o reducir presupuestos de tiempo y validar de nuevo. Por eso no es la recomendación principal para esta versión.
5. Solo después de esa adaptación configurá el programador externo y los envíos. Para un dominio, usá Domain management y copiá los registros indicados por el panel; actualizá Auth y probá HTTPS.
6. Revisá el consumo de créditos tras builds, fotos e IA. Alcanzar el cupo puede detener el sitio, incluidos los recordatorios.

## Consejos prácticos

- Empezá con el subdominio gratuito y una cuenta propia; conectá un dominio después de validar el flujo completo.
- El plan gratuito Supabase consultado incluye 500 MB de base, 1 GB de archivos y 5 GB de egreso; puede pausar proyectos tras una semana de inactividad. Vigilá fotos, transferencia y estado del proyecto. [Planes Supabase](https://supabase.com/pricing)
- Hacé copias periódicas de datos y archivos. Git conserva código y migraciones, no las fotos ni la base administrada.
- Separá claves y base de pruebas de producción. Deshabilitá cron y correo en previews. Los secretos Supabase, VAPID y cron no deben llegar al navegador.
- Configurá límites de gasto en cada proveedor de IA y correo. Un hosting gratis no convierte automáticamente esas APIs en gratuitas.
- Medí trabajos pendientes, antigüedad de la cola y errores; no interpretes HTTP 200 como entrega garantizada. Para crecer, presupuestá un programador fiable y procesamiento dedicado.
- Conservá una versión conocida que compile para rollback del frontend. Revertir una migración con datos requiere un plan aparte.
- Antes de compartir el enlace, probá desde otro usuario, teléfono y red: acceso, RLS, fotos privadas, instalación, cierre de sesión, push y recuperación de contraseña.

No se creó una cuenta, compró un dominio, publicó el repositorio ni desplegó la aplicación durante esta fase. Esta guía permite realizar esos pasos en tus cuentas cuando elijas el proveedor.
