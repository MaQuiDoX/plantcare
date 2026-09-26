"use client";
/* eslint-disable @next/next/no-img-element -- La imagen privada requiere las cookies del navegador; no pasa por el optimizador. */
import { useActionState, useState } from "react";
import Link from "next/link";
import { Camera, Save } from "lucide-react";
import { saveEntry, deleteEntry } from "./actions";
import { initialState } from "@/features/plants/validation";
import { kinds, MAX_PHOTO_BYTES } from "./validation";
import type { JournalEntry } from "./queries";

export function JournalForm({ id, plantId, today, entry }: { id: string; plantId: string; today: string; entry?: JournalEntry }) {
  const [state, action, pending] = useActionState(saveEntry, initialState);
  const [fileError, setFileError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({ entry_date: entry?.entry_date ?? today, kind: entry?.kind ?? "note", notes: entry?.notes ?? "", water_ml: entry?.water_ml?.toString() ?? "", height_cm: entry?.height_cm?.toString() ?? "" });
  const props = (name: string) => ({ id: name, name, value: values[name], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues({ ...values, [name]: e.target.value, ...(name === "kind" && e.target.value !== "watering" ? { water_ml: "" } : {}) }), "aria-invalid": Boolean(state.errors?.[name]), "aria-describedby": state.errors?.[name] ? `${name}-error` : undefined });
  const error = (name: string) => state.errors?.[name] && <span id={`${name}-error`} className="field-error">{state.errors[name]?.[0]}</span>;
  return <form action={action} className="editor-form" aria-busy={pending}><input type="hidden" name="id" value={id} /><input type="hidden" name="user_plant_id" value={plantId} /><input type="hidden" name="version" value={entry?.version ?? ""} />
    {state.message && <p className="error-box" role="alert">{state.message} Si adjuntaste una foto, volvé a seleccionarla.</p>}
    <fieldset disabled={pending}><section className="editor-section"><h2>Un momento en su historia</h2><div className="form-grid">
      <div className="field"><label htmlFor="entry_date">Fecha *</label><input {...props("entry_date")} type="date" required max={today} />{error("entry_date")}</div>
      <div className="field"><label htmlFor="kind">Tipo de registro *</label><select {...props("kind")}>{Object.entries(kinds).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
      <div className="field full-width"><label htmlFor="notes">¿Qué observaste?</label><textarea {...props("notes")} rows={6} maxLength={10000} />{error("notes")}</div>
      {values.kind === "watering" ? <div className="field"><label htmlFor="water_ml">Agua utilizada (ml)</label><input {...props("water_ml")} type="number" min="1" max="1000000" step="1" />{error("water_ml")}</div> : <input type="hidden" name="water_ml" value="" />}
      <div className="field"><label htmlFor="height_cm">Altura de la planta (cm)</label><input {...props("height_cm")} type="number" min="0.01" max="99999" step="0.01" />{error("height_cm")}</div>
    </div></section>
    <section className="editor-section"><h2><Camera size={19} /> Su evolución, en una foto</h2><p>Una foto por registro. Podés crear varias entradas para un mismo día.</p>
      {entry?.media_assets.map((media) => <div className="existing-photo" key={media.id}><img src={`/plants/media/${media.id}`} alt="Foto actual de esta entrada" /><label className="checkbox-label"><input type="checkbox" name="remove_photo" /> Quitar la foto actual</label></div>)}
      <div className="field"><label htmlFor="photo">{entry?.media_assets.length ? "Reemplazar foto" : "Adjuntar foto"}</label><input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help" onChange={(e) => { const file = e.target.files?.[0]; if (file && file.size > MAX_PHOTO_BYTES) { e.target.value = ""; setFileError("La foto debe pesar como máximo 3 MiB."); } else setFileError(""); }} /><span id="photo-help" className="field-hint">JPEG, PNG o WebP · Hasta 3 MiB · Se guarda de forma privada.</span>{fileError && <span role="alert" className="field-error">{fileError}</span>}</div>
    </section><div className="editor-footer"><Link href={`/plants/${plantId}#diario`} className="button button-secondary">Cancelar</Link><button type="submit" className="button button-primary"><Save size={17} />{pending ? "Guardando…" : entry ? "Guardar entrada" : "Agregar al diario"}</button></div></fieldset>
  </form>;
}
export function DeleteEntryForm({ entry }: { entry: JournalEntry }) {
  const [state, action, pending] = useActionState(deleteEntry, initialState);
  return <details className="danger-zone"><summary>Eliminar esta entrada</summary><p>Se borrarán el registro y sus fotos. Esta acción no se puede deshacer.</p><form action={action}><input type="hidden" name="id" value={entry.id} /><input type="hidden" name="user_plant_id" value={entry.user_plant_id} /><input type="hidden" name="version" value={entry.version} /><div className="field"><label htmlFor="delete-entry-confirm">Escribí ELIMINAR para confirmar</label><input id="delete-entry-confirm" name="confirmation" required autoComplete="off" /></div><button className="button button-danger" disabled={pending}>{pending ? "Eliminando…" : "Eliminar entrada definitivamente"}</button>{state.message && <p role="alert" className="error-box">{state.message}</p>}</form></details>;
}
