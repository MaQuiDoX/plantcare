import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/features/auth/session";
import { notFound } from "next/navigation";

const plantCardSchema = z.object({
  id: z.uuid(), nickname: z.string(), location_label: z.string().nullable(),
  placement: z.enum(["indoor", "outdoor", "sheltered"]),
  created_at: z.string(), plants: z.object({ scientific_name: z.string() }).nullable(),
  species_label: z.string().nullable(),
});
export type PlantCard = z.infer<typeof plantCardSchema>;
export const PAGE_SIZE = 12;

export async function getPlantDashboard(search: string, page: number, archived = false) {
  const user = await requireUser();
  const supabase = await createClient();
  let listing = supabase.from("user_plants")
    .select("id,nickname,species_label,location_label,placement,created_at,plants(scientific_name)", { count: "exact" })
    .eq("user_id", user.id);
  listing = archived ? listing.not("archived_at", "is", null) : listing.is("archived_at", null);
  if (search) listing = listing.ilike("nickname", `%${search.replace(/[\\%_]/g, "\\$&")}%`);
  const [list, all, indoor, profile] = await Promise.all([
    listing.order("created_at", { ascending: false }).order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from("user_plants").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("archived_at", null),
    supabase.from("user_plants").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("archived_at", null).eq("placement", "indoor"),
    supabase.from("users").select("display_name").eq("id", user.id).single(),
  ]);
  if (list.error || all.error || indoor.error || profile.error) throw new Error("No se pudo leer el catálogo. Verificá las migraciones y la conexión.");
  return {
    plants: z.array(plantCardSchema).parse(list.data),
    total: all.count ?? 0,
    indoor: indoor.count ?? 0,
    matching: list.count ?? 0,
    name: z.object({ display_name: z.string() }).parse(profile.data).display_name,
  };
}

export const plantDetailSchema = plantCardSchema.extend({
  plant_id: z.uuid().nullable(), acquired_on: z.string().nullable(), archived_at: z.string().nullable(),
  light: z.enum(["low", "indirect", "direct"]).nullable(),
  pot_diameter_cm: z.number().nullable(), pot_height_cm: z.number().nullable(),
  pot_material: z.enum(["plastic", "terracotta", "ceramic", "other"]).nullable(),
  has_drainage: z.boolean().nullable(), substrate_notes: z.string().nullable(), version: z.number().int(),
  ai_profile: z.unknown().optional(),
});
export type PlantDetail = z.infer<typeof plantDetailSchema>;

export async function getPlantDetail(id: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("user_plants").select("id,nickname,species_label,location_label,placement,created_at,plants(scientific_name),plant_id,acquired_on,archived_at,light,pot_diameter_cm,pot_height_cm,pot_material,has_drainage,substrate_notes,version,ai_profile").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("No se pudo leer la planta.");
  if (!data) notFound();
  return plantDetailSchema.parse(data);
}

export async function getSpeciesOptions() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("plants").select("id,scientific_name").order("scientific_name").limit(500);
  if (error) throw new Error("No se pudo leer el catálogo de especies.");
  return z.array(z.object({ id: z.uuid(), scientific_name: z.string() })).parse(data);
}
