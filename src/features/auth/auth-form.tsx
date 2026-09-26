"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { forgotPassword, login, register, resendConfirmation, resetPassword } from "./actions";
import { initialAuthState } from "./validation";

type Mode = "login" | "register" | "forgot" | "reset" | "resend";
const actions = { login, register, forgot: forgotPassword, reset: resetPassword, resend: resendConfirmation };
const labels: Record<Mode, string> = { login: "Ingresar a mi jardín", register: "Crear mi cuenta", forgot: "Enviar enlace", reset: "Guardar contraseña", resend: "Reenviar confirmación" };

export function AuthForm({ mode, configured }: { mode: Mode; configured: boolean }) {
  const [state, action, pending] = useActionState(actions[mode], initialAuthState);
  const [visible, setVisible] = useState(false);
  const hasPassword = ["login", "register", "reset"].includes(mode);
  const newPassword = mode === "register" || mode === "reset";
  function errorFor(name: string) {
    const message = state.errors?.[name]?.[0];
    return message ? <span className="field-error" id={`${mode}-${name}-error`}>{message}</span> : null;
  }
  const fieldProps = (name: string) => ({ "aria-invalid": Boolean(state.errors?.[name]), "aria-describedby": state.errors?.[name] ? `${mode}-${name}-error` : undefined });

  if (state.status === "success") return <div className="success-box" role="status">
    <CheckCircle2 size={28} /><p>{state.message}</p>
    <Link className="text-link" href={mode === "reset" ? "/plants" : "/login"}>{mode === "reset" ? "Volver a Mis Plantas" : "Ir a iniciar sesión"} <ArrowRight size={16} /></Link>
  </div>;

  return <form action={action} className="auth-form" aria-busy={pending}>
    {!configured && <p className="notice">Falta conectar la aplicación. <Link href="/setup">Ver instrucciones de configuración</Link>.</p>}
    {state.message && <p className="error-box" role="alert">{state.message}</p>}
    <fieldset disabled={pending || !configured}>
      {mode === "register" && <div className="field">
        <label htmlFor={`${mode}-name`}>Tu nombre</label>
        <input id={`${mode}-name`} name="name" autoComplete="given-name" required maxLength={100} {...fieldProps("name")} />
        {errorFor("name")}
      </div>}
      {mode !== "reset" && <div className="field">
        <label htmlFor={`${mode}-email`}>Correo electrónico</label>
        <input id={`${mode}-email`} name="email" type="email" autoComplete="email" required maxLength={254} spellCheck={false} autoCapitalize="none" {...fieldProps("email")} />
        {errorFor("email")}
      </div>}
      {hasPassword && <div className="field">
        <div className="field-heading"><label htmlFor={`${mode}-password`}>{newPassword ? "Nueva contraseña" : "Contraseña"}</label>
          {mode === "login" && <Link href="/forgot-password">¿La olvidaste?</Link>}
        </div>
        <div className="password-field">
          <input id={`${mode}-password`} name="password" type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"} required minLength={newPassword ? 12 : 1} maxLength={128} {...fieldProps("password")} />
          <button type="button" className="password-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </div>
        {newPassword && <span className="field-hint">Al menos 12 caracteres. Podés usar una frase fácil de recordar.</span>}
        {errorFor("password")}
      </div>}
      {newPassword && <div className="field">
        <label htmlFor={`${mode}-confirmPassword`}>Repetí la contraseña</label>
        <input id={`${mode}-confirmPassword`} name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" required minLength={12} maxLength={128} {...fieldProps("confirmPassword")} />
        {errorFor("confirmPassword")}
      </div>}
      <button type="submit" className="button button-primary button-full">{pending ? <><LoaderCircle size={18} className="spin" /> Un momento…</> : <>{labels[mode]} <ArrowRight size={18} /></>}</button>
    </fieldset>
  </form>;
}
