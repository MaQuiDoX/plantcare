import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/features/auth/auth-form";
import { getCurrentUser } from "@/features/auth/session";
import { getSupabaseConfig } from "@/lib/env";

export const metadata = { title: "Crear cuenta" };
export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/plants");
  return <><span className="eyebrow">EL COMIENZO DE ALGO VERDE</span><h2>Hacé lugar para crecer.</h2><p className="auth-intro">Creá tu cuenta y empezá tu propio jardín digital.</p>
    <AuthForm mode="register" configured={Boolean(getSupabaseConfig())} />
    <p className="auth-switch">¿Ya tenés una cuenta? <Link href="/login">Iniciá sesión</Link></p>
  </>;
}
