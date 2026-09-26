import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/features/auth/session";

export const journalRowSchema = z.object({
  id: z.uuid(), user_plant_id: z.uuid(), entry_date: z.string(),
  kind: z.enum(["note", "watering", "fertilizing", "repotting", "inspection", "pruning"]),
  notes: z.string(), water_ml: z.number().nullable(), height_cm: z.number().nullable(), version: z.number().int(),
  media_assets: z.array(z.object({ id: z.uuid(), object_path: z.string() })),
});
export type JournalEntry = z.infer<typeof journalRowSchema>;
const fields = "id,user_plant_id,entry_date,kind,notes,water_ml,height_cm,version,media_assets(id,object_path)";
export const JOURNAL_PAGE_SIZE = 12;
export async function getJournal(plantId: string, page: number) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, count, error } = await supabase.from("journal_entries").select(fields, { count: "exact" }).eq("user_id", user.id).eq("user_plant_id", plantId).order("entry_date", { ascending: false }).order("created_at", { ascending: false }).order("id").range((page - 1) * JOURNAL_PAGE_SIZE, page * JOURNAL_PAGE_SIZE - 1);
  if (error) throw new Error("No se pudo cargar el diario.");
  return { entries: z.array(journalRowSchema).parse(data), count: count ?? 0 };
}
export async function getEntry(plantId: string, id: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("journal_entries").select(fields).eq("id", id).eq("user_plant_id", plantId).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("No se pudo cargar la entrada.");
  if (!data) notFound();
  return journalRowSchema.parse(data);
}
export async function getTimezone() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("users").select("timezone").eq("id", user.id).single();
  if (error) throw new Error("No se pudo leer la zona horaria.");
  return z.object({ timezone: z.string() }).parse(data).timezone;
}
