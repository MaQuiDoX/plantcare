import "server-only";
import { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
export async function flushStorageCleanup(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("claim_storage_cleanup");
  if (error || !data) return false;
  for (const row of data) {
    if (typeof row.object_path !== "string" || !row.object_path.startsWith(`${userId}/`)) return false;
    const { error: removeError } = await supabase.storage.from("plant-images").remove([row.object_path]);
    if (removeError) return false;
    const { error: queueError } = await supabase.from("storage_cleanup").delete().eq("object_path", row.object_path).eq("user_id", userId);
    if (queueError) return false;
  }
  return true;
}
