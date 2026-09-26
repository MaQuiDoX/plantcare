# Fase 4 — Identificación y revisión de salud por IA

## Qué construimos

Una foto se valida y normaliza en el servidor antes de enviarse al proveedor. Pl@ntNet propone hasta tres especies, con nombres comunes, familia y puntuación de coincidencia. Gemini genera una ficha orientativa de iluminación, ubicación, temperatura, riego y sustrato para esas especies. El usuario compara las opciones y confirma una: recién entonces se crea un ejemplar o se actualiza la especie de uno existente.

Para revisar salud, Gemini recibe la foto, la especie anotada y las observaciones opcionales del usuario. Devuelve causas posibles, evidencia visible, incertidumbre, medidas conservadoras, comprobaciones y cuándo consultar. Puede indicar que la foto no es evaluable. No confirma enfermedades ni aplica tratamientos, cambios de riego o modificaciones automáticas a la ficha.

El historial guarda resultados privados y su procedencia. Las fichas generadas no se incorporan al catálogo global de especies revisadas. La ubicación, luz real y maceta anotadas por el usuario se conservan al confirmar una especie. Cambiar manualmente la especie elimina los cuidados de IA anteriores para evitar recomendaciones incoherentes.

## Estructura

```text
src/features/ai/
  config.ts         Configuración privada y cliente administrativo limitado a este módulo
  schemas.ts        Contratos Zod de candidatos, cuidados y diagnóstico
  providers.ts      Adaptadores HTTP de Pl@ntNet y Gemini
  actions.ts        Autenticación, validación, reserva, envío y confirmación
  queries.ts        Lectura del historial con filtro de propietario
  forms.tsx         Carga de foto, consentimiento, selección y estados pendientes
  care-view.tsx     Presentación de los cuidados generados
src/app/(dashboard)/plants/
  analyze/page.tsx             Identificación o revisión de una planta existente
  analyses/page.tsx            Historial paginado
  analyses/[id]/page.tsx       Resultado, procedencia y confirmación de especie
  [id]/page.tsx                Accesos a IA y cuidados aceptados
supabase/
  migrations/202609260004_ai_analyses.sql
  tests/phase4.sql
tests/
  unit/ai.test.ts
  unit/ai-actions.test.ts
  unit/database.test.ts
  e2e/ai.spec.ts
```

## Modelo de datos y transacciones

La migración 004 amplía el esquema existente:

| Entidad | Cambios y finalidad |
| --- | --- |
| `ai_analyses` | Foto inicialmente opcional; planta asociada opcional, ruta de entrada, observaciones y fecha de aceptación. Mantiene estado, propietario, proveedor, modelo solicitado, versión de contrato, resultado y error seguro. |
| `ai_usage` | Registro independiente por intento para limitar consumo, incluso si se elimina el ejemplar y su historial. Solo el servidor puede leer o modificar este registro. |
| `user_plants.ai_profile` | JSON con `analysisId` y candidato aceptado, incluidos sus cuidados si están disponibles. |
| `media_assets` | Reutilizado para la foto privada; al eliminar un archivo se conserva el análisis con referencia de foto nula. |
| `storage_cleanup` | Reutilizado como cola durable para archivos fallidos o eliminados. |

`begin_ai_analysis` y `finish_ai_analysis` son funciones disponibles solo para `service_role`. La Server Action verifica primero la sesión con Supabase Auth y nunca acepta un identificador de propietario enviado por el navegador. El cliente con clave secreta se crea exclusivamente en un módulo `server-only`, sin persistencia de sesión.

La reserva serializa solicitudes por cuenta: máximo 5 inicios en una ventana móvil de 24 horas y un análisis activo. Los fallos también consumen un intento. El UUID del formulario identifica el intento; repetirlo vuelve al resultado existente sin reenviar la imagen ni consumir otro intento. Los intentos interrumpidos pasan a fallidos cuando se inicia otro después de cinco minutos. La pantalla también reconoce esa antigüedad y ofrece consultar el estado o iniciar otra consulta.

