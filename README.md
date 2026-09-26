# PlantCare

Aplicación de cuidado de plantas. Fase 4: autenticación SSR, catálogo personal, diario con fotos privadas e identificación y diagnóstico orientativo por IA.

## Inicio local (PowerShell)

```powershell
Set-Location C:\Users\Matias\Desktop\PlantCare
npm.cmd ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Completá `.env.local` con la URL de tu proyecto y la clave **publishable** de Supabase en las variables públicas. Para la IA, configurá además `SUPABASE_SECRET_KEY`, `PLANTNET_API_KEY`, `GEMINI_API_KEY` y `GEMINI_MODEL` exclusivamente en el servidor. Nunca pongas una clave secreta en una variable `NEXT_PUBLIC_`.

Seguí [la guía de Fase 2](docs/FASE_2.md) para configurar Auth, [la guía de Fase 3](docs/FASE_3.md) para el CRUD y las fotos y [la guía de Fase 4](docs/FASE_4.md) para aplicar la cuarta migración y configurar la IA. Luego:

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

Vitest ejecuta validaciones de formularios/imágenes, contratos de IA, autorización de acciones y las cuatro migraciones en PostgreSQL embebido (PGlite), con roles y estructuras Auth/Storage de prueba. Se verifica RLS real de PostgreSQL, sin conectarse al proyecto remoto ni consumir APIs de IA.

Playwright inicia un servidor de contrato Supabase **simulado**, exclusivo de pruebas, y Next.js en el puerto 3100. Comprueba los flujos de la aplicación, fotos, revisión de resultados de IA predefinidos y su confirmación. Deshabilita las claves de IA para evitar llamadas reales. No valida entrega de correos, Storage administrado ni disponibilidad de los proveedores. Las guías incluyen pruebas manuales remotas.

La Fase 4 está implementada para validación. Las consultas reales requieren configurar las claves; la migración remota debe aplicarse según la guía. La Fase 5 (clima y motor de riego) queda pendiente de aprobación.
