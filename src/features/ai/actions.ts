"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { normalizePhoto } from "@/features/journal/images";
import { flushStorageCleanup } from "@/features/journal/storage";
import { mutationError, type FormState } from "@/features/plants/validation";
import { getAIConfig, createAIAdmin } from "./config";
import { AIError, identifyPlant, diagnosePlant } from "./providers";
import { analysisResultSchema } from "./schemas";

const requestSchema = z.object({
  id: z.uuid(), kind: z.enum(["identification", "diagnosis"]),
  plant: z.union([z.uuid(), z.literal("")]), observations: z.string().trim().max(2000), consent: z.literal("on"),
}).refine((value) => value.kind !== "diagnosis" || Boolean(value.plant));

export async function startAnalysis(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const config = getAIConfig();
  if (!config) return { status: "error", message: "La IA todavía no está configurada. Seguí la guía de Fase 4 para habilitarla." };
  const parsed = requestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Revisá los datos y aceptá el envío de la foto al proveedor." };
  const { id, kind, plant, observations } = parsed.data;
  const file = form.get("photo");
  if (!(file instanceof File)) return { status: "error", message: "Elegí una foto de tu planta." };
  const supabase = await createClient();
  let species: string | null = null;
  if (plant) {
    const { data, error } = await supabase.from("user_plants").select("species_label,plants(scientific_name)").eq("id", plant).eq("user_id", user.id).is("archived_at", null).maybeSingle();
    if (error || !data) return { status: "error", message: "La planta no está disponible para analizar." };
    const plantContext = z.object({ species_label: z.string().nullable(), plants: z.object({ scientific_name: z.string() }).nullable() }).safeParse(data);
    species = plantContext.success ? plantContext.data.plants?.scientific_name ?? plantContext.data.species_label : null;
  }
  let photo: Buffer;
  try { photo = await normalizePhoto(file); }
  catch (error) { return { status: "error", message: error instanceof Error ? error.message : "No se pudo leer la imagen." }; }
  const admin = createAIAdmin(config);
  const { data: reservation, error: reserveError } = await admin.rpc("begin_ai_analysis", { p_user: user.id, p_id: id, p_plant: plant || null, p_kind: kind, p_model: config.model, p_observations: observations });
  if (reserveError) return { status: "error", message: reserveError.code === "54000" ? "Alcanzaste los 5 análisis de las últimas 24 horas. Probá más tarde." : reserveError.code === "55P03" ? "Ya hay un análisis en curso. Consultá el historial; si se interrumpió, esperá cinco minutos para iniciar otro." : "No se pudo iniciar el análisis. Verificá la migración de Fase 4 y la configuración del servidor." };
  const reserved = z.object({ id: z.uuid(), started: z.boolean(), path: z.string() }).safeParse(reservation);
  if (!reserved.success || reserved.data.id !== id || !reserved.data.path.startsWith(`${user.id}/`)) return mutationError();
  if (reserved.data.started) {
    let result: z.infer<typeof analysisResultSchema> | null = null;
    let errorCode: string | null = null;
    try {
      const { error } = await supabase.storage.from("plant-images").upload(reserved.data.path, photo, { contentType: "image/webp", upsert: false });
      if (error) throw new AIError("storage");
      result = analysisResultSchema.parse(kind === "identification" ? await identifyPlant(photo, config) : await diagnosePlant(photo, { species, observations }, config));
    } catch (error) { errorCode = error instanceof AIError ? error.code : "unavailable"; }
    const { error: finishError } = await admin.rpc("finish_ai_analysis", { p_user: user.id, p_id: id, p_result: result, p_error: errorCode, p_size: photo.length });
    if (finishError) return { status: "error", message: "No pudimos confirmar el guardado. Consultá el historial antes de iniciar otro análisis; reenviar este formulario no repetirá la consulta al proveedor." };
    if (errorCode) await flushStorageCleanup(supabase, user.id).catch(() => false);
  }
  revalidatePath("/plants", "layout");
  redirect(`/plants/analyses/${id}`);
}

export async function applyIdentification(_previous: FormState, form: FormData): Promise<FormState> {
  await requireUser();
  const parsed = z.object({ id: z.uuid(), choice: z.coerce.number().int().min(0).max(2), version: z.union([z.literal(""), z.coerce.number().int().positive()]), nickname: z.string().trim().max(100) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return mutationError();
  const { id, choice, version, nickname } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_ai_identification", { p_id: id, p_choice: choice, p_version: version || null, p_nickname: nickname });
  if (error) return mutationError(error.code);
  if (!z.uuid().safeParse(data).success) return mutationError();
  revalidatePath("/plants", "layout");
  redirect(`/plants/${data}`);
}
