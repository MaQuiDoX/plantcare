"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { savePlant } from "./actions";
import { initialState, placements, lights, materials } from "./validation";
import type { PlantDetail } from "./queries";

export function PlantForm({ id, plant, species }: { id: string; plant?: PlantDetail; species: { id: string; scientific_name: string }[] }) {
  const [state, action, pending] = useActionState(savePlant, initialState);
  const [values, setValues] = useState<Record<string, string>>({
    nickname: plant?.nickname ?? "", species_label: plant?.species_label ?? "", plant_id: plant?.plant_id ?? "",
    acquired_on: plant?.acquired_on ?? "", placement: plant?.placement ?? "indoor", location_label: plant?.location_label ?? "",
    light: plant?.light ?? "", pot_diameter_cm: plant?.pot_diameter_cm?.toString() ?? "", pot_height_cm: plant?.pot_height_cm?.toString() ?? "",
    pot_material: plant?.pot_material ?? "", has_drainage: plant?.has_drainage === true ? "yes" : plant?.has_drainage === false ? "no" : "", substrate_notes: plant?.substrate_notes ?? "",
  });
  const options = [...species];
  if (plant?.plant_id && !options.some((s) => s.id === plant.plant_id)) options.push({ id: plant.plant_id, scientific_name: plant.plants?.scientific_name ?? "Especie actual" });
  const props = (name: string) => ({ id: name, name, value: values[name], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues({ ...values, [name]: e.target.value }), "aria-invalid": Boolean(state.errors?.[name]), "aria-describedby": state.errors?.[name] ? `${name}-error` : undefined });
  const error = (name: string) => state.errors?.[name] && <span id={`${name}-error`} className="field-error">{state.errors[name]?.[0]}</span>;
  return <form action={action} className="editor-form" aria-busy={pending}>
    <input type="hidden" name="id" value={id} /><input type="hidden" name="version" value={plant?.version ?? ""} />
    {state.message && <p role="alert" className="error-box">{state.message}</p>}
    <fieldset disabled={pending}>
      <section className="editor-section"><h2>Conozcamos a tu planta</h2><p>Podés completar la especie más adelante.</p><div className="form-grid">
        <div className="field full-width"><label htmlFor="nickname">Nombre de tu planta *</label><input {...props("nickname")} required maxLength={100} />{error("nickname")}</div>
        <div className="field"><label htmlFor="plant_id">Especie del catálogo</label><select {...props("plant_id")}><option value="">Sin identificar / anotada por mí</option>{options.map((s) => <option key={s.id} value={s.id}>{s.scientific_name}</option>)}</select>{error("plant_id")}</div>
        <div className="field"><label htmlFor="species_label">Nombre de especie anotado</label><input {...props("species_label")} maxLength={200} /><span className="field-hint">Para especies que todavía no están en el catálogo.</span>{error("species_label")}</div>
        <div className="field"><label htmlFor="acquired_on">Fecha de llegada</label><input {...props("acquired_on")} type="date" />{error("acquired_on")}</div>
      </div></section>
      <section className="editor-section"><h2>Su lugar en casa</h2><div className="form-grid">
        <div className="field"><label htmlFor="placement">Ambiente *</label><select {...props("placement")}>{Object.entries(placements).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="field"><label htmlFor="location_label">Ubicación</label><input {...props("location_label")} maxLength={200} />{error("location_label")}</div>
        <div className="field"><label htmlFor="light">Luz que recibe</label><select {...props("light")}><option value="">Sin registrar</option>{Object.entries(lights).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      </div></section>
      <section className="editor-section"><h2>Maceta y sustrato</h2><div className="form-grid">
        <div className="field"><label htmlFor="pot_diameter_cm">Diámetro de maceta (cm)</label><input {...props("pot_diameter_cm")} type="number" min="0.01" step="0.01" max="9999" />{error("pot_diameter_cm")}</div>
        <div className="field"><label htmlFor="pot_height_cm">Altura de maceta (cm)</label><input {...props("pot_height_cm")} type="number" min="0.01" step="0.01" max="9999" />{error("pot_height_cm")}</div>
        <div className="field"><label htmlFor="pot_material">Material</label><select {...props("pot_material")}><option value="">Sin registrar</option>{Object.entries(materials).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className="field"><label htmlFor="has_drainage">¿Tiene drenaje?</label><select {...props("has_drainage")}><option value="">No lo sé todavía</option><option value="yes">Sí</option><option value="no">No</option></select></div>
        <div className="field full-width"><label htmlFor="substrate_notes">Notas sobre el sustrato</label><textarea {...props("substrate_notes")} rows={4} maxLength={3000} />{error("substrate_notes")}</div>
      </div></section>
      <div className="editor-footer"><Link className="button button-secondary" href={plant ? `/plants/${id}` : "/plants"}>Cancelar</Link><button className="button button-primary" type="submit"><Save size={17} />{pending ? "Guardando…" : plant ? "Guardar cambios" : "Agregar planta"}</button></div>
    </fieldset>
  </form>;
}
