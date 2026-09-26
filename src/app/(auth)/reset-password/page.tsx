import Link from "next/link";
import { AuthForm } from "@/features/auth/auth-form";
import { getCurrentUser } from "@/features/auth/session";

export const metadata = { title: "Nueva contraseña" };
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  return <><span className="eyebrow">UN NUEVO COMIENZO</span><h2>Elegí tu contraseña.</h2>
    {user ? <><p className="auth-intro">Guardá una contraseña segura para tu cuenta.</p><AuthForm mode="reset" configured /></> : <><p className="auth-intro">Para cambiar la contraseña necesitás abrir un enlace válido de recuperación.</p><Link className="button button-primary" href="/forgot-password">Solicitar un nuevo enlace</Link></>}
  </>;
}
