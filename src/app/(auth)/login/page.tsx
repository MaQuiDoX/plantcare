import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { getCurrentUser } from "@/features/auth/session";
import { getSupabaseConfig } from "@/lib/env";

export const metadata = { title: "Iniciar sesión" };
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/plants");
  const configured = Boolean(getSupabaseConfig());
  return <><span className="eyebrow">TU JARDÍN TE ESPERA</span><h2>Qué bueno verte.</h2><p className="auth-intro">Ingresá para volver a conectar con tus plantas.</p>
    <AuthForm mode="login" configured={configured} />
    <p className="auth-switch">¿Primera vez por acá? <Link href="/register">Creá tu cuenta</Link></p>
    <details className="resend-details"><summary>¿No recibiste el correo de confirmación?</summary><AuthForm mode="resend" configured={configured} /></details>
  </>;
}
