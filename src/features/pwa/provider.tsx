"use client";
import {createContext,useContext,useEffect,useRef,useState} from "react";
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
const Context=createContext<{registration:ServiceWorkerRegistration|null;install:InstallEvent|null;update:boolean;applyUpdate:()=>void}>({registration:null,install:null,update:false,applyUpdate:()=>{}});
export function PWAProvider({children}:{children:React.ReactNode}){
  const [registration,setRegistration]=useState<ServiceWorkerRegistration|null>(null);const [install,setInstall]=useState<InstallEvent|null>(null);const [update,setUpdate]=useState(false);const reload=useRef(false);
  useEffect(()=>{
    const before=(event:Event)=>{event.preventDefault();setInstall(event as InstallEvent);};const installed=()=>setInstall(null);
    window.addEventListener("beforeinstallprompt",before);window.addEventListener("appinstalled",installed);
    const changed=()=>{if(reload.current)window.location.reload();};navigator.serviceWorker?.addEventListener("controllerchange",changed);
    if("serviceWorker" in navigator&&(process.env.NODE_ENV==="production"||process.env.NEXT_PUBLIC_ENABLE_PWA_DEV==="true")){
      navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).then(reg=>{
        setRegistration(reg);setUpdate(Boolean(reg.waiting));
        reg.addEventListener("updatefound",()=>{const worker=reg.installing;worker?.addEventListener("statechange",()=>{if(worker.state==="installed"&&navigator.serviceWorker.controller)setUpdate(true);});});
      }).catch(()=>setRegistration(null));
    }
    return ()=>{window.removeEventListener("beforeinstallprompt",before);window.removeEventListener("appinstalled",installed);navigator.serviceWorker?.removeEventListener("controllerchange",changed);};
  },[]);
  return <Context value={{registration,install,update,applyUpdate:()=>{if(registration?.waiting){reload.current=true;registration.waiting.postMessage({type:"SKIP_WAITING"});}}}}>{children}</Context>;
}
export function usePWA(){return useContext(Context);}
export function InstallControl(){
  const {registration,install,update,applyUpdate}=usePWA();const [message,setMessage]=useState("");
  return <section className="editor-section"><h2>PlantCare en tu pantalla de inicio</h2><p>Podés instalar la aplicación y abrirla como una app. Las fichas y fotos requieren conexión; sin red verás una pantalla de reconexión.</p>
    {install?<button className="button button-primary" onClick={async()=>{try{await install.prompt();const choice=await install.userChoice;setMessage(choice.outcome==="accepted"?"Instalación solicitada al navegador.":"Podés instalarla más adelante desde el menú del navegador.");}catch{setMessage("Usá la opción de instalación del menú de tu navegador.");}}}>Instalar PlantCare</button>:<p className="field-hint">En Chrome o Edge, buscá la opción de instalar en el menú. En iPhone/iPad, abrí la web en Safari → Compartir → Añadir a pantalla de inicio. Si ya está instalada, abrila desde su icono.</p>}
    {!registration&&<p className="field-hint">La instalación necesita HTTPS (o localhost). En desarrollo, habilitá la PWA con la variable indicada en la guía.</p>}
    {update&&<p className="notice">Hay una actualización disponible. Guardá los formularios abiertos antes de aplicarla. <button className="button button-secondary" onClick={applyUpdate}>Aplicar actualización</button></p>}{message&&<p role="status">{message}</p>}
  </section>;
}
