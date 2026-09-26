import Link from "next/link";
import { Flower2, Leaf, Sprout } from "lucide-react";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/features/auth/logout-button";

export function DashboardShell({ email, children }: { email: string; children: React.ReactNode }) {
  return <div className="dashboard-shell"><aside className="sidebar"><Brand />
    <div className="nav-label">MI ESPACIO</div><nav aria-label="Navegación principal"><Link className="nav-item active" href="/plants" aria-current="page"><Sprout size={21} /> Mis Plantas <span className="nav-active-dot" /></Link></nav>
    <div className="sidebar-note"><Flower2 size={25} strokeWidth={1.4} /><p>Cuidar también es<br /><strong>aprender a observar.</strong></p><span>Cada hoja cuenta una historia.</span></div>
    <div className="sidebar-account"><div className="account-avatar">{email.slice(0, 1).toUpperCase() || "P"}</div><div className="account-details"><strong>Mi cuenta</strong><span title={email}>{email}</span></div></div><LogoutButton />
  </aside><div className="dashboard-body"><header className="dashboard-topbar"><div className="mobile-brand"><Brand /></div><span className="breadcrumb">Mi espacio <span>/</span> <strong>Mis Plantas</strong></span><span className="topbar-tag"><Leaf size={15} /> Un día más para crecer</span></header>
    <main id="main" className="dashboard-main">{children}</main><footer className="dashboard-footer"><span>Hecho para crecer con vos.</span><span>PlantCare</span></footer>
  </div></div>;
}
