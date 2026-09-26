import Link from "next/link";
import { Sprout } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand ${light ? "brand-light" : ""}`} aria-label="PlantCare, inicio">
    <span className="brand-icon"><Sprout size={23} strokeWidth={1.8} /></span>
    <span>plantcare<span className="brand-dot">.</span></span>
  </Link>;
}
