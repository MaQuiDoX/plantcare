import "server-only";
import webpush from "web-push";
import type {z} from "zod";
import {subscriptionSchema,type payloadSchema} from "./schemas";
import type {getNotificationConfig} from "./config";
export type DeliveryOutcome={status:"sent"|"retry"|"failed"|"cancelled";code:string|null;gone?:boolean};
export async function deliverPush(payload:z.infer<typeof payloadSchema>,config:NonNullable<ReturnType<typeof getNotificationConfig>["push"]>,send=webpush.sendNotification):Promise<DeliveryOutcome>{
  const parsed=subscriptionSchema.safeParse({endpoint:payload.endpoint,keys:{p256dh:payload.key,auth:payload.auth}});
  if(!parsed.success)return {status:"failed",code:"invalid_endpoint"};
  try{
    await send(parsed.data,JSON.stringify({title:"PlantCare",body:"Tenés un aviso de cuidado. Abrí PlantCare para revisarlo.",tag:`plantcare-${payload.alertId}`}),{vapidDetails:config,TTL:300,timeout:8000,urgency:"normal",topic:payload.alertId.replaceAll("-","")});
    return {status:"sent",code:null};
  }catch(error){
    const status=typeof error==="object"&&error!==null&&"statusCode" in error?Number(error.statusCode):0;
    if(status===404||status===410)return {status:"cancelled",code:"expired_subscription",gone:true};
    return {status:status===429||status>=500||status===0?"retry":"failed",code:status===429?"provider_quota":status===401||status===403?"provider_auth":"push_error"};
  }
}
export async function deliverEmail(id:string,email:string,config:NonNullable<ReturnType<typeof getNotificationConfig>["email"]>,appUrl:string,transport:typeof fetch=fetch):Promise<DeliveryOutcome>{
  try{
    const response=await transport("https://api.resend.com/emails",{method:"POST",redirect:"error",signal:AbortSignal.timeout(8000),headers:{Authorization:`Bearer ${config.key}`,"Content-Type":"application/json","Idempotency-Key":`plantcare-${id}`},body:JSON.stringify({from:config.from,to:[email],subject:"Tenés un aviso en PlantCare",text:`Tenés un aviso de cuidado pendiente. Revisalo en ${appUrl}/plants/notifications\n\nPodés desactivar estos correos en esa misma página.`})});
    await response.body?.cancel();
    if(response.ok)return {status:"sent",code:null};
    return {status:response.status===429||response.status>=500?"retry":"failed",code:response.status===429?"provider_quota":"email_error"};
  }catch{return {status:"retry",code:"email_unavailable"};}
}
