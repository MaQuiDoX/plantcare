"use client";
import { useActionState } from "react";
import { LogOut } from "lucide-react";
import { logout } from "./actions";
import { initialAuthState } from "./validation";
import { removePush } from "@/features/notifications/actions";

export function LogoutButton() {
  const [state, action, pending] = useActionState(async () => {
    try {
      await Promise.race([(async () => {
        const registration = await navigator.serviceWorker?.getRegistration("/");
        const subscription = await registration?.pushManager?.getSubscription();
        if (subscription) { await subscription.unsubscribe(); await removePush(subscription.endpoint); }
        for (const notice of await registration?.getNotifications() ?? []) notice.close();
      })(), new Promise(resolve => setTimeout(resolve, 2000))]);
    } catch { /* La salida de sesión sigue disponible aunque el navegador no admita push. */ }
    return logout();
  }, initialAuthState);
  return <form action={action}>
    <button className="logout-button" disabled={pending}><LogOut size={17} />{pending ? "Cerrando…" : "Cerrar sesión"}</button>
    {state.message && <p className="field-error" role="alert">{state.message}</p>}
  </form>;
}
