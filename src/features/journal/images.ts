import sharp from "sharp";
import { MAX_PHOTO_BYTES } from "./validation";

export async function normalizePhoto(file: File): Promise<Buffer> {
  if (!file.size || file.size > MAX_PHOTO_BYTES) throw new Error("La foto debe pesar como máximo 3 MiB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Elegí una foto JPEG, PNG o WebP.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const processor = sharp(buffer, { limitInputPixels: 40_000_000, failOn: "warning" });
  try {
    const metadata = await processor.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("invalid");
    // Re-encode decodifica realmente los píxeles y elimina EXIF/GPS por defecto.
    const normalized = await processor.rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    if (normalized.length > MAX_PHOTO_BYTES) throw new Error("large");
    return normalized;
  } catch { throw new Error("No pudimos leer la imagen. Elegí una foto válida, estática y de hasta 40 megapíxeles."); }
}
