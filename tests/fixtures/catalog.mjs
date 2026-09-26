import { randomUUID } from "node:crypto";

const owner = "a7157311-ace0-4a59-9200-000000000010";
const defaults = { species_label: null, plant_id: null, plants: null, acquired_on: null, archived_at: null, light: null, pot_diameter_cm: null, pot_height_cm: null, pot_material: null, has_drainage: null, substrate_notes: null, location_label: null, version: 1, placement: "indoor" };
const tables = {
  user_plants: [
    { ...defaults, user_id: owner, id: "b7157311-ace0-4a59-9200-000000000010", nickname: "Monstera del living", location_label: "Junto al sillón", created_at: "2026-09-01T12:00:00Z", plants: { scientific_name: "Monstera deliciosa" } },
    { ...defaults, user_id: owner, id: "b7157311-ace0-4a59-9200-000000000011", nickname: "Lavanda del balcón", location_label: "Balcón", placement: "outdoor", created_at: "2026-08-01T12:00:00Z", plants: { scientific_name: "Lavandula angustifolia" } },
  ], journal_entries: [], media_assets: [], storage_cleanup: [], ai_analyses: [],
};
const aiOwner = "a7157311-ace0-4a59-9200-000000000030";
const aiCare = { lighting: "Luz indirecta brillante.", location: "Cerca de una ventana con cortina.", temperature: "Evitar corrientes frías.", watering: "Comprobar humedad antes de regar.", substrate: "Mezcla aireada con buen drenaje." };
const aiCandidate = { name: "Monstera deliciosa", commonNames: ["Costilla de Adán"], family: "Araceae", score: 0.86, care: aiCare };
const aiBase = { user_id: aiOwner, user_plant_id: null, media_asset_id: null, status: "succeeded", provider: "plantnet+gemini", model: "test-model", schema_version: "1", error_code: null, observations: null, created_at: "2026-09-20T12:00:00Z", applied_at: null };
tables.ai_analyses.push({ ...aiBase, id: "c7157311-ace0-4a59-9200-000000000030", kind: "identification", result: { kind: "identification", candidates: [aiCandidate], careWarning: null, plantnetVersion: "fixture" } });
tables.user_plants.push({ ...defaults, user_id: aiOwner, id: "b7157311-ace0-4a59-9200-000000000030", nickname: "Poto de Luz", created_at: "2026-09-01T12:00:00Z" });
tables.ai_analyses.push({ ...aiBase, id: "c7157311-ace0-4a59-9200-000000000031", user_plant_id: "b7157311-ace0-4a59-9200-000000000030", provider: "gemini", kind: "diagnosis", observations: "Aparecieron hojas amarillas.", result: { kind: "diagnosis", diagnosis: { assessable: true, summary: "Amarilleo visible; la causa no está confirmada.", hypotheses: [{ cause: "Posible exceso de agua", category: "watering", evidence: ["Amarilleo de la hoja inferior."], uncertainty: "No se ven las raíces ni la humedad del sustrato." }], firstSteps: ["Comprobar la humedad del sustrato."], checks: ["Verificar el drenaje de la maceta."], consultWhen: "Si el deterioro continúa, consultar a un especialista." } } });
const objects = new Map();
function removeMedia(entryId) {
  for (const row of tables.media_assets.filter((m) => m.journal_entry_id === entryId)) {
    tables.storage_cleanup.push({ object_path: row.object_path, user_id: row.user_id, status: "deleted", available_at: new Date().toISOString() });
  }
  tables.media_assets = tables.media_assets.filter((m) => m.journal_entry_id !== entryId);
}
function removeEntries(plantId) {
  tables.journal_entries.filter((e) => e.user_plant_id === plantId).forEach((e) => removeMedia(e.id));
  tables.journal_entries = tables.journal_entries.filter((e) => e.user_plant_id !== plantId);
}

