# Fase 3 — Catálogo, CRUD y diario fotográfico

## Qué construimos

Cada ejemplar tiene una ficha propia: nombre, especie opcional, fecha de llegada, ambiente, luz, maceta, drenaje y notas de sustrato. Se puede crear, consultar, editar, archivar, restaurar y eliminar. El catálogo separa plantas activas de archivadas e incluye búsqueda y paginación.

El diario registra observaciones, riegos, fertilizaciones, trasplantes, revisiones y podas por fecha. Cada entrada admite notas, altura de la planta y una foto; los riegos también admiten volumen de agua. La línea de tiempo muestra primero los registros más recientes, con páginas de 12 entradas. Se pueden crear varias entradas del mismo día, editar sus datos, reemplazar/quitar la foto y borrar el registro.

Los formularios usan Server Actions, validación Zod y verificación de sesión en cada operación. Las políticas PostgreSQL aíslan propietarios. Un contador `version` detecta ediciones desde ventanas desactualizadas: se muestra un conflicto en lugar de sobrescribir el cambio anterior. Los UUID de altas se conservan durante el envío para que un reintento no duplique la planta o entrada.

## Estructura nueva y modificada

```text
supabase/
  migrations/202609250003_catalog_journal.sql
  tests/phase3.sql
src/
  app/(dashboard)/plants/
    page.tsx
    new/page.tsx
    [id]/page.tsx
    [id]/edit/page.tsx
    [id]/journal/new/page.tsx
    [id]/journal/[entryId]/edit/page.tsx
  app/plants/media/[id]/route.ts
  features/plants/
    actions.ts
    validation.ts
    queries.ts
    plant-form.tsx
    plant-controls.tsx
  features/journal/
    actions.ts
    validation.ts
    queries.ts
    images.ts
    storage.ts
    journal-form.tsx
tests/
  unit/catalog.test.ts
  unit/database.test.ts
  e2e/catalog.spec.ts
  fixtures/catalog.mjs
```

`globals.css` incorpora formularios, ficha, cronología y adaptación móvil. `next.config.ts` admite Server Actions de hasta 4 MiB; la foto individual se limita a 3 MiB para dejar espacio al formulario.

## Modelo de datos y migración

| Entidad | Cambio |
|---|---|
| `user_plants` | `species_label`: especie anotada por el usuario, hasta 200 caracteres; `version`: control de concurrencia |
| `journal_entries` | `entry_date`: fecha elegida, sin conversiones inesperadas de día; `version`: control de concurrencia |
| `media_assets` | Mantiene relación con ejemplar y entrada; metadatos se crean dentro de la transacción del diario |
| `storage_cleanup` | Ruta privada, propietario, estado, disponibilidad y fecha de creación; conserva trabajos de limpieza |

El catálogo global `plants` continúa siendo de sólo lectura para usuarios. Si una especie no está allí, se anota en `species_label`; no se inventa una ficha botánica compartida. Los schemas completos de entrada están en `features/plants/validation.ts` y `features/journal/validation.ts`; los schemas de lectura están en sus archivos `queries.ts`.

La fecha del diario se interpreta según la zona IANA del perfil. `entry_date` conserva el día elegido; para compatibilidad con `occurred_at`, la RPC guarda el mediodía de ese día en la zona del usuario. No representa una hora exacta observada. Las entradas existentes se migran a su fecha local sin perder notas ni fotos.

La función `save_journal_entry` comprueba propietario y estado de la planta, fecha no futura y versión. Guarda entrada y metadatos de la foto en una transacción. Se revoca la escritura directa de entradas/metadatos al rol authenticated para usar esa operación atómica. El borrado conserva las políticas RLS y activa la cola de archivos a retirar.

## Cómo funcionan las fotos

1. Se valida tamaño y tipo de entrada: JPEG, PNG o WebP, hasta 3 MiB.
2. Sharp decodifica el archivo para detectar contenido falso/corrupto. Se rechazan animaciones y dimensiones superiores a 40 megapíxeles.
3. Se aplica orientación, se reduce a un máximo de 1800 × 1800 píxeles y se convierte a WebP sin EXIF/GPS.
4. `reserve_journal_photo` asigna una ruta UUID bajo la carpeta del propietario y deja una reserva de limpieza con vencimiento a 24 horas.
5. El servidor sube la imagen al bucket privado `plant-images`, sin sobrescritura.
6. La RPC del diario guarda los metadatos y consume la reserva. Si el proceso se interrumpe, la reserva permite encontrar el archivo más tarde.

La lectura usa `/plants/media/[id]`: verifica sesión y propiedad, descarga desde Storage y responde con `Cache-Control: private, no-store`. No publica URLs permanentes ni pasa las fotos privadas al optimizador público de imágenes. Al cerrar sesión, esa ruta deja de servir la foto; los archivos que el usuario ya haya descargado no se pueden revocar.

El límite de 10 MiB del bucket inicial permanece; la aplicación aplica el límite más estricto de 3 MiB para su formulario. No se utilizan claves de servicio: las operaciones llevan la sesión del propietario.

## Borrado y limpieza

Archivar conserva toda la historia y oculta el ejemplar de la colección activa. La ficha archivada queda disponible para lectura y restauración. Eliminar requiere escribir el nombre exacto; eliminar una entrada requiere escribir `ELIMINAR`.

