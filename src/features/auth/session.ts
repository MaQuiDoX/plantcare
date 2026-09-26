import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/env";

export const getCurrentUser = cache(async () => {
  if (!getSupabaseConfig()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error && error.status && error.status >= 500) throw new Error("El servicio de autenticación no está disponible.");
  return error ? null : data.user;
});

export async function requireUser() {
  if (!getSupabaseConfig()) redirect("/setup");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
