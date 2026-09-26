import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlantDetail } from "@/features/plants/queries";
import { getTimezone } from "@/features/journal/queries";
import { todayInTimezone } from "@/features/journal/validation";
import { JournalForm } from "@/features/journal/journal-form";
export const metadata = { title: "Nuevo registro" };
export default async function NewEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plant = await getPlantDetail(id);
  if (plant.archived_at) redirect(`/plants/${id}`);
  const today = todayInTimezone(await getTimezone());
  return <><Link className="text-link" href={`/plants/${id}#diario`}>← Volver al diario</Link><div className="editor-heading"><span className="eyebrow">EL DIARIO DE {plant.nickname}</span><h1>Guardá un nuevo momento.</h1><p>Una hoja nueva, un riego o una foto para recordar cómo va creciendo.</p></div><JournalForm id={randomUUID()} plantId={id} today={today} /></>;
}
