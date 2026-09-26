import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";
import { getSupabaseConfig } from "@/lib/env";

export const metadata = { title: "Recuperar contraseña" };
export default function ForgotPasswordPage() {
  return <><span className="eyebrow">VOLVAMOS A TU JARDÍN</span><h2>Recuperá tu acceso.</h2><p className="auth-intro">Te enviaremos un enlace para elegir una nueva contraseña.</p>
    <AuthForm mode="forgot" configured={Boolean(getSupabaseConfig())} />
    <p className="auth-switch"><Link href="/login">Volver a iniciar sesión</Link></p>
  </>;
}
