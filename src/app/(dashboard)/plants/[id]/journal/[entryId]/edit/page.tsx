import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlantDetail } from "@/features/plants/queries";
import { getEntry, getTimezone } from "@/features/journal/queries";
import { todayInTimezone } from "@/features/journal/validation";
import { JournalForm, DeleteEntryForm } from "@/features/journal/journal-form";
export const metadata = { title: "Editar registro" };
export default async function EditEntryPage({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = await params;
  const plant = await getPlantDetail(id);
  if (plant.archived_at) redirect(`/plants/${id}`);
  const [entry, timezone] = await Promise.all([getEntry(id, entryId), getTimezone()]);
  return <><Link className="text-link" href={`/plants/${id}#diario`}>← Volver al diario</Link><div className="editor-heading"><span className="eyebrow">EL DIARIO DE {plant.nickname}</span><h1>Editar este momento.</h1></div><JournalForm id={entryId} plantId={id} today={todayInTimezone(timezone)} entry={entry} /><DeleteEntryForm entry={entry} /></>;
}