export function catalogRequest({ request, response, url, body, raw, user, send, failure }) {
  const path = url.pathname;
  if (path.startsWith("/storage/v1/object/")) {
    if (request.method === "DELETE") {
      for (const key of body.prefixes ?? []) if (key.startsWith(`${user.id}/`)) objects.delete(key);
      return send(200, []);
    }
    const key = decodeURIComponent(path.replace(/^\/storage\/v1\/object\/(?:authenticated\/)?plant-images\//, ""));
    if (!key.startsWith(`${user.id}/`)) return failure("forbidden", 403);
    if (request.method === "POST") { objects.set(key, raw); return send(200, { Key: `plant-images/${key}`, Id: randomUUID() }); }
    if (!objects.has(key)) return failure("not_found", 404);
    response.writeHead(200, { "content-type": "image/webp" }); response.end(objects.get(key)); return;
  }
  if (path === "/rest/v1/plants") return send(200, []);
  if (path.startsWith("/rest/v1/rpc/")) {
    const fn = path.split("/").at(-1);
    if (fn === "apply_ai_identification") {
      const analysis = tables.ai_analyses.find((a) => a.id === body.p_id && a.user_id === user.id && a.kind === "identification" && a.status === "succeeded");
      if (!analysis) return failure("42501", 403);
      if (analysis.applied_at) return send(200, analysis.user_plant_id);
      const candidate = analysis.result.candidates[body.p_choice];
      if (!candidate) return failure("23514");
      const plant = { ...defaults, id: randomUUID(), user_id: user.id, nickname: body.p_nickname, species_label: candidate.name, ai_profile: { analysisId: analysis.id, candidate }, created_at: new Date().toISOString() };
      tables.user_plants.push(plant);
      analysis.user_plant_id = plant.id; analysis.applied_at = new Date().toISOString();
      return send(200, plant.id);
    }
    if (fn === "claim_storage_cleanup") {
      const due = tables.storage_cleanup.filter((q) => q.user_id === user.id && Date.parse(q.available_at) <= Date.now());
      due.forEach((q) => { q.status = "purging"; q.available_at = new Date(Date.now() + 300000).toISOString(); });
      return send(200, due.map((q) => ({ object_path: q.object_path })));
    }
    const plant = tables.user_plants.find((p) => p.id === body.p_plant_id && p.user_id === user.id && p.archived_at === null);
    if (!plant) return failure("42501", 403);
    if (fn === "reserve_journal_photo") {
      const object_path = `${user.id}/${randomUUID()}.webp`;
      tables.storage_cleanup.push({ object_path, user_id: user.id, status: "reserved", available_at: new Date(Date.now() + 86400000).toISOString() });
      return send(200, object_path);
    }
    if (fn === "save_journal_entry") {
      let entry = tables.journal_entries.find((e) => e.id === body.p_id && e.user_id === user.id);
      if (entry && body.p_version === null) return send(200, entry.id);
      if ((entry && entry.version !== body.p_version) || (!entry && body.p_version !== null)) return failure("40001", 409);
      if (!entry) { entry = { id: body.p_id, user_id: user.id, user_plant_id: plant.id, version: 0, created_at: new Date().toISOString() }; tables.journal_entries.push(entry); }
      Object.assign(entry, { entry_date: body.p_date, kind: body.p_kind, notes: body.p_notes, water_ml: body.p_water_ml, height_cm: body.p_height_cm, version: entry.version + 1 });
      if (body.p_remove_photo || body.p_photo_path) removeMedia(entry.id);
      if (body.p_photo_path) {
        tables.media_assets.push({ id: randomUUID(), user_id: user.id, user_plant_id: plant.id, journal_entry_id: entry.id, object_path: body.p_photo_path });
        tables.storage_cleanup = tables.storage_cleanup.filter((q) => q.object_path !== body.p_photo_path);
      }
      return send(200, entry.id);
    }
    return failure("unknown_rpc", 404);
  }
  const table = path.replace("/rest/v1/", "");
  if (!Object.hasOwn(tables, table)) return failure("not_found", 404);
  if (request.method === "POST") {
    if (body.user_id !== user.id) return failure("42501", 403);
    if (tables[table].some((r) => r.id === body.id)) return failure("23505", 409);
    const row = { ...defaults, ...body, created_at: new Date().toISOString() };
    tables[table].push(row); return send(201, null);
  }
  let rows = tables[table].filter((r) => r.user_id === user.id);
  for (const [key, filter] of url.searchParams) {
    if (["select", "order", "offset", "limit"].includes(key)) continue;
    if (filter.startsWith("eq.")) rows = rows.filter((r) => String(r[key]) === filter.slice(3));
    else if (filter === "is.null") rows = rows.filter((r) => r[key] == null);
    else if (filter === "not.is.null") rows = rows.filter((r) => r[key] != null);
    else if (filter.startsWith("ilike.")) { const term = filter.slice(6).replace(/^%|%$/g, "").replace(/\\([%_\\])/g, "$1").toLowerCase(); rows = rows.filter((r) => r[key]?.toLowerCase().includes(term)); }
  }
  if (request.method === "PATCH") rows.forEach((r) => Object.assign(r, body, { version: r.version + 1 }));
  if (request.method === "DELETE") {
    if (table === "user_plants") rows.forEach((r) => removeEntries(r.id));
    if (table === "journal_entries") rows.forEach((r) => removeMedia(r.id));
    tables[table] = tables[table].filter((r) => !rows.includes(r));
  }
  rows.sort((a, b) => (b.entry_date ?? b.created_at ?? "").localeCompare(a.entry_date ?? a.created_at ?? ""));
  const count = rows.length;
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 1000);
  rows = rows.slice(offset, offset + limit);
  if (table === "journal_entries") rows = rows.map((r) => ({ ...r, media_assets: tables.media_assets.filter((m) => m.journal_entry_id === r.id) }));
  const single = request.headers.accept?.includes("vnd.pgrst.object");
  return send(200, single ? rows[0] ?? null : rows, { "content-range": `${offset}-${offset + Math.max(0, rows.length - 1)}/${count}` });
}
