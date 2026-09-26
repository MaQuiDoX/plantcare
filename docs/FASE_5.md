# Fase 5 — Agenda de riego, clima y calculadora

## Qué construimos

Cada planta puede tener una agenda manual o adaptativa, con un intervalo base confirmado por su dueño. El modo adaptativo modifica ese intervalo según estación, hemisferio, ubicación interior/exterior y observaciones meteorológicas vigentes. La fecha representa una revisión de humedad antes de decidir si regar; no es una orden automática.

La fecha se cuenta desde el último riego del diario. Si no hay riegos, usa la fecha de inicio de seguimiento, sin inventar una entrada. Crear, editar, cambiar el tipo o borrar un riego actualiza la agenda. Una planta archivada queda fuera de la agenda; al restaurarla vuelve a aparecer. También se puede pausar una agenda sin archivar el ejemplar.

La calculadora permite seleccionar un grupo de plantas, describir el estado de raíces y medir la maceta destino y el cepellón. Sugiere un diámetro y calcula litros de mezcla e ingredientes. Es interactiva y no modifica automáticamente la ficha ni registra un trasplante.

## Archivos

```text
supabase/
  migrations/202609260005_weather_watering.sql
  tests/phase5.sql
src/features/care/
  schemas.ts           Validación de ubicación, agendas y clima
  weather.ts           Adaptador OpenWeather y configuración privada
  queries.ts           Lectura autenticada de perfil, clima y agenda
  actions.ts           Guardar ubicación/agenda, consultar clima, registrar riego
  forms.tsx            Formularios con estados y validación
  agenda-view.tsx      Calendario de 14 días y tarjetas de revisión
  calculator.ts        Fórmulas geométricas y mezclas orientativas
  calculator-form.tsx  Calculadora interactiva
src/app/(dashboard)/plants/
  care/page.tsx                 Agenda general y configuración del clima
  [id]/care/page.tsx            Configuración de riego del ejemplar
  [id]/calculator/page.tsx      Calculadora del ejemplar
tests/
  unit/care.test.ts
  unit/care-actions.test.ts
  unit/database.test.ts
  e2e/care.spec.ts
```

## Esquema y fuente de verdad

| Objeto | Función |
| --- | --- |
| `users.latitude`, `longitude`, `timezone` | Ubicación y zona IANA existentes; las coordenadas introducidas en la interfaz se redondean a dos decimales. |
| `care_schedules` | Agrega `version`, `anchor_on` y `last_watered_on`. Conserva modo, intervalo base y estado activo/pausado. |
| `watering_recommendation(...)` | Función pura PostgreSQL que devuelve intervalo, estación, factores aplicados y versión `watering-v1`. |
| `watering_agenda` | Vista con `security_invoker=true`: aplica RLS del usuario y calcula `due_on` y `recommendation` con fecha y clima actuales al leer. Excluye archivadas. |
| `save_watering_schedule(...)` | RPC autenticada con propiedad, bloqueo del ejemplar y control de versión. Es el único mecanismo del cliente para escribir agendas. |
| `sync_watering_journal()` | Trigger que mantiene la última fecha de riego al insertar, editar o borrar en el diario. |
| `weather_snapshots` | Observaciones privadas ya previstas en el esquema inicial: temperatura, humedad, lluvia, coordenadas, origen y vigencia. |
| `weather_fetch_state` | Reserva por cuenta y espera entre consultas. Solo accesible por el servidor. |
| `claim_weather_fetch`, `finish_weather_fetch` | RPC exclusivas de `service_role`; evitan consultas simultáneas y guardan observaciones validadas. |

**La agenda vigente se consulta en `watering_agenda.due_on`, no en `care_schedules.next_due_at`.** Los campos `effective_interval_days`, `next_due_at` y `calculation_context` de la tabla son una instantánea de la configuración guardada; la vista es la fuente dinámica. La Fase 6 deberá consultar la vista para producir recordatorios. Así evitamos depender de un proceso programado solo para cambiar una fecha al iniciar una estación o vencer el clima.

El calendario presenta la próxima revisión de cada agenda en la página actual (12 agendas por página) durante 14 días. No muestra riegos futuros recurrentes como certezas. Las revisiones atrasadas siguen visibles en la lista, sin desplazarse artificialmente cada día.

## Algoritmo `watering-v1`

```text
intervalo = redondear(base × factor_estación × factor_clima)
próxima_revisión = (última_fecha_de_riego o inicio_de_seguimiento) + intervalo
```

Factores del modo adaptativo:

