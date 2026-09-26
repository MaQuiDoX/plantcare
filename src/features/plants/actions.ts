"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import { plantSchema, mutationError, type FormState } from "./validation";
import { flushStorageCleanup } from "@/features/journal/storage";

export async function savePlant(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = plantSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Revisá los campos indicados.", errors: z.flattenError(parsed.error).fieldErrors };
  const { id, version, ...fields } = parsed.data;
  try {
    const supabase = await createClient();
    if (version === null) {
      const { error } = await supabase.from("user_plants").insert({ id, user_id: user.id, ...fields });
      if (error) {
        // Reintentar un alta con el mismo id no debe duplicar el ejemplar.
        const { data: existing } = await supabase.from("user_plants").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
        if (error.code !== "23505" || !existing) return mutationError(error.code);
      }
    } else {
      const { data, error } = await supabase.from("user_plants").update(fields).eq("id", id).eq("user_id", user.id).eq("version", version).is("archived_at", null).select("id").maybeSingle();
      if (error) return mutationError(error.code);
      if (!data) return mutationError("40001");
    }
  } catch { return mutationError(); }
  revalidatePath("/plants", "layout");
  redirect(`/plants/${id}`);
}

export async function changePlantStatus(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ id: z.uuid(), version: z.coerce.number().int().positive(), operation: z.enum(["archive", "restore", "delete"]), confirmation: z.string().optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return mutationError();
  const { id, version, operation, confirmation } = parsed.data;
  let cleanup = true;
  try {
    const supabase = await createClient();
    const { data: plant, error: readError } = await supabase.from("user_plants").select("nickname,version").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (readError) return mutationError(readError.code);
    if (!plant || plant.version !== version) return mutationError("40001");
    if (operation === "delete" && confirmation !== plant.nickname) return { status: "error", message: "Escribí el nombre exacto de la planta para confirmar la eliminación." };
    const query = operation === "delete" ? supabase.from("user_plants").delete() : supabase.from("user_plants").update({ archived_at: operation === "archive" ? new Date().toISOString() : null });
    const { data, error } = await query.eq("id", id).eq("user_id", user.id).eq("version", version).select("id").maybeSingle();
    if (error) return mutationError(error.code);
    if (!data) return mutationError("40001");
    if (operation === "delete") cleanup = await flushStorageCleanup(supabase, user.id).catch(() => false);
  } catch { return mutationError(); }
  revalidatePath("/plants", "layout");
  redirect(operation === "delete" ? `/plants${cleanup ? "" : "?cleanup=pending"}` : `/plants/${id}`);
}

export async function retryPhotoCleanup(): Promise<FormState> {
  const user = await requireUser();
  try {
    const supabase = await createClient();
    const ok = await flushStorageCleanup(supabase, user.id);
    if (!ok) return { status: "error", message: "La limpieza sigue pendiente. Volvé a intentarlo en cinco minutos." };
    const { count, error } = await supabase.from("storage_cleanup").select("object_path", { head: true, count: "exact" }).eq("user_id", user.id);
    if (error) return mutationError();
    return { status: "success", message: count ? "Los archivos pendientes se reintentarán cuando venza su período de espera. Podés volver a ejecutar la limpieza más tarde." : "No quedan fotos pendientes de limpieza." };
  } catch { return mutationError(); }
}
