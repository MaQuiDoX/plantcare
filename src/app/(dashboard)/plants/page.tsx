import Link from "next/link";
import { ArrowLeft, ArrowRight, House, Leaf, Plus, Search, Sprout, Sun } from "lucide-react";
import { CleanupControl } from "@/features/plants/plant-controls";
import { PlantIllustration } from "@/components/plant-illustration";
import { getPlantDashboard, PAGE_SIZE } from "@/features/plants/queries";

export const metadata = { title: "Mis Plantas" };
const placements = { indoor: "Interior", outdoor: "Exterior", sheltered: "Exterior protegido" };

export default async function PlantsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; archived?: string; cleanup?: string }> }) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const requested = Number(params.page);
  const page = Number.isSafeInteger(requested) && requested > 0 && requested <= 10000 ? requested : 1;
  const archived = params.archived === "1";
  const data = await getPlantDashboard(search, page, archived);
  const pages = Math.max(1, Math.ceil(data.matching / PAGE_SIZE));
  const pageHref = (target: number) => `/plants?${new URLSearchParams({ q: search, page: String(target), archived: archived ? "1" : "0" })}`;
  return <>
    <div className="page-heading"><div><span className="eyebrow">TU PEQUEÑO MUNDO VERDE</span><h1>Mis Plantas<span className="heading-dot">.</span></h1><p>{data.name ? `Hola, ${data.name}. ` : "Hola. "}Un espacio para ver crecer lo que cuidás.</p></div><Link className="button button-primary" href="/plants/new"><Plus size={17} /> Agregar planta</Link></div>
    <nav className="ai-actions" aria-label="Inteligencia artificial"><Link className="button button-secondary" href="/plants/analyze">Identificar por foto</Link><Link className="text-link" href="/plants/analyses">Mis análisis →</Link></nav>
    <section className="welcome-banner" aria-label="Bienvenida"><div><span className="eyebrow">CRECER LLEVA SU TIEMPO</span><h2>Cada planta tiene su historia.<br /><em>La tuya empieza en casa.</em></h2><p>Tu colección, reunida en un solo lugar.</p></div><div className="banner-art"><PlantIllustration small /></div></section>
    <section className="stats-grid" aria-label="Resumen de mi colección">
      <div className="stat-card"><span className="stat-icon"><Sprout size={22} /></span><div><span>Total de plantas</span><strong>{data.total}<small>en tu colección</small></strong></div></div>
      <div className="stat-card"><span className="stat-icon warm"><House size={22} /></span><div><span>De interior</span><strong>{data.indoor}<small>creciendo en casa</small></strong></div></div>
      <div className="stat-card"><span className="stat-icon pale"><Sun size={22} /></span><div><span>De exterior</span><strong>{data.total - data.indoor}<small>al aire libre o protegidas</small></strong></div></div>
    </section>
    <section aria-labelledby="collection-title" className="collection-section"><nav className="collection-tabs" aria-label="Estado de las plantas"><Link href="/plants" aria-current={!archived ? "page" : undefined}>Mi colección</Link><Link href="/plants?archived=1" aria-current={archived ? "page" : undefined}>Archivadas</Link></nav><div className="collection-toolbar"><h2 id="collection-title">{archived ? "Plantas archivadas" : "Tu colección"} <span>{data.matching}</span></h2>
      <form action="/plants" className="search-form" role="search"><input type="hidden" name="archived" value={archived ? "1" : "0"} /><Search size={17} /><label className="sr-only" htmlFor="plant-search">Buscar plantas por nombre</label><input id="plant-search" name="q" type="search" defaultValue={search} maxLength={100} placeholder="Buscar por nombre…" /><button type="submit">Buscar</button></form>
    </div>
    {data.plants.length ? <div className="plant-grid">{data.plants.map((plant) => <article className="plant-card" key={plant.id}><Link href={`/plants/${plant.id}`} className="plant-card-link"><div className="plant-card-art"><Leaf size={50} strokeWidth={1} /></div><div className="plant-card-copy"><span className="plant-placement">{placements[plant.placement]}</span><h3>{plant.nickname}</h3><p className="scientific-name">{plant.plants?.scientific_name ?? plant.species_label ?? "Especie sin identificar"}</p><p>{plant.location_label ?? "Sin ubicación asignada"}</p><span className="card-link-label">Ver ficha y diario →</span></div></Link></article>)}</div> : <div className="empty-collection"><div className="empty-icon"><Sprout size={34} strokeWidth={1.4} /></div><h3>{archived ? "No hay plantas archivadas en esta vista" : search || page > 1 ? "No encontramos plantas en esta vista" : "Todo empieza con una primera planta"}</h3><p>{search || page > 1 || archived ? "Probá otro nombre o volvé al inicio de tu colección." : "Sumá tu primera planta y empezá a registrar su historia."}</p>{search || page > 1 || archived ? <Link href="/plants" className="text-link">Ver toda la colección <ArrowRight size={16} /></Link> : <Link href="/plants/new" className="text-link">Agregar mi primera planta <Plus size={16} /></Link>}</div>}
    {(pages > 1 || page > 1) && <nav className="pagination" aria-label="Páginas de la colección">{page > 1 && <Link href={pageHref(page - 1)}><ArrowLeft size={16} /> Anterior</Link>}<span>Página {page} · {data.matching} resultados</span>{page < pages && <Link href={pageHref(page + 1)}>Siguiente <ArrowRight size={16} /></Link>}</nav>}
    </section>
    <div className="observation-note"><Leaf size={18} /><p><strong>Un momento para observar.</strong> Mirá las hojas, tocá el sustrato y conocé el ritmo de tus plantas.</p></div>
    <CleanupControl warning={params.cleanup === "pending"} />
  </>;
}
