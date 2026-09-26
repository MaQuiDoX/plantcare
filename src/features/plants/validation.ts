import { z } from "zod";

export const placements = { indoor: "Interior", outdoor: "Exterior", sheltered: "Exterior protegido" } as const;
export const lights = { low: "Luz baja", indirect: "Luz indirecta", direct: "Sol directo" } as const;
export const materials = { plastic: "Plástico", terracotta: "Terracota", ceramic: "Cerámica", other: "Otro" } as const;
const optionalText = (max: number) => z.string().trim().max(max, `Usá como máximo ${max} caracteres.`).transform((v) => v || null);
export const optionalNumber = (max: number) => z.union([z.literal("").transform(() => null), z.coerce.number().positive("Debe ser mayor que cero.").max(max, `El máximo es ${max}.`)]);
export const plantSchema = z.object({
  id: z.uuid(),
  version: z.union([z.literal("").transform(() => null), z.coerce.number().int().positive()]),
  nickname: z.string().trim().min(1, "Ingresá un nombre para tu planta.").max(100),
  species_label: optionalText(200),
  plant_id: z.union([z.literal("").transform(() => null), z.uuid()]),
  acquired_on: z.union([z.literal("").transform(() => null), z.iso.date("Ingresá una fecha válida.")]),
  placement: z.enum(["indoor", "outdoor", "sheltered"]),
  location_label: optionalText(200),
  light: z.union([z.literal("").transform(() => null), z.enum(["low", "indirect", "direct"])]),
  pot_diameter_cm: optionalNumber(9999),
  pot_height_cm: optionalNumber(9999),
  pot_material: z.union([z.literal("").transform(() => null), z.enum(["plastic", "terracotta", "ceramic", "other"])]),
  has_drainage: z.enum(["", "yes", "no"]).transform((v) => v === "" ? null : v === "yes"),
  substrate_notes: optionalText(3000),
});
export type FormState = { status: "idle" | "error" | "success"; message?: string; errors?: Record<string, string[] | undefined> };
export const initialState: FormState = { status: "idle" };
export function mutationError(code?: string): FormState {
  return { status: "error", message: code === "40001" ? "Este registro cambió en otra ventana. Recargá la página antes de editarlo." : "No pudimos guardar el cambio. Revisá la conexión y volvé a intentarlo." };
}
