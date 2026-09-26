import Link from "next/link";
import { redirect } from "next/navigation";
import { PlantForm } from "@/features/plants/plant-form";
import { getPlantDetail, getSpeciesOptions } from "@/features/plants/queries";
export const metadata = { title: "Editar planta" };
export default async function EditPlantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plant = await getPlantDetail(id);
  if (plant.archived_at) redirect(`/plants/${id}`);
  const species = await getSpeciesOptions();
  return <><Link className="text-link" href={`/plants/${id}`}>← Volver a la ficha</Link><div className="editor-heading"><span className="eyebrow">SU FICHA PERSONAL</span><h1>Editar {plant.nickname}</h1></div><PlantForm id={id} plant={plant} species={species} /></>;
}
