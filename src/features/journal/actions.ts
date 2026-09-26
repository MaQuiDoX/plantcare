"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { mutationError, type FormState } from "@/features/plants/validation";
import { journalSchema, todayInTimezone } from "./validation";
import { normalizePhoto } from "./images";
import { flushStorageCleanup } from "./storage";
import { getTimezone } from "./queries";

export async function saveEntry(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = journalSchema.safeParse({ ...Object.fromEntries(form), remove_photo: form.get("remove_photo") ?? "" });
  if (!parsed.success) return { status: "error", message: "Revisá los campos indicados.", errors: z.flattenError(parsed.error).fieldErrors };
  const input = parsed.data;
  const file = form.get("photo");
  let cleanup = true;
  try {
    const supabase = await createClient();
    const { data: plant, error: plantError } = await supabase.from("user_plants").select("id").eq("id", input.user_plant_id).eq("user_id", user.id).is("archived_at", null).maybeSingle();
    if (plantError || !plant) return { status: "error", message: "La planta no está disponible para registrar cambios." };
    if (input.entry_date > todayInTimezone(await getTimezone())) return { status: "error", message: "La fecha del registro no puede estar en el futuro." };
    let photoPath: string | null = null;
    let photoSize: number | null = null;
    if (file instanceof File && file.size > 0) {
      let photo: Buffer;
      try { photo = await normalizePhoto(file); }
      catch (error) { return { status: "error", message: error instanceof Error ? error.message : "La foto no es válida." }; }
      await flushStorageCleanup(supabase, user.id).catch(() => false);
      const reservation = await supabase.rpc("reserve_journal_photo", { p_plant_id: input.user_plant_id });
      if (reservation.error || typeof reservation.data !== "string") return { status: "error", message: "No pudimos preparar la foto. Revisá la conexión o reintentá la limpieza de archivos pendientes." };
      photoPath = reservation.data;
      photoSize = photo.length;
      const { error } = await supabase.storage.from("plant-images").upload(photoPath, photo, { contentType: "image/webp", upsert: false });
      if (error) return { status: "error", message: "No pudimos subir la foto. La entrada no se guardó; podés volver a intentarlo." };
    }
    const { error } = await supabase.rpc("save_journal_entry", {
      p_id: input.id, p_plant_id: input.user_plant_id, p_version: input.version,
      p_date: input.entry_date, p_kind: input.kind, p_notes: input.notes,
      p_water_ml: input.water_ml, p_height_cm: input.height_cm,
      p_photo_path: photoPath, p_photo_size: photoSize, p_remove_photo: input.remove_photo,
    });
    if (error) return mutationError(error.code);
    cleanup = await flushStorageCleanup(supabase, user.id).catch(() => false);
  } catch { return mutationError(); }
  revalidatePath("/plants", "layout");
  redirect(`/plants/${input.user_plant_id}${cleanup ? "" : "?cleanup=pending"}#diario`);
}

export async function deleteEntry(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ id: z.uuid(), user_plant_id: z.uuid(), version: z.coerce.number().int().positive(), confirmation: z.literal("ELIMINAR") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Escribí ELIMINAR para confirmar." };
  const input = parsed.data;
  let cleanup = true;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("journal_entries").delete().eq("id", input.id).eq("user_id", user.id).eq("user_plant_id", input.user_plant_id).eq("version", input.version).select("id").maybeSingle();
    if (error) return mutationError(error.code);
    if (!data) return mutationError("40001");
    cleanup = await flushStorageCleanup(supabase, user.id).catch(() => false);
  } catch { return mutationError(); }
  revalidatePath("/plants", "layout");
  redirect(`/plants/${input.user_plant_id}${cleanup ? "" : "?cleanup=pending"}#diario`);
}
