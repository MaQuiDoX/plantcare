/* Static offline shell only. Never cache authenticated HTML, API data or photos. */
const CACHE="plantcare-public-v1";
const PUBLIC_ASSETS=["/offline.html","/icons/icon-192.png","/icons/icon-512.png","/icons/icon-maskable.png"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_ASSETS)));});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith("plantcare-public-")&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener("message",event=>{if(event.data?.type==="SKIP_WAITING")self.skipWaiting();});
self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=="GET"||url.origin!==self.location.origin)return;
  if(event.request.mode==="navigate"&&!url.pathname.startsWith("/api/")){
    event.respondWith(fetch(event.request).catch(async()=>await caches.match("/offline.html")||new Response("Sin conexión",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}})));
  }
});
self.addEventListener("push",event=>{
  let tag="plantcare";
  try{const value=event.data?.json();if(typeof value?.tag==="string"&&/^plantcare-[a-f0-9-]{36}$/.test(value.tag))tag=value.tag;}catch{}
  // A generic message avoids leaking plant names on the lock screen or shared devices.
  event.waitUntil(self.registration.showNotification("PlantCare",{body:"Tenés un aviso de cuidado. Abrí PlantCare para revisarlo.",icon:"/icons/icon-192.png",badge:"/icons/icon-192.png",tag,data:{url:"/plants/notifications"}}));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=new URL("/plants/notifications",self.location.origin).href;
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows)if(new URL(client.url).origin===self.location.origin){await client.navigate(target);return client.focus();}
    return self.clients.openWindow(target);
  })());
});
