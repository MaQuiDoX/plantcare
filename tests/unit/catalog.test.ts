import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { plantSchema } from "@/features/plants/validation";
import { journalSchema, todayInTimezone, formatDay, MAX_PHOTO_BYTES } from "@/features/journal/validation";
import { normalizePhoto } from "@/features/journal/images";

const plant = { id: "b7157311-ace0-4a59-9300-000000000001", version: "", nickname: "  Helecho  ", species_label: "", plant_id: "", acquired_on: "", placement: "indoor", location_label: "", light: "", pot_diameter_cm: "", pot_height_cm: "", pot_material: "", has_drainage: "", substrate_notes: "" };
const entry = { id: "c7157311-ace0-4a59-9300-000000000001", user_plant_id: plant.id, version: "", entry_date: "2026-01-15", kind: "note", notes: "Hoja nueva", water_ml: "", height_cm: "", remove_photo: "" };
describe("datos de plantas y diario", () => {
  it("admite especie desconocida y preserva ceros inválidos como errores", () => {
    const parsed = plantSchema.parse(plant);
    expect(parsed.nickname).toBe("Helecho"); expect(parsed.plant_id).toBeNull(); expect(parsed.pot_diameter_cm).toBeNull();
    expect(plantSchema.safeParse({ ...plant, pot_diameter_cm: "0" }).success).toBe(false);
    expect(plantSchema.safeParse({ ...plant, acquired_on: "2026-02-30" }).success).toBe(false);
  });
  it("valida cantidades, fechas y tipo de evento", () => {
    expect(journalSchema.safeParse({ ...entry, water_ml: "100" }).success).toBe(false);
    expect(journalSchema.safeParse({ ...entry, kind: "watering", water_ml: "100.5" }).success).toBe(false);
    expect(journalSchema.parse({ ...entry, kind: "watering", water_ml: "100" }).water_ml).toBe(100);
    expect(journalSchema.safeParse({ ...entry, entry_date: "2026-02-30" }).success).toBe(false);
  });
  it("mantiene el día del usuario cerca de medianoche", () => {
    expect(todayInTimezone("America/Argentina/Buenos_Aires", new Date("2026-01-16T01:00:00Z"))).toBe("2026-01-15");
    expect(formatDay("2026-01-15")).toContain("15");
  });
});
describe("procesamiento de imágenes", () => {
  it("decodifica, orienta, reduce y elimina EXIF", async () => {
    const source = await sharp({ create: { width: 2200, height: 1000, channels: 3, background: "green" } }).jpeg().withExif({ IFD0: { Artist: "Test private metadata" } }).toBuffer();
    const output = await normalizePhoto(new File([new Uint8Array(source)], "foto.jpg", { type: "image/jpeg" }));
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("webp"); expect(metadata.width).toBeLessThanOrEqual(1800); expect(metadata.exif).toBeUndefined();
  });
  it("rechaza texto disfrazado de JPEG y formatos no admitidos", async () => {
    await expect(normalizePhoto(new File(["no es una imagen"], "foto.jpg", { type: "image/jpeg" }))).rejects.toThrow("No pudimos leer");
    await expect(normalizePhoto(new File(["<svg />"], "foto.svg", { type: "image/svg+xml" }))).rejects.toThrow("JPEG");
  });
  it("rechaza fotos vacías y mayores al límite antes de procesar", async () => {
    await expect(normalizePhoto(new File([], "foto.jpg", { type: "image/jpeg" }))).rejects.toThrow("3 MiB");
    await expect(normalizePhoto(new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "foto.jpg", { type: "image/jpeg" }))).rejects.toThrow("3 MiB");
  });
});
