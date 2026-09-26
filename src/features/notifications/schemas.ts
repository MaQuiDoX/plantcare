import { z } from "zod";
export function allowedPushEndpoint(value:string) {
  try {
    const url=new URL(value);
    return value.length<=2048&&url.protocol==="https:"&&!url.username&&!url.password&&!url.port&&!url.hash&&
      (["fcm.googleapis.com","updates.push.services.mozilla.com","web.push.apple.com"].includes(url.hostname)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname));
  } catch { return false; }
}
export const subscriptionSchema=z.object({endpoint:z.string().refine(allowedPushEndpoint),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)})});
export const preferenceSchema=z.object({care:z.enum(["on","off"]),season:z.enum(["on","off"]),weather:z.enum(["on","off"]),push:z.enum(["on","off"]),email:z.enum(["on","off"]),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)});
export const payloadSchema=z.object({id:z.uuid(),userId:z.uuid(),alertId:z.uuid(),channel:z.enum(["push","email"]),endpoint:z.string().nullable(),key:z.string().nullable(),auth:z.string().nullable(),subscriptionId:z.uuid().nullable()});
