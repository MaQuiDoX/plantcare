"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { mutationError, type FormState } from "@/features/plants/validation";
import { locationSchema, scheduleInputSchema } from "./schemas";
import { getCareProfile, getSavedWeather } from "./queries";
import { fetchWeather, getWeatherConfig, weatherAdmin, WeatherError } from "./weather";
import { todayInTimezone } from "@/features/journal/validation";

export async function saveLocation(_state: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const input = locationSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { status: "error", message: "Revisá las coordenadas (latitud −90 a 90, longitud −180 a 180) y la zona horaria. Para quitar la ubicación, dejá ambas coordenadas vacías." };
  const supabase = await createClient();
  const { error } = await supabase.from("users").update(input.data).eq("id", user.id);
  if (error) return mutationError(error.code);
  revalidatePath("/plants", "layout");
  return { status: "success", message: "Ubicación guardada. Las fechas usan tu zona horaria; podés actualizar el clima cuando lo necesites." };
}

export async function updateWeather(): Promise<FormState> {
  const user = await requireUser();
  const config = getWeatherConfig();
  if (!config) return { status: "error", message: "El clima necesita OPENWEATHER_API_KEY y la clave secreta de Supabase en el servidor. La agenda puede usar la estación sin datos meteorológicos." };
  try {
    const profile = await getCareProfile();
    if (profile.latitude === null || profile.longitude === null) return { status: "error", message: "Guardá tu ubicación antes de consultar el clima." };
    const cached = await getSavedWeather(profile);
    if (cached?.fresh) return { status: "success", message: "El clima guardado todavía está vigente. Se reutiliza hasta una hora para evitar consultas repetidas." };
    const admin = weatherAdmin(config);
    const claim = await admin.rpc("claim_weather_fetch", { p_user: user.id });
    if (claim.error) return mutationError();
    if (!claim.data) return { status: "error", message: "La consulta está en curso o en período de espera. Tras un error esperá 10 minutos; después de una consulta exitosa, hasta una hora." };
    if (!z.uuid().safeParse(claim.data).success) return mutationError();
    const weather = await fetchWeather(profile.latitude, profile.longitude, config.key, new Date());
    const { error } = await admin.rpc("finish_weather_fetch", { p_user: user.id, p_token: claim.data, p_lat: profile.latitude, p_lon: profile.longitude, p_temp: weather.temperature, p_humidity: weather.humidity, p_rain: weather.rain, p_observed: weather.observedAt });
    if (error) return mutationError(error.code);
  } catch (error) {
    const messages: Record<string,string> = { auth: "La clave de OpenWeather no es válida o todavía no está activa.", quota: "OpenWeather alcanzó su límite de consultas.", timeout: "OpenWeather tardó demasiado en responder.", invalid: "La respuesta del clima no superó la validación.", stale: "El proveedor devolvió una observación demasiado antigua." };
    return { status: "error", message: `${error instanceof WeatherError ? messages[error.code] ?? "No se pudo consultar el clima." : "No se pudo guardar el clima."} Se mantiene la agenda sin usar datos vencidos. Reintentá en 10 minutos.` };
  }
  revalidatePath("/plants", "layout");
  return { status: "success", message: "Clima actualizado. La agenda ya refleja las nuevas condiciones." };
}

export async function saveSchedule(_state: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const input = scheduleInputSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { status: "error", message: "Ingresá un intervalo de 1 a 365 días y una fecha de inicio válida." };
  const profile = await getCareProfile();
  if (input.data.anchor > todayInTimezone(profile.timezone)) return { status: "error", message: "La fecha de inicio no puede ser futura." };
  const { plant, version, base, mode, anchor, enabled } = input.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_watering_schedule", { p_plant: plant, p_version: version, p_base: base, p_mode: mode, p_anchor: anchor, p_enabled: enabled === "yes" });
  if (error) return mutationError(error.code);
  revalidatePath("/plants", "layout");
  return { status: "success", message: "Agenda guardada. Revisá la humedad antes de regar; la fecha es orientativa." };
}

export async function recordWatering(_state: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const input = z.object({ id: z.uuid(), plant: z.uuid(), confirmation: z.literal("on") }).safeParse(Object.fromEntries(form));
  if (!input.success) return { status: "error", message: "Confirmá que efectivamente regaste la planta." };
  const profile = await getCareProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_journal_entry", { p_id: input.data.id, p_plant_id: input.data.plant, p_version: null, p_date: todayInTimezone(profile.timezone), p_kind: "watering", p_notes: "Riego registrado desde la agenda.", p_water_ml: null, p_height_cm: null, p_photo_path: null, p_photo_size: null, p_remove_photo: false });
  if (error) return mutationError(error.code);
  revalidatePath("/plants", "layout");
  return { status: "success", message: "Riego anotado en el diario. La próxima revisión se calculó desde ese registro." };
}
