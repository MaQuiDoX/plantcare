import { afterEach, describe, expect, it, vi } from "vitest";
import { authErrorMessage, emailSchema, loginSchema, registerSchema, resetSchema } from "@/features/auth/validation";
import { getAppUrl, getSupabaseConfig } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());
describe("validación de credenciales", () => {
  const valid = { name: "  Ana  ", email: " ana@example.com ", password: "mi jardín tiene hojas", confirmPassword: "mi jardín tiene hojas" };
  it("normaliza nombre/correo sin alterar la contraseña", () => {
    const data = registerSchema.parse(valid);
    expect(data.name).toBe("Ana"); expect(data.email).toBe("ana@example.com"); expect(data.password).toBe(valid.password);
  });
  it("rechaza contraseñas débiles y confirma coincidencia", () => {
    expect(registerSchema.safeParse({ ...valid, password: "corta", confirmPassword: "corta" }).success).toBe(false);
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "otra contraseña" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toContain("confirmPassword");
  });
  it("permite entrar con una contraseña anterior sin imponer la política de registro", () => {
    expect(loginSchema.safeParse({ email: "ana@example.com", password: "legacy" }).success).toBe(true);
  });
  it("rechaza entradas ausentes, correos inválidos y contraseñas excesivas", () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(emailSchema.safeParse({ email: "no-es-correo" }).success).toBe(false);
    expect(resetSchema.safeParse({ password: "a".repeat(129), confirmPassword: "a".repeat(129) }).success).toBe(false);
  });
  it("no devuelve mensajes internos del proveedor", () => {
    expect(authErrorMessage("internal_database_failure")).not.toContain("database");
    expect(authErrorMessage("invalid_credentials")).toContain("no son correctos");
  });
});
describe("configuración segura", () => {
  it("permite clave pública moderna y rechaza una secreta", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_testkey123456");
    expect(getSupabaseConfig()).not.toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_secret_testkey123456");
    expect(getSupabaseConfig()).toBeNull();
  });
  it("impide exponer claves JWT legacy y usar HTTP remoto", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "eyJhbGciOiJIUzI1NiJ9.e30.secret");
    expect(getSupabaseConfig()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_testkey123456");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://remote.example.com");
    expect(getSupabaseConfig()).toBeNull();
  });
  it("admite Supabase local y un origen de aplicación sin rutas", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_testkey123456");
    expect(getSupabaseConfig()).not.toBeNull();
    vi.stubEnv("APP_URL", "https://plantcare.example.com");
    expect(getAppUrl()).toBe("https://plantcare.example.com");
    vi.stubEnv("APP_URL", "https://plantcare.example.com/evil-path");
    expect(() => getAppUrl()).toThrow();
  });
});