| Variable | Ajuste |
| --- | --- |
| Invierno / primavera / verano / otoño | 1,25 / 1 / 0,85 / 1,10, antes de atenuar por ambiente. |
| Hemisferio sur | Estaciones desplazadas seis meses respecto del norte. |
| Latitudes entre −10 y 10 | Sin factor estacional, porque cuatro estaciones templadas no describen adecuadamente esa zona. |
| Ubicación sin configurar | Factor estacional neutro. |
| Interior | Solo 30 % del efecto estacional; ignora clima exterior. |
| Exterior protegido | 60 % del efecto estacional y meteorológico; ignora lluvia como aporte directo. |
| Exterior | Efectos completos. |
| Temperatura ≥ 30 °C / 25 a menos de 30 °C / ≤ 12 °C | Multiplica clima por 0,8 / 0,9 / 1,2; otras temperaturas usan 1. |
| Humedad ≥ 80 % / ≤ 35 % | Multiplica clima por 1,1 / 0,9. |
| Lluvia última hora ≥ 2 mm | Multiplica clima por 1,1 solo en exterior sin cubierta. No implica que la maceta recibió esa lluvia. |

El factor total se limita a 0,5–1,8 y el resultado a 1–730 días. La interfaz admite una base de 1–365 días. En modo manual todos los factores son neutros. Los cambios de día y estación usan la zona horaria del perfil; la suma opera sobre fechas, no bloques de 24 horas, para no desfasarse con cambios de horario.

**Estos coeficientes son una heurística del producto, no una fórmula agronómica validada.** La temperatura actual tampoco representa el clima de toda la semana. Se muestran los factores para que el usuario pueda revisar el resultado. No hay un intervalo universal por defecto: se pide uno observado por el dueño o se ofrece el del catálogo si la especie tiene `reviewed_at` y `base_watering_days`. No se convierten frases generadas por IA en intervalos numéricos.

## Clima y privacidad

