import { careSchema } from "./schemas";
import type { z } from "zod";

const labels = { lighting: "Iluminación", location: "Ubicación", temperature: "Temperatura", watering: "Riego", substrate: "Sustrato" };
export function CareView({ care }: { care: z.infer<typeof careSchema> }) {
  return <dl className="ai-care">{Object.entries(labels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{care[key as keyof typeof care]}</dd></div>)}</dl>;
}
