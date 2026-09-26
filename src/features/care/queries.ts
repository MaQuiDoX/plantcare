import "server-only";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { agendaSchema, profileSchema, weatherSchema, freshWeather } from "./schemas";
import { todayInTimezone } from "@/features/journal/validation";

export async function getCareProfile() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("latitude,longitude,timezone").eq("id", user.id).single();
  if (error) throw new Error("No se pudo leer tu ubicación.");
  return profileSchema.parse(data);
}
export async function getSavedWeather(profile: z.infer<typeof profileSchema>) {
  if (profile.latitude === null || profile.longitude === null) return null;
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("weather_snapshots").select("temperature_c,humidity_percent,rain_mm,observed_at,expires_at,fetched_at").eq("user_id", user.id).eq("latitude", profile.latitude).eq("longitude", profile.longitude).order("fetched_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("No se pudo leer el clima guardado.");
  if (!data) return null;
  const weather = weatherSchema.parse(data);
  return { ...weather, fresh: freshWeather(weather, new Date()) };
}
export async function getAgenda(page = 1, plantId?: string) {
  const user = await requireUser();
  const supabase = await createClient();
  let query = supabase.from("watering_agenda").select("*", { count: "exact" }).eq("user_id", user.id);
  if (plantId) query = query.eq("user_plant_id", plantId);
  const { data, error, count } = await query.order("enabled", { ascending: false }).order("due_on").order("id").range((page-1)*12,page*12-1);
  if (error) throw new Error("No se pudo leer la agenda. Verificá la migración de Fase 5.");
  return { entries: z.array(agendaSchema).parse(data), count: count ?? 0 };
}
export async function getScheduleFormData(plantId: string, speciesId: string | null) {
  const [profile, agenda] = await Promise.all([getCareProfile(), getAgenda(1, plantId)]);
  let speciesBase: number | null = null;
  if (speciesId) {
    const supabase = await createClient();
    const { data, error } = await supabase.from("plants").select("base_watering_days,reviewed_at").eq("id", speciesId).maybeSingle();
    if (!error) { const parsed = z.object({ base_watering_days: z.number().int().min(1).max(365).nullable(), reviewed_at: z.string().nullable() }).safeParse(data); if (parsed.success && parsed.data.reviewed_at) speciesBase=parsed.data.base_watering_days; }
  }
  return { schedule: agenda.entries[0] ?? null, speciesBase, today: todayInTimezone(profile.timezone) };
}
