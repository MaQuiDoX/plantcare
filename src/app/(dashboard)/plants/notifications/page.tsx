import Link from "next/link";
import {z} from "zod";
import {requireUser} from "@/features/auth/session";
import {createClient} from "@/lib/supabase/server";
import {getNotificationConfig} from "@/features/notifications/config";
import {PreferenceForm,PushControl,RefreshAlerts} from "@/features/notifications/controls";
import {markAlertRead,removeDevice} from "@/features/notifications/actions";
import {InstallControl} from "@/features/pwa/provider";
export const metadata={title:"Avisos e instalación"};
export default async function NotificationsPage({searchParams}:{searchParams:Promise<{page?:string}>}){
  const user=await requireUser();const supabase=await createClient();const params=await searchParams;const requested=Number(params.page);const page=Number.isSafeInteger(requested)&&requested>0&&requested<=10000?requested:1;
  const [profileResult,alertsResult,devicesResult]=await Promise.all([
    supabase.from("users").select("care_alerts,seasonal_alerts,weather_alerts,push_reminders,email_reminders,reminder_time,timezone").eq("id",user.id).single(),
    supabase.from("alerts").select("id,title,body,created_at,read_at,user_plant_id,kind",{count:"exact"}).eq("user_id",user.id).order("created_at",{ascending:false}).order("id").range((page-1)*12,page*12-1),
    supabase.from("push_subscriptions").select("id,created_at").eq("user_id",user.id).order("created_at",{ascending:false}),
  ]);
  if(profileResult.error||alertsResult.error||devicesResult.error)throw new Error("No se pudo leer la bandeja. Verificá la migración 006.");
  const preferences=z.object({care_alerts:z.boolean(),seasonal_alerts:z.boolean(),weather_alerts:z.boolean(),push_reminders:z.boolean(),email_reminders:z.boolean(),reminder_time:z.string(),timezone:z.string()}).parse(profileResult.data);
  const alerts=z.array(z.object({id:z.uuid(),title:z.string(),body:z.string(),created_at:z.string(),read_at:z.string().nullable(),user_plant_id:z.uuid().nullable(),kind:z.string()})).parse(alertsResult.data);
  const devices=z.array(z.object({id:z.uuid(),created_at:z.string()})).parse(devicesResult.data);const config=getNotificationConfig();
  return <><Link href="/plants" className="text-link">← Mi colección</Link><div className="editor-heading"><span className="eyebrow">UN PEQUEÑO AVISO, UN MEJOR CUIDADO</span><h1>Avisos e instalación</h1><p>Elegí cómo acompañar el ritmo de tus plantas.</p></div>
    {process.env.NOTIFICATIONS_ENABLED!=="true"&&<p className="notice">Los envíos automáticos todavía están deshabilitados. Podés revisar avisos dentro de la aplicación.</p>}
    <InstallControl/><PushControl publicKey={config.push?.publicKey??null}/><PreferenceForm preferences={preferences} emailConfigured={Boolean(config.email)} pushConfigured={Boolean(config.push)}/>
    {devices.length>0&&<section className="editor-section"><h2>Dispositivos registrados</h2><ul className="device-list">{devices.map((device,index)=><li key={device.id}><span>Dispositivo {index+1} · registrado el {new Date(device.created_at).toLocaleDateString("es-AR",{timeZone:preferences.timezone})}</span><form action={removeDevice}><input type="hidden" name="id" value={device.id}/><button className="text-link">Eliminar dispositivo {index+1}</button></form></li>)}</ul></section>}
    <section className="notification-inbox"><div className="collection-toolbar"><h2>Tu bandeja de avisos</h2><RefreshAlerts/></div><p className="field-hint">Historial de hasta 30 días, sujeto a la próxima limpieza. Un aviso antiguo puede haber dejado de aplicar: comprobá la agenda y el clima actuales.</p>
    {alerts.length?alerts.map(alert=><article className="editor-section" key={alert.id}><span className="eyebrow">{alert.read_at?"LEÍDO":"SIN LEER"}</span><h3>{alert.title}</h3><p>{alert.body}</p><time dateTime={alert.created_at}>{new Date(alert.created_at).toLocaleString("es-AR",{timeZone:preferences.timezone})}</time><div className="care-actions">{alert.user_plant_id&&<Link className="text-link" href={`/plants/${alert.user_plant_id}/care`}>Ver planta →</Link>}{!alert.read_at&&<form action={markAlertRead}><input type="hidden" name="id" value={alert.id}/><button className="button button-secondary">Marcar como leído</button></form>}</div></article>):<p className="notice">No hay avisos en esta página. Revisá ahora para comprobar tus agendas y el clima guardado.</p>}
    {((alertsResult.count??0)>12||page>1)&&<nav className="pagination" aria-label="Páginas de avisos">{page>1&&<Link href={`/plants/notifications?page=${page-1}`}>← Anterior</Link>}<span>Página {page}</span>{page*12<(alertsResult.count??0)&&<Link href={`/plants/notifications?page=${page+1}`}>Siguiente →</Link>}</nav>}</section>
  </>;
}
