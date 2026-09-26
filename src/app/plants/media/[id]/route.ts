import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/session";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401, headers });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404, headers });
  const supabase = await createClient();
  const { data, error } = await supabase.from("media_assets").select("object_path").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return new NextResponse(null, { status: 503, headers });
  if (!data || typeof data.object_path !== "string" || !data.object_path.startsWith(`${user.id}/`)) return new NextResponse(null, { status: 404, headers });
  const result = await supabase.storage.from("plant-images").download(data.object_path);
  if (result.error) return new NextResponse(null, { status: 503, headers });
  return new NextResponse(result.data, { headers: { ...headers, "Content-Type": result.data.type || "image/webp", "Content-Disposition": "inline" } });
}
