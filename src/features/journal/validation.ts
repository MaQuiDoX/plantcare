import { z } from "zod";
import { optionalNumber } from "@/features/plants/validation";

export const kinds = { note: "Observación", watering: "Riego", fertilizing: "Fertilización", repotting: "Trasplante", inspection: "Revisión", pruning: "Poda" } as const;
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const journalSchema = z.object({
  id: z.uuid(), user_plant_id: z.uuid(),
  version: z.union([z.literal("").transform(() => null), z.coerce.number().int().positive()]),
  entry_date: z.iso.date("Ingresá una fecha válida."),
  kind: z.enum(["note", "watering", "fertilizing", "repotting", "inspection", "pruning"]),
  notes: z.string().trim().max(10000, "Usá como máximo 10.000 caracteres."),
  water_ml: optionalNumber(1000000).refine((v) => v === null || Number.isInteger(v), "Ingresá una cantidad entera de mililitros."),
  height_cm: optionalNumber(99999),
  remove_photo: z.enum(["", "on"]).transform((v) => v === "on"),
}).refine((v) => v.kind === "watering" || v.water_ml === null, { path: ["water_ml"], message: "La cantidad de agua sólo corresponde a un riego." });

export function todayInTimezone(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function formatDay(day: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}
