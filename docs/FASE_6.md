# Fase 6 — Avisos, clima e instalación PWA

## Qué construimos

La aplicación genera avisos privados en PostgreSQL y los guarda separados de sus intentos de envío. Un proceso invocado por un programador externo revisa usuarios, actualiza el clima autorizado y despacha una cola limitada. Esto permite reintentar fallos sin depender de que el usuario tenga abierta la página. El Service Worker recibe push e instala una pantalla pública de reconexión; no guarda fichas, fotografías ni sesiones en Cache Storage.

Los avisos de riego recomiendan **comprobar el sustrato**, no regar automáticamente. Los avisos meteorológicos son reglas sobre observaciones de OpenWeather, no alertas oficiales ni pronósticos de emergencia.

## Archivos y modelo

```text
supabase/migrations/202609260006_notifications_pwa.sql
supabase/tests/phase6.sql
src/features/notifications/
  actions.ts       Preferencias, dispositivos, lectura y revisión manual
  schemas.ts       Validación de suscripciones y preferencias
  config.ts        Configuración privada y cliente administrativo
  delivery.ts      Adaptadores Web Push y Resend
  worker.ts        Generación y despacho por lotes
  controls.tsx     Formularios y permiso explícito del navegador
src/features/pwa/provider.tsx
src/app/(dashboard)/plants/notifications/page.tsx
src/app/api/jobs/notifications/route.ts
src/app/manifest.ts
public/sw.js
public/offline.html
public/icons/
scripts/generate-pwa-icons.mjs
tests/unit/notifications.test.ts
tests/e2e/pwa.spec.ts
vercel.json
```

El SQL completo y ejecutable está en la migración 006. Amplía los modelos existentes:

| Modelo | Campos y función |
|---|---|
| `users` | Preferencias `care_alerts`, `seasonal_alerts`, `weather_alerts`; marcador privado `season_marker`. Reutiliza zona horaria, hora preferida y canales push/email. |
| `alerts` | Aviso del propietario, contexto JSON para verificar vigencia, vencimiento, lectura y clave de deduplicación. |
| `push_subscriptions` | Hasta cinco dispositivos por usuario; endpoint HTTPS permitido y claves Web Push. El registro pasa por una función autenticada. |
| `notification_deliveries` | Un envío por aviso/canal/dispositivo; estado, intentos, próximo intento, bloqueo temporal y token de procesamiento. |
| `notification_scan_state` | Próxima revisión por usuario; acceso exclusivo del servidor. |

Las políticas RLS aíslan usuarios. Las funciones administrativas de generación, reserva y confirmación solo se ejecutan con el rol de servicio. El cliente nunca recibe `SUPABASE_SECRET_KEY`, la clave privada VAPID ni claves de proveedores.

## Reglas operativas

