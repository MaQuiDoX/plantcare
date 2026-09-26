import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), getAIConfig: vi.fn(), admin: vi.fn(), rpc: vi.fn(),
  upload: vi.fn(), from: vi.fn(), cleanup: vi.fn(), identify: vi.fn(), diagnose: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/ai/config", () => ({ getAIConfig: mocks.getAIConfig, createAIAdmin: mocks.admin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mocks.from, storage: { from: () => ({ upload: mocks.upload }) } }) }));
vi.mock("@/features/journal/storage", () => ({ flushStorageCleanup: mocks.cleanup }));
vi.mock("@/features/ai/providers", async (original) => ({ ...await original<typeof import("@/features/ai/providers")>(), identifyPlant: mocks.identify, diagnosePlant: mocks.diagnose }));
import sharp from "sharp";
import { startAnalysis } from "@/features/ai/actions";
import { AIError } from "@/features/ai/providers";

const user = "a7157311-ace0-4a59-9400-000000000001";
const id = "c7157311-ace0-4a59-9400-000000000001";
const result = { kind: "identification", candidates: [{ name: "Monstera deliciosa", commonNames: [], family: "Araceae", score: 0.8, care: null }], careWarning: "rate_limit", plantnetVersion: "test" };
async function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ id, kind: "identification", plant: "", observations: "", consent: "on" })) data.set(key, value);
  const png = await sharp({ create: { width: 5, height: 5, channels: 3, background: "green" } }).png().toBuffer();
  data.set("photo", new File([new Uint8Array(png)], "plant.png", { type: "image/png" }));
  return data;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({ id: user });
  mocks.getAIConfig.mockReturnValue({ model: "test-model" });
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.rpc.mockResolvedValueOnce({ data: { id, path: `${user}/photo.webp`, started: true }, error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.identify.mockResolvedValue(result);
  mocks.cleanup.mockResolvedValue(true);
  mocks.redirect.mockImplementation((url) => { throw new Error(`REDIRECT:${url}`); });
});
describe("frontera autenticada de análisis", () => {
  it("rechaza llamadas sin sesión antes de acceder a credenciales administrativas", async () => {
    mocks.requireUser.mockRejectedValue(new Error("UNAUTHENTICATED"));
    await expect(startAnalysis({ status: "idle" }, await form())).rejects.toThrow("UNAUTHENTICATED");
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.identify).not.toHaveBeenCalled();
  });
  it("sin claves no envía imágenes ni consume cupo", async () => {
    mocks.getAIConfig.mockReturnValue(null);
    expect(await startAnalysis({ status: "idle" }, await form())).toMatchObject({ status: "error" });
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("exige consentimiento también en el servidor", async () => {
    const data = await form(); data.delete("consent");
    expect(await startAnalysis({ status: "idle" }, data)).toMatchObject({ status: "error" });
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rechaza una planta inaccesible antes de consumir cupo", async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    mocks.from.mockReturnValue(query);
    const data = await form(); data.set("plant", "b7157311-ace0-4a59-9400-000000000001");
    expect(await startAnalysis({ status: "idle" }, data)).toMatchObject({ status: "error" });
    expect(query.eq).toHaveBeenCalledWith("user_id", user);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("no reenvía a proveedores ni sube otra foto cuando la reserva ya existe", async () => {
    mocks.rpc.mockReset().mockResolvedValue({ data: { id, path: `${user}/photo.webp`, started: false }, error: null });
    await expect(startAnalysis({ status: "idle" }, await form())).rejects.toThrow(`REDIRECT:/plants/analyses/${id}`);
    expect(mocks.identify).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("normaliza, analiza y persiste el resultado validado antes de redirigir", async () => {
    await expect(startAnalysis({ status: "idle" }, await form())).rejects.toThrow(`REDIRECT:/plants/analyses/${id}`);
    expect(mocks.upload).toHaveBeenCalledWith(`${user}/photo.webp`, expect.any(Buffer), { contentType: "image/webp", upsert: false });
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_ai_analysis", expect.objectContaining({ p_user: user, p_id: id, p_result: result, p_error: null }));
  });
  it("guarda un fallo seguro y limpia la imagen sin reintentar el proveedor", async () => {
    mocks.identify.mockRejectedValue(new AIError("timeout"));
    await expect(startAnalysis({ status: "idle" }, await form())).rejects.toThrow(`REDIRECT:/plants/analyses/${id}`);
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_ai_analysis", expect.objectContaining({ p_result: null, p_error: "timeout" }));
    expect(mocks.cleanup).toHaveBeenCalled();
    expect(mocks.identify).toHaveBeenCalledTimes(1);
  });
  it("ante confirmación incierta pide consultar el historial sin duplicar la consulta", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "NETWORK" }, data: null });
    expect(await startAnalysis({ status: "idle" }, await form())).toMatchObject({ status: "error", message: expect.stringContaining("historial") });
    expect(mocks.identify).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
