import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/env";

export function getAIConfig() {
  const supabase = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  const plantnetKey = process.env.PLANTNET_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim();
  if (!supabase || !secret?.startsWith("sb_secret_") || !plantnetKey || !geminiKey || !model || !/^gemini-[a-zA-Z0-9.-]+$/.test(model)) return null;
  return { url: supabase.url, secret, plantnetKey, geminiKey, model };
}
export type AIConfig = NonNullable<ReturnType<typeof getAIConfig>>;
export function createAIAdmin(config: AIConfig) {
  return createClient(config.url, config.secret, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
}
