import "server-only";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/env";

export function getWeatherConfig() {
  const supabase = getSupabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  const key = process.env.OPENWEATHER_API_KEY?.trim();
  return supabase && secret?.startsWith("sb_secret_") && key ? { url: supabase.url, secret, key } : null;
}
export function weatherAdmin(config: NonNullable<ReturnType<typeof getWeatherConfig>>) {
  return createClient(config.url, config.secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
export class WeatherError extends Error { constructor(public code: string) { super(code); } }
export async function fetchWeather(latitude: number, longitude: number, key: string, now: Date, transport: typeof fetch = fetch) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) throw new WeatherError("invalid");
  const query = new URLSearchParams({ lat: String(latitude), lon: String(longitude), appid: key, units: "metric", lang: "es" });
  try {
    const response = await transport(`https://api.openweathermap.org/data/2.5/weather?${query}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      await response.body?.cancel();
      throw new WeatherError(response.status === 401 || response.status === 403 ? "auth" : response.status === 429 ? "quota" : "unavailable");
    }
    if (!response.body) throw new WeatherError("invalid");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let bytes=0;
    try { while (true) { const { done, value } = await reader.read(); if (done) break; bytes+=value.length; if (bytes>32768) throw new WeatherError("invalid"); chunks.push(value); } }
    finally { await reader.cancel().catch(() => undefined); }
    const payload = z.object({ cod: z.union([z.literal(200), z.literal("200")]), dt: z.number().int().positive(), main: z.object({ temp: z.number().min(-90).max(65), humidity: z.number().int().min(0).max(100) }), rain: z.object({ "1h": z.number().min(0).max(1000).optional() }).optional() }).parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (payload.dt*1000 < now.getTime()-3*3600_000 || payload.dt*1000>now.getTime()+300_000) throw new WeatherError("stale");
    return { temperature: payload.main.temp, humidity: payload.main.humidity, rain: payload.rain?.["1h"] ?? 0, observedAt: new Date(payload.dt*1000).toISOString() };
  } catch (error) {
    if (error instanceof WeatherError) throw error;
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new WeatherError("timeout");
    throw new WeatherError(error instanceof z.ZodError || error instanceof SyntaxError ? "invalid" : "unavailable");
  }
}
