import type {MetadataRoute} from "next";
export default function manifest():MetadataRoute.Manifest{return {
  id:"/",name:"PlantCare · Tu pequeño mundo verde",short_name:"PlantCare",description:"Tu colección de plantas, cuidados y diario privado.",lang:"es-AR",
  start_url:"/plants",scope:"/",display:"standalone",background_color:"#f8f9f5",theme_color:"#2f6348",
  icons:[{src:"/icons/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},{src:"/icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},{src:"/icons/icon-maskable.png",sizes:"512x512",type:"image/png",purpose:"maskable"}],
};}
