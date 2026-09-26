import { z } from "zod";

const shortText = z.string().trim().min(1).max(800);
export const careSchema = z.object({
  lighting: shortText, location: shortText, temperature: shortText,
  watering: shortText, substrate: shortText,
});
export const candidateSchema = z.object({
  name: z.string().min(1).max(200), commonNames: z.array(z.string().max(200)).max(10),
  family: z.string().max(200), score: z.number().min(0).max(1), care: careSchema.nullable(),
});
export const diagnosisSchema = z.object({
  assessable: z.boolean(), summary: shortText,
  hypotheses: z.array(z.object({
    cause: shortText, category: z.enum(["pest", "fungal", "watering", "nutrition", "other"]),
    evidence: z.array(shortText).min(1).max(4), uncertainty: shortText,
  })).max(3),
  firstSteps: z.array(shortText).min(1).max(5), checks: z.array(shortText).min(1).max(5),
  consultWhen: shortText,
}).refine((value) => value.assessable || value.hypotheses.length === 0, "Una foto no evaluable no admite hipótesis");
export const analysisResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("identification"), candidates: z.array(candidateSchema).min(1).max(3), careWarning: z.string().max(80).nullable(), plantnetVersion: z.string().max(100) }),
  z.object({ kind: z.literal("diagnosis"), diagnosis: diagnosisSchema }),
]);
export const aiProfileSchema = z.object({ analysisId: z.uuid(), candidate: candidateSchema });
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type Candidate = z.infer<typeof candidateSchema>;

export const errorMessages: Record<string, string> = {
  rate_limit: "El proveedor alcanzó su límite. Intentá más tarde.",
  provider_auth: "La clave de un proveedor no es válida o no tiene acceso al modelo configurado.",
  unavailable: "El servicio de análisis no está disponible. Intentá más tarde.",
  timeout: "El servicio tardó demasiado en responder. Podés iniciar un nuevo análisis.",
  invalid_response: "La respuesta no superó la validación. No se modificó tu planta.",
  no_plant: "No se encontró una planta reconocible. Probá una foto nítida con una sola planta.",
  blocked: "El proveedor no pudo analizar esta imagen. Probá otra foto de la planta.",
  storage: "No se pudo guardar la foto para el análisis.",
  interrupted: "El análisis se interrumpió. Podés iniciar uno nuevo; este intento no se volverá a enviar.",
};
export function analysisError(code: string | null) { return errorMessages[code ?? ""] ?? "No se pudo completar el análisis."; }