PostgreSQL y Storage no comparten transacciones. Por eso el borrado del registro encola la ruta del archivo dentro de la misma transacción. Al completar la operación se intenta retirar el archivo con la API de Storage. También se reintenta antes de nuevas subidas y mediante **Limpieza de fotos pendientes → Reintentar limpieza**.

Cada ejecución toma hasta 50 trabajos. Un bloqueo de cinco minutos evita que dos ejecuciones tomen a la vez el mismo trabajo; si se interrumpe una ejecución, podrá reclamarse de nuevo. Las reservas de subidas incompletas se limpian después de 24 horas. La cola permanece en la base hasta terminar el borrado, incluso si falla Storage.

Esta fase no instala un proceso periódico: si el usuario no vuelve a operar, el trabajo queda pendiente. El worker programado pertenece a Fase 6. Las cuentas eliminadas administrativamente requieren limpieza administrativa de las rutas conservadas en la cola. No borres objetos editando `storage.objects`; utilizá la API de Storage.

## Aplicar y ejecutar

1. En tu proyecto Supabase, abrí **SQL Editor**.
2. Si las fases anteriores ya funcionan, ejecutá únicamente `supabase/migrations/202609250003_catalog_journal.sql` como postgres. No repitas las dos migraciones anteriores. Si el proyecto es nuevo, ejecutá las tres en orden.
3. Ejecutá `supabase/tests/phase3.sql` como postgres. El resultado esperado es `PASS: catálogo, diario atómico, concurrencia, RLS y cola de limpieza`. El script revierte todas sus cuentas y registros de prueba. No sube archivos reales.
4. Conservá tu `.env.local`. No necesita nuevas claves ni configuración de Resend para usar catálogo/diario con una sesión existente.
5. Instalá las dependencias fijadas y arrancá la aplicación:

```powershell
Set-Location C:\Users\Matias\Desktop\PlantCare
npm.cmd ci
npm.cmd run dev
```

Detené una instancia anterior que use el puerto 3000 antes de iniciar otra. Abrí http://localhost:3000 e iniciá sesión.

## Prueba manual antes de avanzar

1. **Alta:** en Mis Plantas pulsá Agregar planta. Ingresá un nombre y dejá la especie vacía. Guardá; debe aparecer su ficha. Probá también una especie anotada manualmente.
2. **Edición:** cambiá ubicación, luz y maceta; recargá y verificá persistencia. En dos pestañas de edición, guardá primero una y luego la otra: la segunda debe pedir recargar.
3. **Diario:** creá un riego con fecha pasada, notas, cantidad y altura. Agregá una foto JPEG/PNG/WebP menor a 3 MiB. Verificá notas, fecha, mediciones e imagen en la línea de tiempo.
4. **Orden:** agregá una observación de una fecha anterior. Debe quedar debajo del registro más reciente. Con más de 12 entradas debe aparecer la navegación por páginas.
5. **Archivos inválidos:** probá un texto renombrado como `.jpg` y una foto mayor a 3 MiB. Deben rechazarse; las notas escritas deben conservarse.
6. **Editar diario:** cambiá notas y fecha; luego reemplazá la foto. Comprobá el nuevo archivo y que el anterior se haya eliminado del bucket o figure pendiente en `storage_cleanup` si hubo un error de Storage.
7. **Quitar/borrar:** quitá la foto o borrá la entrada escribiendo `ELIMINAR`. La entrada y/o sus metadatos deben desaparecer según la acción.
8. **Archivar:** archivá la planta. Debe desaparecer de Mi colección y aparecer en Archivadas, conservando el diario. Restaurala y verificá que vuelve a admitir registros.
9. **Aislamiento:** entrá con una segunda cuenta en una ventana privada. Copiá la URL de la ficha y de una foto de la primera cuenta: no deben abrirse. Sin sesión, la ruta de imagen devuelve 401; con otro propietario, 404.
10. **Eliminar planta:** usá una planta de prueba con una entrada y foto, escribí su nombre exacto y confirmá. Deben desaparecer planta, diario y metadatos; revisar que Storage se haya limpiado o que la ruta esté encolada para reintento.
11. **Móvil:** repetí alta y diario con ancho de 390 px. Verificá etiquetas, botones, foto y ausencia de desplazamiento horizontal.

## Verificaciones automatizadas

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Las pruebas unitarias cubren formularios, fechas según zona horaria, procesamiento y descarte de imágenes inválidas. PGlite ejecuta las tres migraciones y las pruebas SQL con roles reales de PostgreSQL; los esquemas auxiliares de Supabase Auth y Storage se preparan como fixtures locales.

Playwright prueba las pantallas contra un servidor de contrato local: autenticación, CRUD, fotos, archivo/restauración, borrado, protección de imágenes y conflictos de edición. Esas pruebas no sustituyen una subida al Storage administrado de tu proyecto. Las capturas de prueba están en `test-results/phase3-diary-desktop.png` y `test-results/phase3-diary-mobile.png`.

No se aplicó la migración a tu Supabase desde esta tarea ni se modificaron cuentas reales. La Fase 4 queda pendiente de aprobación.

Validación completada el 26/09/2026: ESLint y TypeScript sin errores; 16 pruebas locales aprobadas, incluidas las migraciones en PostgreSQL; 7 pruebas de navegador aprobadas. Tras ajustar el encabezado móvil, se repitieron las 2 pruebas de catálogo/diario y la compilación de producción, ambas exitosas. Se inspeccionó la ficha en escritorio y a 390 px de ancho.