La confirmación usa `apply_ai_identification`, disponible para usuarios autenticados. Comprueba propietario, estado, candidato, planta activa y versión de ficha. Es atómica e idempotente. No se puede falsificar un resultado escribiendo directamente en `ai_analyses` desde el cliente. Una edición simultánea obliga a recargar el resultado y revisar la ficha antes de volver a confirmar.

Las fotos se aceptan como JPEG/PNG/WebP estático de hasta 3 MiB y 40 megapíxeles. Sharp verifica los píxeles, corrige orientación, elimina metadatos y reduce a un máximo de 1800 × 1800. Se guardan como WebP; el adaptador de Pl@ntNet convierte a JPEG antes del envío. La visualización usa la ruta autenticada existente, sin URLs públicas.

Cada solicitud HTTP al proveedor tiene un límite de 30 segundos y la respuesta de transporte un máximo de 128 KiB. No hay reintentos automáticos de llamadas facturables. La identificación puede necesitar dos solicitudes consecutivas. Si falla únicamente la generación de cuidados, los candidatos se conservan con una advertencia y sin una ficha inventada.

## Configuración paso a paso

1. En el SQL Editor de **tu proyecto Supabase**, ejecutá `supabase/migrations/202609260004_ai_analyses.sql`, después de las migraciones 001, 002 y 003. La migración agrega tablas/columnas y no borra los datos existentes. No vuelvas a ejecutar migraciones ya aplicadas. Esta tarea solo las probó localmente; no modificó la base remota.
2. Para comprobar permisos y transacciones en Supabase, ejecutá `supabase/tests/phase4.sql` con el rol `postgres` del SQL Editor. Inserta datos de prueba y termina con `ROLLBACK`. No valida llamadas HTTP ni archivos de Storage reales.
3. Obtené la clave del proyecto en [Pl@ntNet para desarrolladores](https://my.plantnet.org/). Consultá sus cuotas y condiciones antes de habilitar consultas. La aplicación usa el endpoint de identificación del proyecto `all`.
4. Creá una clave en [Google AI Studio](https://aistudio.google.com/apikey). Elegí un modelo de Gemini con imágenes y salida JSON estructurada habilitado para tu proyecto. La configuración de ejemplo usa `gemini-3.8-flash`; la disponibilidad efectiva depende de tu cuenta. Consultá [imágenes](https://ai.google.dev/gemini-api/docs/image-understanding) y [salida estructurada](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).
5. Copiá la clave **secreta** `sb_secret_…` de tu proyecto Supabase en la variable privada indicada abajo. La clave pública existente sigue siendo `sb_publishable_…`. No sustituyas una por la otra ni pegues secretos en el chat o el repositorio.
6. Conservá las variables existentes de `.env.local` y agregá las cuatro de Fase 4 que figuran en `.env.example`: `SUPABASE_SECRET_KEY`, `PLANTNET_API_KEY`, `GEMINI_API_KEY` y `GEMINI_MODEL`. Completalas con tus valores reales. No sobrescribas el archivo completo con la plantilla. En despliegues, configurá las mismas variables privadas en el servidor.
7. Reiniciá Next.js:

```powershell
Set-Location C:\Users\Matias\Desktop\PlantCare
npm.cmd run dev
```

Sin claves completas, el catálogo sigue funcionando y la pantalla de análisis explica que la IA no está configurada. No hay un modo de respuestas ficticias dentro de la aplicación de producción.

El despliegue debe admitir acciones de hasta 120 segundos (`maxDuration` en la página de análisis), cargas multipart de 4 MiB y ejecución Node.js con Sharp. Comprobá que los límites del alojamiento no sean inferiores. El procesamiento ocurre durante la petición; si el proceso se interrumpe, no continúa en segundo plano. El historial permite detectar el intento interrumpido y el UUID evita repetirlo silenciosamente.

## Pruebas locales sin claves

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Si Chromium no está instalado: `npx.cmd playwright install chromium`.

- Las pruebas unitarias simulan el transporte de los proveedores. Verifican JPEG para Pl@ntNet, asociación exacta de especies y cuidados, diagnóstico estructurado, JSON inválido, truncamiento, límite de respuesta, bloqueos por credenciales/cuota y timeout sin reintentos.
- Las pruebas de Server Actions verifican sesión, consentimiento, propiedad, configuración ausente, envío normalizado, persistencia, fallos y reenvíos idempotentes.
- PGlite ejecuta las cuatro migraciones con PostgreSQL real embebido y comprueba permisos, aislamiento, consumo, confirmación con versión, idempotencia, limpieza y eliminación de cuidados obsoletos.
- Playwright usa Supabase simulado y resultados predefinidos **solo en los archivos de pruebas**. Recorre la pantalla sin claves, el historial, la aceptación de especie, la ficha resultante, el diagnóstico y el aislamiento entre cuentas. Verifica también los flujos anteriores y el ancho móvil. No llama a Pl@ntNet ni Gemini.

Las comprobaciones locales no certifican disponibilidad del modelo, cuotas, facturación ni la conexión con Supabase administrado. Esas verificaciones requieren las claves y los pasos siguientes.

## Validación real antes de aprobar la fase

1. Iniciá sesión y abrí **Identificar por foto** en Mis Plantas. Cargá una foto nítida de una sola planta. Aceptá el envío y presioná **Analizar foto** una vez. Deberían aparecer hasta tres candidatos, puntuaciones, familia y cuidados, o un mensaje claro si la imagen no se puede reconocer.
2. Antes de confirmar, volvé a la colección: todavía no debe haber una planta nueva. Regresá desde **Mis análisis**, elegí la especie correcta y completá un nombre. Confirmá. Debe aparecer un único ejemplar con la especie y los cuidados aceptados. Volver al resultado debe indicar que ya fue confirmado.
3. Desde un ejemplar existente, usá **Identificar especie**. Confirmá un candidato. Deben mantenerse su ubicación, luz registrada, maceta y diario. Editá manualmente la especie después: los cuidados anteriores deben desaparecer.
4. Desde ese ejemplar abrí **Revisar salud**, adjuntá una foto de la zona afectada y describí los síntomas. Deben mostrarse hipótesis diferenciadas de observaciones, comprobaciones y medidas conservadoras. El calendario y la ficha no deben cambiar.
5. Probá una foto borrosa/no vegetal, un archivo de texto renombrado como imagen y una foto mayor a 3 MiB. No deben generar una ficha aplicable a partir de una respuesta inválida. Un proveedor puede rechazar o equivocarse ante una imagen no vegetal; revisá siempre sus resultados.
6. Abrí el enlace de un análisis y el enlace de su foto desde otra cuenta. No deben ser accesibles. Sin sesión, las páginas solicitan iniciar sesión y la ruta de fotos rechaza el acceso.
7. Abrí dos pestañas del mismo resultado asociado a una planta. Modificá la ficha en una y confirmá desde la otra. Debe aparecer un conflicto de versión; recargar y revisar permite continuar.
8. Si falla un proveedor, consultá el historial: el intento debe quedar fallido o interrumpido con un mensaje seguro. No debe exponerse ninguna clave ni el cuerpo del error del proveedor. No fuerces fallos haciendo muchas llamadas pagas: los casos de cuota/timeout ya están cubiertos localmente.

Los archivos fallidos se encolan para limpieza y se intenta eliminarlos tras un fallo controlado. Las reservas abandonadas por una interrupción quedan disponibles para limpieza después de 24 horas; usá **Reintentar limpieza de fotos** en la aplicación. No hay un trabajador programado de limpieza en esta fase. Al eliminar una planta se eliminan sus análisis asociados y se encolan sus fotos; el registro de consumo se conserva hasta eliminar la cuenta.

Referencia del contrato Pl@ntNet: [API de identificación](https://my.plantnet.org/doc/api/identify). Las puntuaciones son coincidencias del proveedor, no probabilidades calibradas ni confirmación botánica. Los diagnósticos y cuidados se presentan como orientación generada y los resultados no modifican agendas automáticamente. El clima, la agenda dinámica y la calculadora corresponden a la Fase 5, pendiente de aprobación.