El servidor usa [Current Weather Data de OpenWeather](https://openweathermap.org/api/current), por coordenadas y con `units=metric`. Lee temperatura en Celsius, humedad porcentual y lluvia de la última hora. No usa One Call, pronósticos, geocodificación ni servicios adicionales.

Las consultas se realizan al presionar **Actualizar clima**. No hay consultas externas ocultas al navegar. Una observación se reutiliza hasta una hora; debe tener menos de tres horas de antigüedad y no más de cinco minutos en el futuro. La vista descarta observaciones vencidas o de otra ubicación. Sin clima válido, el modo adaptativo conserva solo la estación; sin ubicación, usa el intervalo base.

Cada cuenta tiene una reserva compartida en PostgreSQL: espera diez minutos tras iniciar una consulta y una hora tras guardarla exitosamente. También se aplica ante cambio de ubicación, para que cambiar coordenadas no permita eludir el límite. Timeout HTTP de diez segundos, respuesta de hasta 32 KiB, redirecciones rechazadas y sin reintentos automáticos. Los errores del proveedor no se devuelven en bruto y nunca se envía la clave al navegador.

Las coordenadas aproximadas se envían a OpenWeather para la consulta. Las observaciones de más de siete días se eliminan al guardar una nueva consulta exitosa. Quitar la ubicación evita su uso posterior en la agenda; no borra inmediatamente las observaciones anteriores. No hay proceso de limpieza periódico en esta fase.

## Configurar OpenWeather paso a paso

1. Aplicá primero las migraciones 001–004 si todavía falta alguna. En el SQL Editor de Supabase, ejecutá **solo la migración nueva** `supabase/migrations/202609260005_weather_watering.sql`. No vuelvas a ejecutar las anteriores ya aplicadas. Esta tarea no modificó tu proyecto remoto.
2. Registrate o iniciá sesión en [OpenWeather](https://home.openweathermap.org/users/sign_up). Completá la confirmación de cuenta que te solicite el servicio.
3. Abrí [API keys](https://home.openweathermap.org/api_keys). Copiá una clave de tu cuenta. Verificá que tu plan permita **Current Weather Data** y revisá sus cuotas antes de usarlo. No necesitás contratar One Call para esta implementación.
4. En `.env.local`, agregá `OPENWEATHER_API_KEY` con tu clave real. Conservá `SUPABASE_SECRET_KEY` de la Fase 4. Las claves no deben llevar el prefijo `NEXT_PUBLIC_`. La plantilla `.env.example` contiene el nombre de la nueva variable.
5. Reiniciá la aplicación desde PowerShell:

```powershell
Set-Location C:\Users\Matias\Desktop\PlantCare
npm.cmd run dev
```

6. Iniciá sesión, abrí **Agenda de riego → Configurar ubicación y zona horaria**. Ingresá latitud y longitud aproximadas de tu ciudad. Buenos Aires tiene un botón para completar −34,60 y −58,38; para otra ciudad usá sus coordenadas. Completá una zona IANA, por ejemplo `America/Argentina/Buenos_Aires` o `Europe/Madrid`. Guardá.
7. Presioná **Actualizar clima**. Deberían aparecer temperatura, humedad, lluvia, hora de observación y origen. Si la clave no está activa o no tiene acceso, la aplicación lo informa; no modifica la agenda usando datos inventados.

Sin clave de OpenWeather o sin clave secreta Supabase, el botón queda deshabilitado. La agenda manual, la adaptación estacional, el diario y la calculadora funcionan igualmente tras aplicar la migración.

## Calculadora: fórmulas y alcance

La sugerencia reconoce géneros científicos concretos: Monstera/Epipremnum/Philodendron, algunos géneros de suculentas de ambiente seco, helechos y Phalaenopsis. Los nombres comunes o especies no reconocidas usan «Otra especie / sin confirmar». El usuario puede cambiar el grupo. No se clasifican todos los cactus como plantas de desierto: por ejemplo, un cactus epífito debe revisarse manualmente.

Si hay raíces apretadas, sugiere aumentar el diámetro 2,5 cm para macetas menores de 20 cm y 5 cm para mayores. Si el ejemplar está cómodo o debilitado, conserva el diámetro como referencia y recomienda evaluar la necesidad de trasplante. Esto no reemplaza medir el cepellón. La recomendación es independiente de los campos de destino: ingresá las dimensiones de la maceta que realmente vayas a usar.

Para la maceta destino se aproxima un tronco de cono circular:

```text
altura_útil = altura − espacio_hasta_el_borde
diámetro_superior_útil = base + (boca − base) × altura_útil / altura
volumen_útil_cm³ = π × altura_útil × (base² + base × diámetro_superior_útil + diámetro_superior_útil²) / 12
cepellón_cm³ = π × (diámetro_cepellón / 2)² × altura_cepellón
litros_nuevos = (volumen_útil_cm³ − cepellón_cm³) / 1000
litros_preparados = litros_nuevos × 1,10
```

El bloque de raíces se aproxima a un cilindro. Se comprueba conservadoramente que quepa incluso en la base de la maceta. Ceros en ambas medidas del cepellón significan llenar una maceta vacía. Las mezclas por grupo suman 100 % y distribuyen los litros preparados. Los porcentajes son recetas orientativas de PlantCare que requieren adaptar materiales y retención de agua; no son fichas técnicas certificadas de cada especie ni dosis de fertilizante. Los valores se redondean solo al mostrarlos.

El fundamento de usar un aumento moderado y revisar si realmente hace falta trasplantar se puede consultar en [UMN Extension: cuidados de primavera](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/houseplants/spring-houseplant-care). La necesidad de observar humedad y drenaje, en [University of Maryland Extension: riego de plantas de interior](https://www.extension.umd.edu/resource/watering-indoor-plants). Esas fuentes orientan los criterios generales; no validan nuestros coeficientes ni porcentajes.

## Pruebas antes de aprobar la fase

Pruebas locales, sin claves ni consumo de APIs:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

PGlite ejecuta PostgreSQL con las cinco migraciones y prueba hemisferios, estaciones, modo manual, interior, ausencia de ubicación, límites, sincronización de riegos, fechas futuras, versiones, archivo, RLS, exclusión de consultas simultáneas y rechazo de clima viejo. Vitest prueba además geometría, ingredientes, coordenadas y el contrato HTTP/acciones. Playwright recorre los formularios y la agenda con Supabase simulado y clima externo deshabilitado. Las pruebas no certifican la API real ni Supabase administrado.

Validación manual con tu proyecto:

1. Ejecutá `supabase/tests/phase5.sql` en el SQL Editor como `postgres`. Termina con `ROLLBACK` y revierte sus datos de prueba.
2. Abrí una planta activa → **Riego y cuidados**. Guardá una base de 7 días, modo manual y fecha de inicio. Sin riegos previos, la fecha debe ser inicio + 7 días.
3. En la agenda confirmá que efectivamente regaste hoy y registralo. Comprobá la entrada en el diario y la nueva fecha. Editá la fecha de ese riego o eliminá la entrada: la agenda debe seguir la última entrada real disponible o volver al inicio si ya no hay riegos.
4. Activá el modo adaptativo y actualizá el clima. En una planta de exterior, revisá los factores y el intervalo. En interior, temperatura, humedad y lluvia externas deben ignorarse. Cambiá a modo manual: el intervalo debe volver exactamente a la base.
5. Pausá la agenda. Debe seguir visible como pausada, sin registro rápido ni eventos en el calendario. Archivá la planta: debe desaparecer de la agenda. Restaurala para volver a verla.
6. Abrí la configuración en dos ventanas. Guardá en una y luego en la otra sin recargar: la segunda debe informar conflicto de versión.
7. Desde otra cuenta, abrí enlaces de configuración y calculadora del ejemplar anterior. Deben rechazar el acceso; la agenda general solo debe mostrar plantas propias.
8. Abrí la calculadora. Con boca/base/altura de 20 cm, borde de 0 cm y cepellón de 10 × 10 cm, debe mostrar aproximadamente **6,05 L** a preparar. Un cepellón mayor que la base debe mostrar error. Cambiar de grupo debe redistribuir componentes sin cambiar el volumen total.
9. Verificá las pantallas en móvil. Cambiar medidas en la calculadora no debe alterar la ficha. Para guardar un trasplante real, editá la maceta y agregá un registro al diario.

La Fase 6 (push, avisos por clima y PWA) queda pendiente de aprobación. No se configuraron notificaciones, procesos programados ni despliegues en esta fase.
