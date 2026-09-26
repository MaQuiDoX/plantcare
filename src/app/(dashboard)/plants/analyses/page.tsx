import Link from "next/link";
import { listAnalyses } from "@/features/ai/queries";

export const metadata = { title: "Historial de análisis" };
const statuses = { queued: "En espera", running: "En proceso", succeeded: "Listo para revisar", failed: "No completado" };
export default async function AnalysesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const requested = Number(params.page);
  const page = Number.isSafeInteger(requested) && requested > 0 && requested < 10000 ? requested : 1;
  const { entries, count } = await listAnalyses(page);
  return <><Link href="/plants" className="text-link">← Mi colección</Link><div className="editor-heading"><span className="eyebrow">OBSERVAR, APRENDER, CUIDAR</span><h1>Mis análisis</h1><p>Las consultas y sus resultados, en un historial privado.</p></div>
    <Link className="button button-primary" href="/plants/analyze">Identificar una planta</Link>
    <div className="ai-history">{entries.length ? entries.map((entry) => <article key={entry.id} className="journal-card"><h2><Link href={`/plants/analyses/${entry.id}`}>{entry.kind === "identification" ? "Identificación de especie" : "Revisión de salud"}</Link></h2><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString("es-AR", { timeZone: "UTC" })} UTC</time><p>{statuses[entry.status]}</p></article>) : <p className="notice">Todavía no hay análisis en esta página.</p>}</div>
    {(count > 12 || page > 1) && <nav className="pagination" aria-label="Páginas de análisis">{page > 1 && <Link href={`/plants/analyses?page=${page - 1}`}>← Anterior</Link>}<span>Página {page}</span>{count > page * 12 && <Link href={`/plants/analyses?page=${page + 1}`}>Siguiente →</Link>}</nav>}
  </>;
}
