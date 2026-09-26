import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { getSupabaseConfig } from "@/lib/env";

export const metadata = { title: "Configuración inicial" };
export const dynamic = "force-dynamic";
export default function SetupPage() {
  if (getSupabaseConfig()) redirect("/login");
  return <main id="main" className="standalone"><Brand /><div className="standalone-card"><span className="eyebrow">CONFIGURACIÓN INICIAL</span><h1>Conectemos tu jardín.</h1><p>La aplicación está instalada. Falta conectar el proyecto Supabase para habilitar las cuentas y los datos.</p>
    <ol className="setup-steps"><li>Creá un proyecto Supabase y ejecutá las dos migraciones de <code>supabase/migrations</code>, en orden.</li><li>Copiá <code>.env.example</code> a <code>.env.local</code>. Completá la URL de Supabase y su clave <strong>publishable</strong>.</li><li>Configurá las plantillas de correo siguiendo <code>docs/FASE_2.md</code>.</li><li>Reiniciá el servidor y abrí la pantalla de ingreso.</li></ol>
    <Link className="button button-primary" href="/login">Ver pantalla de ingreso</Link>
  </div></main>;
}
