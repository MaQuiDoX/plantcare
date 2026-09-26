import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
const worker=vi.hoisted(()=>vi.fn());vi.mock("@/features/notifications/worker",()=>({runNotificationJob:worker}));
import {allowedPushEndpoint} from "@/features/notifications/schemas";
import {deliverPush,deliverEmail} from "@/features/notifications/delivery";
import {GET} from "@/app/api/jobs/notifications/route";
const id="a7157311-ace0-4a59-9600-000000000001";
const payload={id,userId:id,alertId:id,channel:"push" as const,endpoint:"https://fcm.googleapis.com/test",key:"B".repeat(87),auth:"A".repeat(22),subscriptionId:id};
const vapid={publicKey:"B".repeat(87),privateKey:"C".repeat(43),subject:"mailto:test@example.com"};
describe("notificaciones",()=>{
  it.each(["http://fcm.googleapis.com/test","https://fcm.googleapis.com.evil.test/test","https://fcm.googleapis.com@127.0.0.1/test","https://127.0.0.1/test","https://web.push.apple.com:444/test"])("rechaza endpoint peligroso %s",value=>expect(allowedPushEndpoint(value)).toBe(false));
  it("admite servicios push conocidos",()=>expect(allowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/test")).toBe(true));
  it("no realiza solicitudes a destinos no permitidos",async()=>{const send=vi.fn();expect(await deliverPush({...payload,endpoint:"https://127.0.0.1/"},vapid,send)).toMatchObject({status:"failed"});expect(send).not.toHaveBeenCalled();});
  it("envía mensajes genéricos y clasifica endpoints vencidos",async()=>{
    const send=vi.fn().mockResolvedValue({});expect(await deliverPush(payload,vapid,send)).toMatchObject({status:"sent"});
    expect(JSON.parse(send.mock.calls[0][1])).toMatchObject({title:"PlantCare",body:expect.stringContaining("Tenés un aviso")});
    expect(send.mock.calls[0][2]).toMatchObject({TTL:300,timeout:8000});send.mockRejectedValue({statusCode:410});expect(await deliverPush(payload,vapid,send)).toMatchObject({gone:true,status:"cancelled"});
  });
  it("reintenta 429 pero no credenciales inválidas",async()=>{const send=vi.fn().mockRejectedValue({statusCode:429});expect(await deliverPush(payload,vapid,send)).toMatchObject({status:"retry"});send.mockRejectedValue({statusCode:403});expect(await deliverPush(payload,vapid,send)).toMatchObject({status:"failed"});});
  it("correo usa idempotencia y texto genérico",async()=>{const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response("{}",{status:200}));expect(await deliverEmail(id,"user@example.com",{key:"private",from:"plant@example.com"},"https://plant.example.com",transport)).toMatchObject({status:"sent"});expect(transport.mock.calls[0][1]?.headers).toMatchObject({"Idempotency-Key":`plantcare-${id}`});});
});
describe("endpoint del programador",()=>{
  beforeEach(()=>{vi.stubEnv("CRON_SECRET","x".repeat(40));vi.stubEnv("NOTIFICATIONS_ENABLED","true");worker.mockReset().mockResolvedValue({processed:0});});afterEach(()=>vi.unstubAllEnvs());
  it("no acepta el secreto en URL ni encabezados incorrectos",async()=>{expect((await GET(new Request("http://localhost/api/jobs/notifications?secret="+"x".repeat(40)))).status).toBe(401);expect(worker).not.toHaveBeenCalled();});
  it("permite deshabilitar envíos y ejecuta solo con autorización válida",async()=>{vi.stubEnv("NOTIFICATIONS_ENABLED","false");const request=new Request("http://localhost/api/jobs/notifications",{headers:{Authorization:`Bearer ${"x".repeat(40)}`}});expect(await (await GET(request)).json()).toEqual({enabled:false});expect(worker).not.toHaveBeenCalled();vi.stubEnv("NOTIFICATIONS_ENABLED","true");expect((await GET(request)).status).toBe(200);expect(worker).toHaveBeenCalledTimes(1);});
});
