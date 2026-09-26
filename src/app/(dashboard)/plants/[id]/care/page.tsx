import Link from "next/link";
import { getPlantDetail } from "@/features/plants/queries";
import { getScheduleFormData } from "@/features/care/queries";
import { ScheduleForm } from "@/features/care/forms";
import { AgendaCard } from "@/features/care/agenda-view";

export const metadata={title:"Riego y cuidados"};
export default async function PlantCarePage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const plant=await getPlantDetail(id);
  if(plant.archived_at) return <><Link href={`/plants/${id}`} className="text-link">← Volver a {plant.nickname}</Link><p className="notice">Restaurá la planta para configurar su agenda.</p></>;
  const data=await getScheduleFormData(id,plant.plant_id);
  return <><Link href={`/plants/${id}`} className="text-link">← Volver a {plant.nickname}</Link><div className="editor-heading"><span className="eyebrow">CUIDAR CON ATENCIÓN</span><h1>Riego de {plant.nickname}</h1><p>La próxima revisión parte del último riego anotado en el diario.</p></div>{data.schedule&&<AgendaCard entry={data.schedule}/>}<ScheduleForm key={data.schedule?.version ?? "new"} plant={id} {...data}/><p><Link href="/plants/care" className="text-link">Ver agenda y configurar clima →</Link></p><p><Link href={`/plants/${id}/calculator`} className="text-link">Calcular maceta y sustrato →</Link></p></>;
}
