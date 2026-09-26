"use client";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { startAnalysis, applyIdentification } from "./actions";
import { initialState } from "@/features/plants/validation";

export function AnalysisForm({ id, kind, plant }: { id: string; kind: "identification" | "diagnosis"; plant: string }) {
  const [state, action, pending] = useActionState(startAnalysis, initialState);
  return <form action={action} className="editor-form" aria-busy={pending}>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="plant" value={plant} />
    {state.message && <p className="error-box" role="alert">{state.message}</p>}
    <fieldset disabled={pending}><section className="editor-section"><div className="field"><label htmlFor="photo">Foto de la planta</label><input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /><p className="field-hint">JPEG, PNG o WebP estático, hasta 3 MiB y 40 megapíxeles. Usá luz natural y enfocá una sola planta; para revisar salud, acercá la zona afectada.</p></div>
      {kind === "diagnosis" ? <div className="field"><label htmlFor="observations">¿Qué cambios observaste?</label><textarea id="observations" name="observations" maxLength={2000} rows={4} /><p className="field-hint">Contá desde cuándo ocurre, cómo regás y cuánta luz recibe.</p></div> : <input type="hidden" name="observations" value="" />}
      <label className="ai-consent"><input type="checkbox" name="consent" required />Acepto enviar {kind === "identification" ? "esta foto a Pl@ntNet y los nombres de las especies candidatas a Google Gemini" : "esta foto, la especie anotada y mis observaciones a Google Gemini"} para obtener orientación. Evitaré incluir personas o datos personales.</label>
      <p className="field-hint">Se eliminan los metadatos de la foto antes del envío. Los proveedores procesan los datos bajo sus propias condiciones. Cada cuenta puede iniciar hasta 5 análisis cada 24 horas, incluidos los intentos fallidos.</p>
    </section><button className="button button-primary" type="submit">{pending ? "Analizando foto…" : "Analizar foto"}</button></fieldset>
    <p role="status" aria-live="polite">{pending ? "Puede tardar hasta un minuto. No hace falta volver a enviar la foto." : "La especie y los cuidados solo se guardan en tu ficha cuando los confirmás."}</p>
  </form>;
}

export function AcceptCandidate({ id, choice, version, nickname }: { id: string; choice: number; version?: number; nickname: string }) {
  const [state, action, pending] = useActionState(applyIdentification, initialState);
  return <form action={action} aria-busy={pending} className="ai-accept">
    <input name="id" type="hidden" value={id} /><input name="choice" type="hidden" value={choice} /><input name="version" type="hidden" value={version ?? ""} />
    {version ? <input name="nickname" type="hidden" value="" /> : <div className="field"><label htmlFor={`nickname-${choice}`}>Nombre para tu nueva planta</label><input id={`nickname-${choice}`} name="nickname" required maxLength={100} defaultValue={nickname.slice(0, 100)} disabled={pending} /></div>}
    {state.message && <p className="error-box" role="alert">{state.message}</p>}
    <button type="submit" className="button button-primary" disabled={pending}>{pending ? "Guardando…" : version ? "Confirmar esta especie" : "Crear planta con esta especie"}</button>
  </form>;
}
export function RefreshAnalysis() {
  const router = useRouter();
  return <button type="button" className="button button-secondary" onClick={() => router.refresh()}>Actualizar estado</button>;
}
