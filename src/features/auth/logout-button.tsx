"use client";
import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { logout } from "./actions";
import { initialAuthState } from "./validation";

export function LogoutButton() {
  const [state, action, pending] = useActionState(logout, initialAuthState);
  return <form action={action}>
    <button className="logout-button" disabled={pending}><LogOut size={17} />{pending ? "Cerrando…" : "Cerrar sesión"}</button>
    {state.message && <p className="field-error" role="alert">{state.message}</p>}
  </form>;
}
