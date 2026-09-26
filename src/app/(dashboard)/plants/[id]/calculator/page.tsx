import Link from "next/link";
import { getPlantDetail } from "@/features/plants/queries";
import { PotCalculator } from "@/features/care/calculator-form";

export const metadata={title:"Calculadora de macetas y sustrato"};
export default async function CalculatorPage({params}:{params:Promise<{id:string}>}) {
  const {id}=await params; const plant=await getPlantDetail(id);
  return <><Link href={`/plants/${id}`} className="text-link">← Volver a {plant.nickname}</Link><div className="editor-heading"><span className="eyebrow">ESPACIO PARA CRECER</span><h1>Maceta y sustrato</h1><p>Planificá el próximo trasplante de {plant.nickname} con medidas reales.</p></div><PotCalculator species={plant.plants?.scientific_name ?? plant.species_label} diameter={plant.pot_diameter_cm} height={plant.pot_height_cm} drainage={plant.has_drainage}/><p className="notice">El cálculo no guarda cambios ni crea un trasplante en el diario. Cuando lo realices, actualizá la ficha y registralo para conservar su historia.</p></>;
}
