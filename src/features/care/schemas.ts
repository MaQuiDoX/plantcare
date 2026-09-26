import { z } from "zod";

export const timezoneSchema = z.string().min(1).max(100).refine((value) => {
  try { new Intl.DateTimeFormat("es", { timeZone: value }).format(); return true; } catch { return false; }
}, "Usá una zona horaria IANA válida, por ejemplo America/Argentina/Buenos_Aires.");
const coordinate = (max: number) => z.union([z.literal("").transform(() => null), z.coerce.number().min(-max).max(max).transform((v) => Math.round(v * 100) / 100)]);
export const locationSchema = z.object({ latitude: coordinate(90), longitude: coordinate(180), timezone: timezoneSchema })
  .refine((v) => (v.latitude === null) === (v.longitude === null), "Completá ambas coordenadas o dejá ambas vacías.");
export const profileSchema = z.object({ latitude: z.number().nullable(), longitude: z.number().nullable(), timezone: timezoneSchema });
export const scheduleInputSchema = z.object({
  plant: z.uuid(), version: z.union([z.literal("").transform(() => null), z.coerce.number().int().positive()]),
  base: z.coerce.number().int().min(1).max(365), mode: z.enum(["manual", "adaptive"]), anchor: z.iso.date(), enabled: z.enum(["yes", "no"]),
});
export const recommendationSchema = z.object({ days: z.number().int().min(1).max(730), season: z.string(), seasonFactor: z.number(), weatherFactor: z.number(), weatherUsed: z.boolean(), version: z.string() });
export const agendaSchema = z.object({
  id: z.uuid(), user_plant_id: z.uuid(), nickname: z.string(), placement: z.enum(["indoor", "outdoor", "sheltered"]),
  mode: z.enum(["manual", "adaptive"]), base_interval_days: z.number(), anchor_on: z.iso.date(), last_watered_on: z.iso.date().nullable(),
  enabled: z.boolean(), version: z.number().int(), today: z.iso.date(), due_on: z.iso.date(), recommendation: recommendationSchema,
  weather_observed_at: z.string().nullable(),
});
export type AgendaEntry = z.infer<typeof agendaSchema>;
export const weatherSchema = z.object({ temperature_c: z.number().min(-90).max(65), humidity_percent: z.number().int().min(0).max(100), rain_mm: z.number().min(0).max(1000), observed_at: z.iso.datetime({ offset: true }), expires_at: z.iso.datetime({ offset: true }), fetched_at: z.iso.datetime({ offset: true }) });
export function freshWeather(value: z.infer<typeof weatherSchema>, now: Date) {
  return Date.parse(value.expires_at) > now.getTime() && Date.parse(value.observed_at) > now.getTime() - 3 * 3600_000 && Date.parse(value.observed_at) <= now.getTime() + 300_000;
}
