import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";

const analysisSchema = z.object({
  id: z.uuid(), user_plant_id: z.uuid().nullable(), media_asset_id: z.uuid().nullable(),
  kind: z.enum(["identification", "diagnosis"]), status: z.enum(["queued", "running", "succeeded", "failed"]),
  provider: z.string(), model: z.string(), schema_version: z.string(), result: z.unknown(),
  error_code: z.string().nullable(), observations: z.string().nullable(), created_at: z.string(), applied_at: z.string().nullable(),
});
const columns = "id,user_plant_id,media_asset_id,kind,status,provider,model,schema_version,result,error_code,observations,created_at,applied_at";
export async function getAnalysis(id: string) {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_analyses").select(columns).eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("No se pudo leer el análisis. Verificá la migración de Fase 4.");
  if (!data) notFound();
  const analysis = analysisSchema.parse(data);
  return { ...analysis, expired: Date.now() - new Date(analysis.created_at).getTime() > 300_000 };
}
export async function listAnalyses(page: number) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error, count } = await supabase.from("ai_analyses").select("id,kind,status,created_at", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).order("id").range((page - 1) * 12, page * 12 - 1);
  if (error) throw new Error("No se pudo leer el historial. Aplicá la migración de Fase 4.");
  return { entries: z.array(analysisSchema.pick({ id: true, kind: true, status: true, created_at: true })).parse(data), count: count ?? 0 };
}
