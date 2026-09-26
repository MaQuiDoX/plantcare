# PlantCare

Aplicación de cuidado de plantas. Fase 2: autenticación SSR con Supabase y dashboard privado.

## Inicio local (PowerShell)

```powershell
Set-Location C:\Users\Matias\Desktop\PlantCare
npm.cmd ci
Copy-Item .env.example .env.local
```

Completá `.env.local` con la URL de tu proyecto y la clave **publishable** de Supabase. No uses service_role ni sb_secret. La aplicación no necesita credenciales administrativas.

Seguí [la guía de Fase 2](docs/FASE_2.md) para ejecutar las migraciones y configurar los correos. Luego:

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

Playwright inicia un servidor de contrato Supabase **simulado**, exclusivo de pruebas, y Next.js en el puerto 3100. Comprueba los flujos de la aplicación, pero no valida entrega de correos, RLS ni migraciones en un proyecto Supabase real. La prueba SQL y el protocolo manual están documentados en la guía.

El CRUD y el diario corresponden a la Fase 3, pendiente de aprobación.
