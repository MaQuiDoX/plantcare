import { z } from "zod";

export const groups = {
  foliage: "Follaje tropical (poto, monstera, filodendro)", succulent: "Suculentas y cactus de ambiente seco",
  fern: "Helechos de interior", orchid: "Orquídeas epífitas (Phalaenopsis)", general: "Otra especie / sin confirmar",
} as const;
export const recipes: Record<keyof typeof groups, { name: string; percent: number }[]> = {
  foliage: [{ name: "Sustrato para interior", percent: 50 }, { name: "Corteza de pino compostada", percent: 25 }, { name: "Perlita o piedra pómez", percent: 25 }],
  succulent: [{ name: "Sustrato para cactus", percent: 40 }, { name: "Piedra pómez o gravilla hortícola", percent: 60 }],
  fern: [{ name: "Sustrato para interior", percent: 60 }, { name: "Fibra de coco hidratada", percent: 20 }, { name: "Perlita", percent: 20 }],
  orchid: [{ name: "Corteza para orquídeas", percent: 80 }, { name: "Perlita gruesa", percent: 20 }],
  general: [{ name: "Sustrato para macetas", percent: 70 }, { name: "Perlita o piedra pómez", percent: 30 }],
};
export function speciesGroup(species: string | null): keyof typeof groups {
  const name = species?.trim().toLowerCase() ?? "";
  if (/^(monstera|epipremnum|philodendron)\b/.test(name)) return "foliage";
  if (/^(aloe|echeveria|crassula|haworthia|mammillaria|opuntia)\b/.test(name)) return "succulent";
  if (/^(nephrolepis|asplenium|adiantum)\b/.test(name)) return "fern";
  if (/^phalaenopsis\b/.test(name)) return "orchid";
  return "general";
}
export const calculatorSchema = z.object({
  currentDiameter: z.number().min(3).max(100), state: z.enum(["comfortable", "crowded", "stressed"]),
  group: z.enum(["foliage", "succulent", "fern", "orchid", "general"]),
  top: z.number().min(3).max(120), bottom: z.number().min(1).max(120), height: z.number().min(3).max(100),
  headroom: z.number().min(0).max(10), rootDiameter: z.number().min(0).max(100), rootHeight: z.number().min(0).max(100),
}).refine((v) => v.bottom <= v.top && v.headroom < v.height, "Revisá la base y el espacio libre superior.")
  .refine((v) => (v.rootDiameter === 0) === (v.rootHeight === 0), "Para una maceta vacía, ambas medidas del cepellón deben ser cero.");
export function recommendedDiameter(current: number, state: "comfortable" | "crowded" | "stressed") {
  return Math.round((state === "crowded" ? current + (current < 20 ? 2.5 : 5) : current) * 10) / 10;
}
export function calculatePot(input: z.input<typeof calculatorSchema>) {
  const v = calculatorSchema.parse(input);
  const usableHeight = v.height-v.headroom;
  const usableTop = v.bottom+(v.top-v.bottom)*usableHeight/v.height;
  const capacity = Math.PI*usableHeight*(v.bottom*v.bottom + v.bottom*usableTop + usableTop*usableTop)/12/1000;
  const rootLiters = Math.PI*(v.rootDiameter/2)**2*v.rootHeight/1000;
  // Conservador: el cepellón cilíndrico debe caber también en la parte inferior.
  if (v.rootDiameter>v.bottom || v.rootHeight>usableHeight || rootLiters>capacity) throw new Error("El cepellón no cabe con estas medidas. Aumentá la base o la altura útil; no recortes raíces para hacer coincidir el cálculo.");
  const liters = Math.max(0, capacity-rootLiters);
  const prepare = liters*1.1;
  return { capacity, rootLiters, liters, prepare, recommended: recommendedDiameter(v.currentDiameter,v.state), components: recipes[v.group].map((c) => ({ ...c, liters: prepare*c.percent/100 })) };
}
