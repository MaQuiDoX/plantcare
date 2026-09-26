"use client";
import { useActionState } from "react";
import { changePlantStatus, retryPhotoCleanup } from "./actions";
import { initialState } from "./validation";

export function PlantControls({ id, nickname, version, archived }: { id: string; nickname: string; version: number; archived: boolean }) {
  const [state, action, pending] = useActionState(changePlantStatus, initialState);
  return <details className="danger-zone"><summary>Administrar esta planta</summary>
    <p>{archived ? "Restaurala para volver a registrar su evolución." : "Archivar conserva la ficha, las fotos y el diario. Podés restaurarla cuando quieras."}</p>
    <form action={action}><input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={version} /><button className="button button-secondary" name="operation" value={archived ? "restore" : "archive"} disabled={pending}>{archived ? "Restaurar planta" : "Archivar planta"}</button></form>
    <form action={action} className="delete-form"><input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={version} /><input type="hidden" name="operation" value="delete" /><p>Eliminar borra definitivamente esta planta, su diario y sus fotos.</p><div className="field"><label htmlFor="delete-plant-confirm">Escribí «{nickname}» para confirmar</label><input id="delete-plant-confirm" name="confirmation" required autoComplete="off" /></div><button className="button button-danger" disabled={pending}>{pending ? "Procesando…" : "Eliminar planta definitivamente"}</button></form>
    {state.message && <p className="error-box" role="alert">{state.message}</p>}
  </details>;
}
export function CleanupControl({ warning = false }: { warning?: boolean }) {
  const [state, action, pending] = useActionState(retryPhotoCleanup, initialState);
  return <details className="cleanup-control" open={warning || undefined}><summary>Limpieza de fotos pendientes</summary><p>Reintentá la limpieza si se interrumpió una subida o un borrado. Las subidas incompletas se conservan hasta 24 horas para permitir su finalización.</p><form action={action}><button className="button button-secondary" disabled={pending}>{pending ? "Reintentando…" : "Reintentar limpieza"}</button></form>{state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}</details>;
}
