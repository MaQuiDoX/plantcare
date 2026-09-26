/* eslint-disable @next/next/no-img-element -- Foto privada servida por la ruta autenticada. */
import Link from "next/link";
import { getAnalysis } from "@/features/ai/queries";
import { analysisResultSchema, analysisError } from "@/features/ai/schemas";
import { getPlantDetail } from "@/features/plants/queries";
import { AcceptCandidate, RefreshAnalysis } from "@/features/ai/forms";
import { CareView } from "@/features/ai/care-view";

export const metadata = { title: "Resultado del análisis" };
export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const analysis = await getAnalysis(id);
  const plant = analysis.user_plant_id ? await getPlantDetail(analysis.user_plant_id) : null;
  const parsed = analysisResultSchema.safeParse(analysis.result);
  const result = analysis.status === "succeeded" && parsed.success && parsed.data.kind === analysis.kind ? parsed.data : null;
  const expired = analysis.expired;
  return <><Link href="/plants/analyses" className="text-link">← Mis análisis</Link>
    <div className="editor-heading"><span className="eyebrow">UNA ORIENTACIÓN PARA OBSERVAR MEJOR</span><h1>{analysis.kind === "identification" ? "Especies sugeridas" : "Revisión de salud"}</h1><p>{plant?.nickname ?? "Una nueva planta"} · {new Date(analysis.created_at).toLocaleString("es-AR", { timeZone: "UTC" })} UTC</p></div>
    <p className="notice">Estos resultados pueden ser incorrectos. Confirmá los rasgos de la planta y observá su evolución antes de intervenir. Los cuidados generados por IA son orientativos.</p>
    {analysis.media_asset_id && <img className="ai-photo" src={`/plants/media/${analysis.media_asset_id}`} alt="Foto utilizada para este análisis" />}
    {analysis.observations && <section className="editor-section"><h2>Tus observaciones</h2><p className="journal-notes">{analysis.observations}</p></section>}
    {analysis.status === "failed" && <p role="alert" className="error-box">{analysisError(analysis.error_code)}</p>}
    {["running", "queued"].includes(analysis.status) && <section className="editor-section"><h2>{expired ? "Este análisis quedó interrumpido" : "Análisis en curso"}</h2><p>{expired ? analysisError("interrupted") : "Actualizá el estado en unos momentos para consultar el resultado."}</p><RefreshAnalysis /></section>}
    {analysis.status === "succeeded" && !result && <p className="error-box">El resultado guardado no tiene un formato compatible. No se puede aplicar a la ficha.</p>}
    {result?.kind === "identification" && <>
      <p>La puntuación de Pl@ntNet indica coincidencia con la imagen; no garantiza la identificación. También puede faltar la especie correcta entre las opciones.</p>
      {result.careWarning && <p className="notice">La identificación está disponible, pero no se pudo generar la ficha de cuidados. {analysisError(result.careWarning)}</p>}
      {analysis.applied_at && <p className="success-box">Ya confirmaste una especie de este análisis. <Link href={`/plants/${analysis.user_plant_id}`}>Ver la ficha</Link></p>}
      <div className="ai-candidates">{result.candidates.map((candidate, index) => <article className="editor-section" key={`${candidate.name}-${index}`}><span className="eyebrow">OPCIÓN {index + 1} · COINCIDENCIA {(candidate.score * 100).toFixed(1)} %</span><h2><i>{candidate.name}</i></h2><p>{candidate.commonNames.join(" · ")}</p><p>Familia: {candidate.family}</p>{candidate.care && <CareView care={candidate.care} />}{!analysis.applied_at && !plant?.archived_at && <AcceptCandidate id={id} choice={index} version={plant?.version} nickname={candidate.commonNames[0] ?? candidate.name} />}</article>)}</div>
      <p className="field-hint">Pl@ntNet · versión {result.plantnetVersion}. Las fichas de cuidados se generaron con Gemini. Confirmar reemplaza la especie anotada y conserva la ubicación y la maceta registradas.</p>
    </>}
    {result?.kind === "diagnosis" && <section className="editor-section"><h2>{result.diagnosis.assessable ? "Qué podría estar pasando" : "Necesitamos una foto más clara"}</h2><p>{result.diagnosis.summary}</p>{result.diagnosis.hypotheses.map((hypothesis, index) => <article className="ai-hypothesis" key={index}><h3>{hypothesis.cause}</h3><ul>{hypothesis.evidence.map((item, i) => <li key={i}>{item}</li>)}</ul><p><strong>Por confirmar:</strong> {hypothesis.uncertainty}</p></article>)}<h3>Primeros pasos</h3><ol>{result.diagnosis.firstSteps.map((item, i) => <li key={i}>{item}</li>)}</ol><h3>Qué comprobar</h3><ul>{result.diagnosis.checks.map((item, i) => <li key={i}>{item}</li>)}</ul><h3>Cuándo consultar</h3><p>{result.diagnosis.consultWhen}</p><p className="field-hint">Este análisis no confirma una enfermedad ni modifica la ficha o el calendario de cuidados.</p></section>}
    <p className="field-hint">Proveedor: {analysis.provider} · Modelo Gemini solicitado: {analysis.model} · Formato: {analysis.schema_version}</p>
    {plant && <p><Link className="text-link" href={`/plants/${plant.id}`}>Volver a {plant.nickname} →</Link></p>}
    {!plant?.archived_at && <Link className="button button-secondary" href={`/plants/analyze?${new URLSearchParams({ kind: analysis.kind, ...(plant ? { plant: plant.id } : {}) })}`}>Iniciar otro análisis</Link>}
  </>;
}
