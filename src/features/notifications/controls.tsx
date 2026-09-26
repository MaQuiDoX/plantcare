"use client";
import {useActionState,useState} from "react";
import {usePWA} from "@/features/pwa/provider";
import {registerPush,removePush,saveNotificationPreferences,refreshAlerts} from "./actions";
import {initialState,type FormState} from "@/features/plants/validation";
function Feedback({state}:{state:FormState}){return state.message?<p role={state.status==="error"?"alert":"status"} className={state.status==="error"?"error-box":"success-box"}>{state.message}</p>:null;}
export function PushControl({publicKey}:{publicKey:string|null}){
  const {registration}=usePWA();const [state,setState]=useState<FormState>(initialState);const [busy,setBusy]=useState(false);
  async function enable(){
    if(!registration||!publicKey)return;
    setBusy(true);
    try{
      if(!("PushManager" in window)||!("Notification" in window))throw new Error("unsupported");
      const permission=await Notification.requestPermission();if(permission!=="granted"){setState({status:"error",message:"No se concedió permiso. Revisá los permisos del sitio en el navegador; en iPhone abrí primero la app instalada."});return;}
      const previous=await registration.pushManager.getSubscription();
      if(previous){await previous.unsubscribe();await removePush(previous.endpoint);}
      const raw=atob(publicKey.replaceAll("-","+").replaceAll("_","/"));const key=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)key[i]=raw.charCodeAt(i);
      const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
      const result=await registerPush(subscription.toJSON());if(result.status!=="success")await subscription.unsubscribe();setState(result);
    }catch{setState({status:"error",message:"No se pudo activar push. Usá un navegador compatible con HTTPS; en iPhone/iPad necesitás instalar la app y abrirla desde su icono."});}
    finally{setBusy(false);}
  }
  async function disable(){
    setBusy(true);try{const subscription=await registration?.pushManager.getSubscription();if(subscription){const result=await removePush(subscription.endpoint);await subscription.unsubscribe();setState(result);}else setState({status:"success",message:"Este navegador no tiene una suscripción activa."});for(const notice of await registration?.getNotifications()??[])notice.close();}catch{setState({status:"error",message:"No se pudo desactivar. Podés bloquear las notificaciones desde los permisos del navegador."});}finally{setBusy(false);}
  }
  return <section className="editor-section"><h2>Avisos en este dispositivo</h2><p>Se pide permiso solo al activar. Los mensajes de la pantalla de bloqueo son genéricos; el detalle se consulta al iniciar sesión.</p><Feedback state={state}/><div className="care-actions"><button className="button button-primary" disabled={busy||!publicKey||!registration} onClick={enable}>{busy?"Actualizando…":"Activar o reconectar este dispositivo"}</button><button className="button button-secondary" disabled={busy||!registration} onClick={disable}>Desactivar este dispositivo</button></div>{!publicKey&&<p className="field-hint">Las claves VAPID todavía no están configuradas en el servidor.</p>}<p className="field-hint">Reconectar reemplaza la suscripción local. Podés registrar hasta cinco dispositivos por cuenta. El navegador y el sistema operativo pueden retrasar los avisos.</p></section>;
}
export type Preferences={care_alerts:boolean;seasonal_alerts:boolean;weather_alerts:boolean;push_reminders:boolean;email_reminders:boolean;reminder_time:string;timezone:string};
export function PreferenceForm({preferences:p,emailConfigured,pushConfigured}:{preferences:Preferences;emailConfigured:boolean;pushConfigured:boolean}){
  const [state,action,pending]=useActionState(saveNotificationPreferences,initialState);
  const select=(name:string,label:string,on:boolean,disabled=false)=><div className="field"><label htmlFor={`notify-${name}`}>{label}</label><select key={`${name}:${on}:${disabled}`} id={`notify-${name}`} name={name} defaultValue={on&&!disabled?"on":"off"}><option value="off">Desactivado</option><option value="on" disabled={disabled}>Activado</option></select></div>;
  return <form action={action} className="editor-form" aria-busy={pending}><Feedback state={state}/><fieldset disabled={pending}><section className="editor-section"><h2>Qué querés recordar</h2><div className="form-grid">{select("care","Revisiones de riego",p.care_alerts)}{select("season","Cambios de estación",p.seasonal_alerts)}{select("weather","Clima extremo y consulta automática del clima",p.weather_alerts)}{select("push","Enviar avisos push",p.push_reminders,!pushConfigured)}{select("email","Enviar por correo",p.email_reminders,!emailConfigured)}<div className="field"><label htmlFor="notify-time">Hora preferida de riego</label><input id="notify-time" name="time" type="time" required defaultValue={p.reminder_time.slice(0,5)}/><span className="field-hint">Zona: {p.timezone}. Se envía en la siguiente ejecución a partir de esta hora, no necesariamente en ese minuto.</span></div></div><p className="field-hint">Activar clima autoriza consultar periódicamente OpenWeather con las coordenadas guardadas. Las alertas son observaciones de temperatura o lluvia; no son avisos oficiales de emergencia. Los avisos de estación y clima pueden llegar fuera de la hora preferida de riego.</p>{!emailConfigured&&<p className="field-hint">El envío de correo requiere Resend y un remitente verificado. Es independiente del correo de inicio de sesión de Supabase.</p>}<button className="button button-primary" type="submit">{pending?"Guardando…":"Guardar preferencias"}</button></section></fieldset></form>;
}
export function RefreshAlerts(){const [state,action,pending]=useActionState(refreshAlerts,initialState);return <form action={action}><Feedback state={state}/><button className="button button-secondary" disabled={pending}>{pending?"Revisando…":"Revisar avisos ahora"}</button></form>;}
