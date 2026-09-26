import "server-only";
import {z} from "zod";
import {getNotificationConfig,notificationAdmin} from "./config";
import {getWeatherConfig,fetchWeather} from "@/features/care/weather";
import {payloadSchema} from "./schemas";
import {deliverPush,deliverEmail} from "./delivery";

export async function runNotificationJob(){
  const config=getNotificationConfig();if(!config.database)throw new Error("not_configured");
  const admin=notificationAdmin(config.database);let weatherFailures=0;let deliveryFailures=0;
  const users=await admin.rpc("claim_notification_users",{p_limit:5});if(users.error)throw new Error("claim_users");
  const ids=z.array(z.uuid()).parse(users.data);const weatherConfig=getWeatherConfig();
  const scans=await Promise.allSettled(ids.map(async(id)=>{
    const profile=await admin.from("users").select("latitude,longitude,weather_alerts").eq("id",id).single();if(profile.error)throw new Error("profile");
    const p=z.object({latitude:z.number().nullable(),longitude:z.number().nullable(),weather_alerts:z.boolean()}).parse(profile.data);
    if(p.weather_alerts&&p.latitude!==null&&p.longitude!==null&&weatherConfig){
      try{
        const claim=await admin.rpc("claim_weather_fetch",{p_user:id});if(claim.error)throw new Error("weather_claim");
        if(claim.data){
          const token=z.uuid().parse(claim.data);const w=await fetchWeather(p.latitude,p.longitude,weatherConfig.key,new Date());
          const saved=await admin.rpc("finish_weather_fetch",{p_user:id,p_token:token,p_lat:p.latitude,p_lon:p.longitude,p_temp:w.temperature,p_humidity:w.humidity,p_rain:w.rain,p_observed:w.observedAt});if(saved.error)throw new Error("weather_save");
        }
      }catch{weatherFailures++;}
    }
    const generated=await admin.rpc("generate_user_alerts",{p_user:id});if(generated.error)throw new Error("generate_alerts");
  }));
  const claim=await admin.rpc("claim_notification_deliveries",{p_push:Boolean(config.push),p_email:Boolean(config.email),p_limit:10});if(claim.error)throw new Error("claim_deliveries");
  const jobs=z.array(z.object({id:z.uuid(),lock_token:z.uuid()})).parse(claim.data);
  for(let offset=0;offset<jobs.length;offset+=5){
    const outcomes=await Promise.allSettled(jobs.slice(offset,offset+5).map(async(job)=>{
      const row=await admin.rpc("get_notification_payload",{p_id:job.id,p_token:job.lock_token});if(row.error)throw new Error("payload");
      let outcome:Awaited<ReturnType<typeof deliverPush>>={status:"cancelled",code:"obsolete"};
      if(row.data){
        const payload=payloadSchema.parse(row.data);
        if(payload.channel==="push"&&config.push){
          outcome=await deliverPush(payload,config.push);
          if(outcome.gone&&payload.subscriptionId){const deleted=await admin.from("push_subscriptions").delete().eq("id",payload.subscriptionId).eq("user_id",payload.userId);if(deleted.error)throw new Error("delete_device");return;}
        }else if(payload.channel==="email"&&config.email){
          const user=await admin.auth.admin.getUserById(payload.userId);if(user.error)throw new Error("email_user");
          if(user.data.user.email&&user.data.user.email_confirmed_at)outcome=await deliverEmail(job.id,user.data.user.email,config.email,config.appUrl);
          else outcome={status:"cancelled",code:"unconfirmed_email"};
        }
      }
      if(outcome.status==="failed"||outcome.status==="retry")deliveryFailures++;
      const done=await admin.rpc("finish_notification_delivery",{p_id:job.id,p_token:job.lock_token,p_status:outcome.status,p_error:outcome.code});if(done.error)throw new Error("finish_delivery");
    }));
    deliveryFailures+=outcomes.filter(r=>r.status==="rejected").length;
  }
  return {scanned:ids.length,scanFailures:scans.filter(r=>r.status==="rejected").length,weatherFailures,processed:jobs.length,deliveryFailures};
}
