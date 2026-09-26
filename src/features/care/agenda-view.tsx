import Link from "next/link";
import { randomUUID } from "node:crypto";
import type { AgendaEntry } from "./schemas";
import { formatDay } from "@/features/journal/validation";
import { WateringButton } from "./forms";

export function AgendaCard({ entry }: { entry: AgendaEntry }) {
  const r=entry.recommendation;
  return <article className="editor-section care-card" id={`care-${entry.id}`}><div className="care-card-heading"><div><span className="eyebrow">{!entry.enabled ? "PAUSADA" : entry.due_on<entry.today ? "REVISIÓN PENDIENTE" : entry.due_on===entry.today ? "REVISAR HOY" : "PRÓXIMA REVISIÓN"}</span><h2><Link href={`/plants/${entry.user_plant_id}`}>{entry.nickname}</Link></h2></div><strong>{formatDay(entry.due_on)}</strong></div>
    <p>Intervalo orientativo: <strong>{r.days} días</strong> · Base: {entry.base_interval_days} días · {entry.mode==="manual" ? "Modo manual" : r.season}.</p>
    <p>{entry.last_watered_on ? `Último riego en el diario: ${formatDay(entry.last_watered_on)}.` : `Sin riegos registrados. Seguimiento desde ${formatDay(entry.anchor_on)}.`}</p>
    {entry.mode==="adaptive" && <p className="field-hint">{entry.placement==="indoor" ? "En interior, el ajuste estacional es suave y no usa la temperatura ni la lluvia exterior." : r.weatherUsed ? `Usa clima exterior reciente. Factor estacional: ${r.seasonFactor.toFixed(2)}; factor meteorológico: ${r.weatherFactor.toFixed(2)}.` : "Sin clima vigente para esta ubicación: se usa solo la estación, si la latitud está configurada."} La lluvia observada no confirma que el sustrato esté húmedo.</p>}
    {entry.enabled && <WateringButton id={randomUUID()} plant={entry.user_plant_id}/>}
    <div className="care-actions"><Link className="text-link" href={`/plants/${entry.user_plant_id}/care`}>Configurar agenda →</Link><Link className="text-link" href={`/plants/${entry.user_plant_id}#diario`}>Ver diario →</Link></div>
  </article>;
}
export function Calendar({ entries,today }: { entries:AgendaEntry[]; today:string }) {
  const start=new Date(`${today}T12:00:00Z`);
  const dates=Array.from({length:14},(_,index)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+index);return date.toISOString().slice(0,10);});
  return <section className="care-calendar" aria-label="Próximas dos semanas"><h2>Las próximas dos semanas</h2><p>Próxima revisión de cada agenda activa en esta página. Las revisiones atrasadas aparecen en la lista inferior.</p><ol>{dates.map((date)=><li key={date}><time dateTime={date}>{new Intl.DateTimeFormat("es-AR",{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`))}</time>{entries.filter((e)=>e.enabled&&e.due_on===date).map((entry)=><a key={entry.id} href={`#care-${entry.id}`}>{entry.nickname}</a>)}</li>)}</ol></section>;
}
