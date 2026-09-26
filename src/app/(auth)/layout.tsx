import { Brand } from "@/components/brand";
import { PlantIllustration } from "@/components/plant-illustration";
import { Leaf, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="auth-shell">
    <aside className="auth-story">
      <Brand />
      <div className="story-copy"><span className="eyebrow"><span /> UN POCO MÁS CERCA DE LO NATURAL</span>
        <h1>Un pequeño cuidado.<br />Una vida que <em>crece.</em></h1>
        <p>Conocé tus plantas, acompañá sus cambios y hacé de tu casa un lugar más verde.</p>
      </div>
      <div className="story-art"><PlantIllustration /><div className="art-label"><Leaf size={17} /><span>Creciendo, a tu ritmo</span></div></div>
      <div className="story-footer"><span>Raíces en casa. Bienestar todos los días.</span><span>EST. 2026</span></div>
    </aside>
    <main id="main" className="auth-content"><div className="auth-mobile-brand"><Brand /></div><div className="auth-card">{children}</div>
      <p className="auth-footer"><ShieldCheck size={15} /> Tu jardín, tu espacio personal.</p>
    </main>
  </div>;
}
