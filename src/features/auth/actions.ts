"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl, getSupabaseConfig } from "@/lib/env";
import { authErrorMessage, emailSchema, loginSchema, registerSchema, resetSchema, type AuthState } from "./validation";

const unavailable: AuthState = { status: "error", message: "La conexión con Supabase todavía no está configurada." };
const failed: AuthState = { status: "error", message: "No pudimos conectar con el servicio. Intentá nuevamente." };
const invalid = (error: z.ZodError): AuthState => ({ status: "error", message: "Revisá los campos indicados.", errors: z.flattenError(error).fieldErrors });

export async function login(_previous: AuthState, form: FormData): Promise<AuthState> {
  const input = loginSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  if (!getSupabaseConfig()) return unavailable;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(input.data);
    if (error) return { status: "error", message: authErrorMessage(error.code) };
  } catch { return failed; }
  revalidatePath("/", "layout");
  redirect("/plants");
}

export async function register(_previous: AuthState, form: FormData): Promise<AuthState> {
  const input = registerSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  if (!getSupabaseConfig()) return unavailable;
  let hasSession = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.data.email,
      password: input.data.password,
      options: { data: { display_name: input.data.name }, emailRedirectTo: `${getAppUrl()}/auth/confirm` },
    });
    if (error && error.code !== "user_already_exists") return { status: "error", message: authErrorMessage(error.code) };
    hasSession = Boolean(data.session);
  } catch { return failed; }
  if (hasSession) {
    revalidatePath("/", "layout");
    redirect("/plants");
  }
  return { status: "success", message: "Revisá tu correo para confirmar la cuenta. Si ya tenés una cuenta, podés iniciar sesión o recuperar tu contraseña." };
}

export async function forgotPassword(_previous: AuthState, form: FormData): Promise<AuthState> {
  const input = emailSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  if (!getSupabaseConfig()) return unavailable;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(input.data.email, { redirectTo: `${getAppUrl()}/auth/confirm` });
    if (error) return { status: "error", message: authErrorMessage(error.code) };
  } catch { return failed; }
  return { status: "success", message: "Si el correo corresponde a una cuenta, recibirás un enlace para cambiar tu contraseña." };
}

export async function resendConfirmation(_previous: AuthState, form: FormData): Promise<AuthState> {
  const input = emailSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  if (!getSupabaseConfig()) return unavailable;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email: input.data.email, options: { emailRedirectTo: `${getAppUrl()}/auth/confirm` } });
    if (error && ["over_email_send_rate_limit", "over_request_rate_limit"].includes(error.code ?? "")) {
      return { status: "error", message: authErrorMessage(error.code) };
    }
  } catch { return failed; }
  return { status: "success", message: "Si la cuenta está pendiente de confirmación, recibirás un nuevo enlace por correo." };
}

export async function resetPassword(_previous: AuthState, form: FormData): Promise<AuthState> {
  const input = resetSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return invalid(input.error);
  if (!getSupabaseConfig()) return unavailable;
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { status: "error", message: "El enlace venció. Solicitá uno nuevo para recuperar tu cuenta." };
    const { error } = await supabase.auth.updateUser({ password: input.data.password });
    if (error) return { status: "error", message: authErrorMessage(error.code) };
  } catch { return failed; }
  revalidatePath("/", "layout");
  return { status: "success", message: "Tu contraseña se actualizó. Ya podés volver a Mis Plantas." };
}

export async function logout(): Promise<AuthState> {
  if (!getSupabaseConfig()) return unavailable;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { status: "error", message: "No pudimos cerrar la sesión. Volvé a intentarlo." };
  } catch { return failed; }
  revalidatePath("/", "layout");
  redirect("/login");
}
