import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import { getAIConfig } from "@/features/ai/config";
import { AnalysisForm } from "@/features/ai/forms";
import { getPlantDetail } from "@/features/plants/queries";

export const metadata = { title: "Analizar una planta" };
export const maxDuration = 120;
export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ kind?: string; plant?: string }> }) {
  const params = await searchParams;
  const kind = params.kind ?? "identification";
  if (!["identification", "diagnosis"].includes(kind) || (kind === "diagnosis" && !params.plant)) notFound();
  const plant = params.plant ? await getPlantDetail(params.plant) : null;
  const configured = Boolean(getAIConfig());
  return <><Link className="text-link" href={plant ? `/plants/${plant.id}` : "/plants"}>← Volver a {plant?.nickname ?? "mi colección"}</Link>
    <div className="editor-heading"><span className="eyebrow">UNA FOTO, UNA NUEVA PISTA</span><h1>{kind === "diagnosis" ? "Revisar su salud" : "Identificar una especie"}</h1><p>{kind === "diagnosis" ? "Exploremos posibles causas y qué observar antes de actuar." : "Compará las especies sugeridas y elegí la que corresponde a tu planta."}</p></div>
    <p className="notice">La IA ofrece orientación y puede equivocarse. Una imagen no permite confirmar todas las especies ni distinguir siempre una plaga de problemas de riego. Contrastá los resultados antes de aplicar tratamientos.</p>
    {!configured ? <section className="editor-section"><h2>La IA todavía no está configurada</h2><p>Agregá las claves de Pl@ntNet, Gemini y la clave secreta de Supabase en el servidor, elegí el modelo y aplicá la migración 004. La guía docs/FASE_4.md del proyecto detalla cada paso.</p><p>Mientras tanto, podés seguir usando el catálogo y el diario.</p></section> : plant?.archived_at ? <p className="notice">Restaurá esta planta antes de iniciar un análisis.</p> : <AnalysisForm id={randomUUID()} kind={kind as "identification" | "diagnosis"} plant={plant?.id ?? ""} />}
    <p><Link className="text-link" href="/plants/analyses">Ver mi historial de análisis →</Link></p>
  </>;
}