- Riego: un aviso diario por agenda vencida, después de la hora preferida en la zona del usuario. Revalida la agenda y el último riego antes de enviar; pausar, archivar o registrar un riego vuelve obsoleto el pendiente.
- Estación: usa hemisferio y estación meteorológica. La primera revisión establece una referencia sin emitir un falso cambio. Cambiar de hemisferio vuelve a establecerla. El aviso expira a los tres días.
- Clima: observaciones frescas y correspondientes a las coordenadas actuales. Frío ≤5 °C, calor ≥35 °C o lluvia ≥10 mm en una hora. Una alerta de cada tipo por día y ubicación; vence con la observación. Una observación posterior invalida el envío de la anterior.
- Activar clima permite consultas automáticas con las coordenadas guardadas. Sin clave OpenWeather no se consulta el proveedor; no se inventan datos.
- Cada llamada procesa como máximo cinco usuarios y diez entregas. Un usuario vuelve a ser elegible después de 15 minutos. Hay hasta cinco intentos de entrega, con espera creciente y bloqueo de cinco minutos recuperable si el proceso se interrumpe.
- Los avisos leídos, vencidos o deshabilitados dejan de enviarse. El historial se limpia después de 30 días cuando se vuelve a revisar a su propietario.
- La entrega es de mejor esfuerzo: navegador, sistema operativo, red y frecuencia del programador influyen. La cola no promete entrega exactamente una vez. Resend usa una clave de idempotencia; el proveedor la conserva 24 horas. Web Push usa un identificador estable para agrupar el aviso. [Resend](https://resend.com/changelog/idempotency-keys)

## Configuración paso a paso

1. En Supabase, hacé una copia de seguridad y aplicá las migraciones 001–005 si faltan. Luego ejecutá **una vez** `supabase/migrations/202609260006_notifications_pwa.sql` en SQL Editor. No ejecutes `supabase/tests/phase6.sql` sobre producción: es una prueba local con usuarios ficticios.
2. En la terminal del proyecto, instalá dependencias y generá el par de claves:

   ```powershell
   npm.cmd ci
   npm.cmd run push:keys
   ```

   Copiá `publicKey` a `VAPID_PUBLIC_KEY` y `privateKey` a `VAPID_PRIVATE_KEY` en `.env.local`. Conservá el mismo par en sucesivos despliegues; rotarlo requiere reconectar los dispositivos. No subas la salida a Git ni la compartas. [Web Push](https://github.com/web-push-libs/web-push)

3. Configurá `VAPID_SUBJECT` como `mailto:` seguido de tu correo real de contacto. Usá la clave secreta actual de Supabase (`sb_secret_...`) en `SUPABASE_SECRET_KEY`. Generá otro secreto independiente para el programador:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Guardá esa salida en `CRON_SECRET`. La API exige al menos 32 caracteres. No uses la clave Supabase para este propósito.
4. Conservá `NOTIFICATIONS_ENABLED=false` mientras configurás. Usá `APP_URL=http://localhost:3000` localmente y el origen HTTPS definitivo en producción. En desarrollo agregá `NEXT_PUBLIC_ENABLE_PWA_DEV=true` y reiniciá Next. En producción el Service Worker se activa sin esa variable.
5. Para clima completá `OPENWEATHER_API_KEY`, configurá ubicación y zona horaria en la agenda y activá el permiso de clima en **Mis Plantas → Avisos e instalación**.
6. El correo es opcional. Si querés habilitarlo: verificá un dominio remitente en Resend, agregá los registros DNS que indique su panel, creá una API key de envío y configurá `RESEND_API_KEY` y `NOTIFICATION_FROM_EMAIL` con una dirección de ese dominio, sin nombre de presentación. El usuario debe tener su email confirmado y elegir ese canal. **Esto es independiente de SMTP de Supabase Auth**: podés usar push aunque todavía no hayas resuelto Resend para el acceso.
7. Abrí la pantalla de avisos, elegí preferencias, pulsá **Activar o reconectar este dispositivo** y aceptá el permiso. Confirmá que aparezca el dispositivo y que el canal push esté activado. Si el navegador bloqueó el permiso, cambialo en los permisos del sitio.
8. Para envíos reales cambiá `NOTIFICATIONS_ENABLED=true`, reiniciá o redesplegá y configurá el programador según [HOSTING.md](HOSTING.md). Sin invocaciones al endpoint no hay envíos en segundo plano. El botón **Revisar avisos ahora** genera la bandeja con los datos disponibles, pero no envía directamente ni actualiza el clima por sí solo.

## Pruebas antes de publicar

### Automáticas, sin proveedores externos

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Las pruebas SQL corren las seis migraciones en PGlite y comprueban RLS, aislamiento, deduplicación, reserva de trabajos y cancelación tras regar. Los adaptadores se prueban con respuestas simuladas. Playwright utiliza Supabase simulado y desactiva las claves externas; verifica bandeja, preferencias, privacidad entre cuentas, manifest, iconos y desconexión. Esto no demuestra entrega real en un teléfono ni compatibilidad de un hosting concreto.

### PWA en un dispositivo real

1. En producción HTTPS, ingresá y abrí Avisos e instalación. En Chrome/Edge usá el botón o el menú de instalación. En iPhone/iPad usá Safari → Compartir → Añadir a pantalla de inicio, abrí el icono y recién entonces activá push. Web Push en aplicaciones de pantalla de inicio requiere iOS/iPadOS 16.4 o posterior. [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
2. Comprobá el icono, apertura independiente y acceso con sesión. Desconectá la red y recargá: debe aparecer la pantalla pública de reconexión, sin mostrar datos privados almacenados por el Service Worker.
3. Reconectá y pulsá reintentar. En DevTools → Application → Cache Storage debe haber solo recursos públicos `plantcare-public-*`.
4. Para cambios futuros en recursos offline, incrementá la versión `CACHE` de `public/sw.js`. Tras desplegar, verificá el aviso de actualización y guardá formularios antes de aplicarlo.

### Push, correo y cancelación

1. Con una cuenta de prueba propia, configurá una agenda vencida, hora preferida anterior a la actual y canal push. No marques el aviso como leído durante esta prueba.
2. Guardá el secreto del programador temporalmente en una variable de entorno de tu terminal; el siguiente ejemplo lo pide sin mostrarlo ni guardarlo en el historial de comandos:

   ```powershell
   $jobSecret = Read-Host 'CRON_SECRET' -AsSecureString
   $jobCredential = [System.Net.NetworkCredential]::new('', $jobSecret)
   $plantcareOrigin = Read-Host 'Origen de PlantCare (https://...)'
   Invoke-RestMethod -Method Post -Uri "$plantcareOrigin/api/jobs/notifications" -Headers @{ Authorization = "Bearer $($jobCredential.Password)" }
   Remove-Variable jobSecret, jobCredential
   ```

   Esto envía a los usuarios que lo hayan activado. Usá un entorno de prueba para no notificar cuentas reales accidentalmente. Sin autorización devuelve 401; con envíos deshabilitados devuelve `enabled:false`. No pongas el secreto en la URL.
3. Esperá el aviso genérico, abrilo y verificá la bandeja protegida. Si `scanned` es cero, puede seguir vigente el intervalo de revisión; esperá al menos 15 minutos. `processed` cuenta trabajos reservados, no confirma que un dispositivo haya mostrado un mensaje.
4. Revisá los contadores `scanFailures`, `weatherFailures`, `deliveryFailures` y, desde el panel administrativo, los estados de `notification_deliveries`. Un HTTP 200 con fallos parciales necesita atención. No publiques endpoints de suscripciones ni secretos en logs.
5. Registrá un riego o pausá la agenda antes del siguiente despacho y verificá que no se envíe su recordatorio pendiente. Repetí con lectura del aviso y con el canal desactivado. Eliminá un dispositivo y verificá que no siga recibiendo.
6. Para correo, repetí con tu dirección confirmada y el canal email activado. Revisá remitente, bandeja de spam y registros de Resend. No se ha realizado ningún envío real como parte de la implementación local.
7. Las pruebas SQL cubren temperaturas y cambios de estación controlados. Para validar OpenWeather real, guardá coordenadas reales y verificá una observación actual; la ausencia de extremos debe producir **cero** alertas meteorológicas.

## Límites y operación

La PWA es instalable y recibe push, pero editar plantas y ver fotos requiere conexión. El cierre de sesión intenta cancelar la suscripción de ese navegador, con tiempo limitado para no bloquear la salida; otros dispositivos permanecen registrados. Los mensajes son genéricos también por esa razón.

El cron diario incluido sirve para una demostración personal pequeña. Con cinco usuarios revisados y diez entregas por ejecución, no sirve para una comunidad ni alertas meteorológicas oportunas. Para una operación mayor necesitás mayor frecuencia, dimensionar lotes/tiempos, observar la antigüedad de la cola y eventualmente un worker dedicado. No aumentes lotes sin medir el tiempo máximo del hosting.

La migración remota, las credenciales, las pruebas de entrega real y el despliegue se completan en tus cuentas siguiendo esta guía; no se ejecutaron desde las pruebas locales.
