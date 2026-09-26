"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requireUser} from "@/features/auth/session";
import {createClient} from "@/lib/supabase/server";
import {mutationError,type FormState} from "@/features/plants/validation";
import {subscriptionSchema,preferenceSchema} from "./schemas";
import {getNotificationConfig} from "./config";

export async function registerPush(input:unknown):Promise<FormState>{
  await requireUser();if(!getNotificationConfig().push)return {status:"error",message:"Las claves push todavía no están configuradas."};
  const parsed=subscriptionSchema.safeParse(input);if(!parsed.success)return {status:"error",message:"Este servicio de notificaciones no está admitido o la suscripción es inválida."};
  const supabase=await createClient();const {error}=await supabase.rpc("save_push_subscription",{p_endpoint:parsed.data.endpoint,p_key:parsed.data.keys.p256dh,p_auth:parsed.data.keys.auth});
  if(error)return {status:"error",message:error.code==="54000"?"Llegaste al límite de cinco dispositivos. Eliminá uno de la lista antes de continuar.":"No se pudo registrar este dispositivo. Desactivá su suscripción y volvé a intentarlo."};
  revalidatePath("/plants/notifications");return {status:"success",message:"Este dispositivo está registrado para recibir avisos."};
}
export async function removePush(endpoint:string):Promise<FormState>{
  const user=await requireUser();if(!z.string().max(2048).safeParse(endpoint).success)return mutationError();
  const supabase=await createClient();const {error}=await supabase.from("push_subscriptions").delete().eq("user_id",user.id).eq("endpoint",endpoint);
  if(error)return mutationError();revalidatePath("/plants/notifications");return {status:"success",message:"Dispositivo desactivado."};
}
export async function removeDevice(form:FormData){
  const user=await requireUser();const id=z.uuid().safeParse(form.get("id"));if(!id.success)return;
  const supabase=await createClient();const {error}=await supabase.from("push_subscriptions").delete().eq("user_id",user.id).eq("id",id.data);
  if(error)throw new Error("No se pudo eliminar el dispositivo.");revalidatePath("/plants/notifications");
}
export async function saveNotificationPreferences(_state:FormState,form:FormData):Promise<FormState>{
  const user=await requireUser();const parsed=preferenceSchema.safeParse(Object.fromEntries(form));if(!parsed.success)return {status:"error",message:"Revisá las preferencias y la hora."};
  const config=getNotificationConfig();const v=parsed.data;
  if(v.email==="on"&&!config.email)return {status:"error",message:"El correo de recordatorios todavía no está configurado."};
  if(v.push==="on"&&!config.push)return {status:"error",message:"Los avisos push todavía no están configurados."};
  const supabase=await createClient();const {error}=await supabase.from("users").update({care_alerts:v.care==="on",seasonal_alerts:v.season==="on",weather_alerts:v.weather==="on",push_reminders:v.push==="on",email_reminders:v.email==="on",reminder_time:v.time}).eq("id",user.id);
  if(error)return mutationError();revalidatePath("/plants/notifications");return {status:"success",message:"Preferencias guardadas. El envío depende de la próxima ejecución del programador."};
}
export async function refreshAlerts():Promise<FormState>{
  await requireUser();const supabase=await createClient();const {error}=await supabase.rpc("refresh_my_alerts");
  if(error)return {status:"error",message:"No se pudieron revisar los avisos. Verificá la migración 006."};
  revalidatePath("/plants/notifications");return {status:"success",message:"Avisos revisados con la agenda y el clima guardados. Los envíos los procesa el programador."};
}
export async function markAlertRead(form:FormData){
  const user=await requireUser();const id=z.uuid().safeParse(form.get("id"));if(!id.success)return;
  const supabase=await createClient();const {error}=await supabase.from("alerts").update({read_at:new Date().toISOString()}).eq("id",id.data).eq("user_id",user.id);
  if(error)throw new Error("No se pudo marcar el aviso.");revalidatePath("/plants/notifications");
}
