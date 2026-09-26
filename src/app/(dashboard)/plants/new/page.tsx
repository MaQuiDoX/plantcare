import { randomUUID } from "node:crypto";
import Link from "next/link";
import { PlantForm } from "@/features/plants/plant-form";
import { getSpeciesOptions } from "@/features/plants/queries";

export const metadata = { title: "Agregar planta" };
export default async function NewPlantPage() {
  const species = await getSpeciesOptions();
  return <><Link className="text-link" href="/plants">← Volver a Mis Plantas</Link><div className="editor-heading"><span className="eyebrow">UNA NUEVA HISTORIA</span><h1>Sumá una planta a tu jardín.</h1><p>Empezá con su nombre. El resto lo podés descubrir con el tiempo.</p></div><PlantForm id={randomUUID()} species={species} /></>;
}
