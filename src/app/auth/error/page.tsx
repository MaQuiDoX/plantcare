import Link from "next/link";
import { Brand } from "@/components/brand";

export const metadata = { title: "Enlace no válido" };
export default function AuthErrorPage() {
  return <main id="main" className="standalone"><Brand /><div className="standalone-card"><span className="eyebrow">RECUPEREMOS EL CAMINO</span><h1>Este enlace ya no es válido.</h1><p>Puede haber vencido o haberse utilizado. Solicitá uno nuevo para continuar.</p><div className="button-row"><Link className="button button-primary" href="/login">Confirmar mi cuenta</Link><Link className="button button-secondary" href="/forgot-password">Recuperar contraseña</Link></div></div></main>;
}
