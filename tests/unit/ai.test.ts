import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { identifyPlant, diagnosePlant } from "@/features/ai/providers";
import { diagnosisSchema } from "@/features/ai/schemas";

const config = { url: "https://example.supabase.co", secret: "sb_secret_test", plantnetKey: "plantnet-test", geminiKey: "gemini-test", model: "gemini-3.8-flash" };
const care = { lighting: "Luz indirecta.", location: "Interior luminoso.", temperature: "Evitar frío intenso.", watering: "Comprobar humedad antes de regar.", substrate: "Sustrato aireado con drenaje." };
const plantnet = { version: "test-v1", results: [{ score: 0.8, species: { scientificNameWithoutAuthor: "Monstera deliciosa", commonNames: ["Costilla de Adán"], family: { scientificNameWithoutAuthor: "Araceae" } } }] };
const diagnosis = { assessable: true, summary: "Amarilleo visible, causa no confirmada.", hypotheses: [{ cause: "Exceso de agua posible", category: "watering", evidence: ["Hoja amarilla"], uncertainty: "No se ve la raíz." }], firstSteps: ["Comprobar humedad."], checks: ["Revisar drenaje."], consultWhen: "Si continúa el deterioro, consultar a un especialista." };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const gemini = (value: unknown) => json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }] });
async function photo() { return sharp({ create: { width: 32, height: 24, channels: 3, background: "green" } }).webp().toBuffer(); }

describe("proveedores de IA sin llamadas externas", () => {
  it("convierte WebP a JPEG para Pl@ntNet y asocia cuidados a la especie exacta", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(plantnet)).mockResolvedValueOnce(gemini({ species: [{ name: "Monstera deliciosa", care }] }));
    const result = await identifyPlant(await photo(), config, transport);
    expect(result).toMatchObject({ kind: "identification", careWarning: null, candidates: [{ name: "Monstera deliciosa", care, score: 0.8 }] });
    const form = transport.mock.calls[0][1]!.body as FormData;
    const file = form.get("images") as File;
    expect(file.type).toBe("image/jpeg");
    expect((await sharp(Buffer.from(await file.arrayBuffer())).metadata()).format).toBe("jpeg");
    const geminiBody = JSON.parse(transport.mock.calls[1][1]!.body as string);
    expect(geminiBody.generationConfig.responseFormat.text.mimeType).toBe("application/json");
    expect(geminiBody.contents[0].parts).toHaveLength(1);
    expect(transport.mock.calls[0][1]!.redirect).toBe("error");
  });
  it("conserva la identificación si Gemini falla y no inventa una ficha", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(plantnet)).mockResolvedValueOnce(new Response("private provider error", { status: 429 }));
    expect(await identifyPlant(await photo(), config, transport)).toMatchObject({ careWarning: "rate_limit", candidates: [{ care: null }] });
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it("rechaza cuidados para una especie distinta", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValueOnce(json(plantnet)).mockResolvedValueOnce(gemini({ species: [{ name: "Otra especie", care }] }));
    expect(await identifyPlant(await photo(), config, transport)).toMatchObject({ careWarning: "invalid_response", candidates: [{ care: null }] });
  });
  it("detecta imagen sin planta sin llamar al segundo proveedor", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(json({ results: [] }));
    await expect(identifyPlant(await photo(), config, transport)).rejects.toMatchObject({ code: "no_plant" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("envía diagnóstico con foto y contexto, valida el resultado", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(gemini(diagnosis));
    expect(await diagnosePlant(await photo(), { species: null, observations: "hojas amarillas" }, config, transport)).toEqual({ kind: "diagnosis", diagnosis });
    const body = JSON.parse(transport.mock.calls[0][1]!.body as string);
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe("image/webp");
    expect(transport.mock.calls[0][0]).not.toContain(config.geminiKey);
  });
  it.each([401, 403, 404, 429, 500])("no filtra respuestas ni secretos ante HTTP %i", async (status) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response("secret-key", { status }));
    await expect(diagnosePlant(await photo(), { species: null, observations: "" }, config, transport)).rejects.toMatchObject({ code: status === 429 ? "rate_limit" : status === 500 ? "unavailable" : "provider_auth" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("clasifica timeout sin reintento automático", async () => {
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    await expect(diagnosePlant(await photo(), { species: null, observations: "" }, config, transport)).rejects.toMatchObject({ code: "timeout" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it.each([
    { candidates: [{ finishReason: "MAX_TOKENS" }] },
    { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "```json invalid```" }] } }] },
    { candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify({ ...diagnosis, assessable: false }) }] } }] },
  ])("rechaza respuestas incompletas o contradictorias", async (value) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(json(value));
    await expect(diagnosePlant(await photo(), { species: null, observations: "" }, config, transport)).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("limita el tamaño de la respuesta", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response("x".repeat(130 * 1024)));
    await expect(diagnosePlant(await photo(), { species: null, observations: "" }, config, transport)).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("admite una imagen no evaluable con pasos para repetir la foto", () => {
    expect(diagnosisSchema.safeParse({ ...diagnosis, assessable: false, hypotheses: [] }).success).toBe(true);
  });
});
