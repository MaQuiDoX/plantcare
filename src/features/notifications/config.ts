import "server-only";
import {createClient} from "@supabase/supabase-js";
import {getSupabaseConfig,getAppUrl} from "@/lib/env";
import {z} from "zod";
export function getNotificationConfig(){
  const supabase=getSupabaseConfig();const secret=process.env.SUPABASE_SECRET_KEY?.trim();
  const publicKey=process.env.VAPID_PUBLIC_KEY?.trim();const privateKey=process.env.VAPID_PRIVATE_KEY?.trim();const subject=process.env.VAPID_SUBJECT?.trim();
  const push=publicKey&&/^[A-Za-z0-9_-]{87}$/.test(publicKey)&&privateKey&&/^[A-Za-z0-9_-]{43}$/.test(privateKey)&&subject&&/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subject)?{publicKey,privateKey,subject}:null;
  const resendKey=process.env.RESEND_API_KEY?.trim();const from=process.env.NOTIFICATION_FROM_EMAIL?.trim();
  const email=resendKey&&from&&z.email().safeParse(from).success?{key:resendKey,from}:null;
  return {database:supabase&&secret?.startsWith("sb_secret_")?{url:supabase.url,secret}:null,push,email,appUrl:getAppUrl()};
}
export function notificationAdmin(config:NonNullable<ReturnType<typeof getNotificationConfig>["database"]>){
  return createClient(config.url,config.secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(10_000)})}});
}
