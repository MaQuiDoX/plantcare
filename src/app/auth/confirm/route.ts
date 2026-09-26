import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl, getSupabaseConfig } from "@/lib/env";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  let destination = "/auth/error";
  if (getSupabaseConfig() && token_hash && (type === "signup" || type === "recovery")) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ token_hash, type });
      if (!error) destination = type === "recovery" ? "/reset-password" : "/plants";
    } catch { destination = "/auth/error"; }
  }
  const response = NextResponse.redirect(new URL(destination, getAppUrl()), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
