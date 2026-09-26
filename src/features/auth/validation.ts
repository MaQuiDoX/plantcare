import { z } from "zod";

const email = z.string().trim().pipe(z.email("Ingresá un correo válido.").max(254, "El correo es demasiado largo."));
const password = z.string().min(12, "Usá al menos 12 caracteres.").max(128, "Usá como máximo 128 caracteres.");
export const loginSchema = z.object({ email, password: z.string().min(1, "Ingresá tu contraseña.").max(128) });
export const emailSchema = z.object({ email });
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Ingresá tu nombre.").max(100, "Usá como máximo 100 caracteres."),
  email,
  password,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Las contraseñas no coinciden." });
export const resetSchema = z.object({ password, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Las contraseñas no coinciden." });

export type AuthState = { status: "idle" | "error" | "success"; message?: string; errors?: Record<string, string[] | undefined> };
export const initialAuthState: AuthState = { status: "idle" };

export function authErrorMessage(code?: string): string {
  switch (code) {
    case "invalid_credentials": return "El correo o la contraseña no son correctos.";
    case "email_not_confirmed": return "Confirmá tu correo antes de ingresar. Podés solicitar un nuevo enlace abajo.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit": return "Hubo demasiados intentos. Esperá unos minutos y volvé a probar.";
    case "weak_password": return "Elegí una contraseña más segura, de al menos 12 caracteres.";
    case "same_password": return "Elegí una contraseña diferente a la actual.";
    default: return "No pudimos completar la solicitud. Intentá nuevamente en unos minutos.";
  }
}
