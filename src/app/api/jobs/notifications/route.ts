import {timingSafeEqual} from "node:crypto";
import {runNotificationJob} from "@/features/notifications/worker";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=120;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  const headers={"Cache-Control":"no-store"};
  if(!secret||secret.length<32)return Response.json({error:"Job not configured"},{status:503,headers});
  const supplied=Buffer.from(request.headers.get("authorization")??"");const expected=Buffer.from(`Bearer ${secret}`);
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return Response.json({error:"Unauthorized"},{status:401,headers});
  if(process.env.NOTIFICATIONS_ENABLED!=="true")return Response.json({enabled:false},{headers});
  try{return Response.json(await runNotificationJob(),{headers});}
  catch{return Response.json({error:"Notification job failed"},{status:503,headers});}
}
export const POST=GET;
