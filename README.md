# PlantCare

Aplicación de cuidado de plantas. Fase 6: catálogo, diario privado, IA, agenda adaptativa, clima, calculadora, avisos push/correo y PWA instalable.

## Inicio local (PowerShell)

```powershell
Set-Location C:\Users\Matias\Desktop\PlantCare
npm.cmd ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Completá `.env.local` con la URL de tu proyecto y la clave **publishable** de Supabase en las variables públicas. Para la IA, configurá además `SUPABASE_SECRET_KEY`, `PLANTNET_API_KEY`, `GEMINI_API_KEY` y `GEMINI_MODEL` exclusivamente en el servidor. Nunca pongas una clave secreta en una variable `NEXT_PUBLIC_`.

Seguí [Fase 2](docs/FASE_2.md) para Auth, [Fase 3](docs/FASE_3.md) para catálogo y fotos, [Fase 4](docs/FASE_4.md) para IA, [Fase 5](docs/FASE_5.md) para agenda/calculadora y [Fase 6](docs/FASE_6.md) para avisos y PWA. Aplicá las migraciones en orden hasta la 006. El clima requiere `OPENWEATHER_API_KEY` y `SUPABASE_SECRET_KEY` solo en el servidor; sin OpenWeather se puede usar la agenda por estación y la calculadora. Luego:

```powershell
npm.cmd run dev
```

Abrí http://localhost:3000. Sin configuración muestra instrucciones iniciales; los formularios permanecen deshabilitados y no se utilizan cuentas ficticias.

## Verificaciones

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Vitest ejecuta validaciones, contratos de IA/clima/envíos, autorización, geometría y las seis migraciones en PostgreSQL embebido (PGlite), con roles y estructuras Auth/Storage de prueba. Verifica RLS real, agenda, diario y cola de notificaciones sin conectarse al proyecto remoto ni consumir APIs externas.

Playwright inicia un servidor Supabase **simulado** y Next.js en el puerto 3100. Comprueba los flujos, fotos, IA predefinida, preferencias, bandeja y pantalla offline sin caché privada. Deshabilita claves externas y envíos. No valida entrega real, Storage administrado ni disponibilidad de proveedores. Las guías incluyen pruebas manuales remotas.

La Fase 6 está implementada para validación. Falta aplicar la migración en tu Supabase, configurar claves y verificar entregas en dispositivos reales. No se hicieron envíos ni despliegues externos. Consultá [la guía de hosting gratuito y dominio](docs/HOSTING.md) para Vercel, Render y Netlify, con sus límites y configuración del programador. El cron diario incluido es para una demostración personal pequeña; no garantiza avisos puntuales.
