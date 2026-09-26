import { describe,it,expect,vi } from "vitest";
vi.mock("server-only",()=>({}));
import { calculatePot,recommendedDiameter,speciesGroup,recipes } from "@/features/care/calculator";
import { fetchWeather } from "@/features/care/weather";
import { locationSchema,freshWeather } from "@/features/care/schemas";

const pot={currentDiameter:15,state:"crowded" as const,group:"foliage" as const,top:20,bottom:20,height:20,headroom:0,rootDiameter:0,rootHeight:0};
const now=new Date("2026-09-26T12:00:00Z");
describe("calculadora de macetas",()=>{
  it("calcula un cilindro y descuenta un cepellón con margen",()=>{
    const result=calculatePot({...pot,rootDiameter:10,rootHeight:10});
    expect(result.capacity).toBeCloseTo(Math.PI*2,8);
    expect(result.rootLiters).toBeCloseTo(Math.PI/4,8);
    expect(result.prepare).toBeCloseTo((Math.PI*2-Math.PI/4)*1.1,8);
    expect(result.components.reduce((sum,c)=>sum+c.liters,0)).toBeCloseTo(result.prepare,8);
  });
  it("considera que el espacio superior de un cono tiene mayor diámetro",()=>{
    const result=calculatePot({...pot,bottom:10,headroom:10});
    expect(result.capacity).toBeCloseTo(Math.PI*10*(100+150+225)/12/1000,8);
  });
  it("rechaza cepellones que no caben y dimensiones imposibles",()=>{
    expect(()=>calculatePot({...pot,rootDiameter:21,rootHeight:10})).toThrow(/no cabe/);
    expect(()=>calculatePot({...pot,bottom:25})).toThrow();
    expect(()=>calculatePot({...pot,headroom:20})).toThrow();
    expect(()=>calculatePot({...pot,rootDiameter:0,rootHeight:5})).toThrow();
  });
  it("sugiere grupo solo para géneros reconocidos y conserva tamaño de plantas debilitadas",()=>{
    expect(speciesGroup("Monstera deliciosa")).toBe("foliage");
    expect(speciesGroup("Phalaenopsis amabilis")).toBe("orchid");
    expect(speciesGroup("Cactus de Navidad")).toBe("general");
    expect(recommendedDiameter(15,"stressed")).toBe(15);
    expect(recommendedDiameter(15,"crowded")).toBe(17.5);
    for(const recipe of Object.values(recipes)) expect(recipe.reduce((s,c)=>s+c.percent,0)).toBe(100);
  });
});
describe("ubicación y clima",()=>{
  it("acepta cero, redondea coordenadas y exige pares",()=>{
    expect(locationSchema.parse({latitude:"0",longitude:"0",timezone:"UTC"}).latitude).toBe(0);
    expect(locationSchema.parse({latitude:"-34.6037",longitude:"-58.3816",timezone:"America/Argentina/Buenos_Aires"})).toMatchObject({latitude:-34.60,longitude:-58.38});
    expect(locationSchema.safeParse({latitude:"",longitude:"20",timezone:"UTC"}).success).toBe(false);
    expect(locationSchema.safeParse({latitude:"",longitude:"",timezone:"Invalid/Timezone"}).success).toBe(false);
  });
  it("consulta en Celsius y valida la observación sin exponer la clave en errores",async()=>{
    const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({cod:200,dt:now.getTime()/1000,main:{temp:24,humidity:65},rain:{"1h":2}})));
    expect(await fetchWeather(-34.6,-58.38,"secret",now,transport)).toEqual({temperature:24,humidity:65,rain:2,observedAt:now.toISOString()});
    expect(String(transport.mock.calls[0][0])).toContain("units=metric");
    expect(transport.mock.calls[0][1]?.redirect).toBe("error");
  });
  it.each([[401,"auth"],[429,"quota"],[500,"unavailable"]])("clasifica HTTP %s sin reintentar",async(status,code)=>{
    const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response("secret",{status:Number(status)}));
    await expect(fetchWeather(0,0,"secret",now,transport)).rejects.toMatchObject({code});
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("rechaza observaciones antiguas y respuestas demasiado grandes",async()=>{
    const transport=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({cod:200,dt:now.getTime()/1000-14400,main:{temp:24,humidity:65}})));
    await expect(fetchWeather(0,0,"secret",now,transport)).rejects.toMatchObject({code:"stale"});
    transport.mockResolvedValue(new Response("x".repeat(40000)));
    await expect(fetchWeather(0,0,"secret",now,transport)).rejects.toMatchObject({code:"invalid"});
  });
  it("ignora cache vencida aunque los valores parezcan válidos",()=>{
    expect(freshWeather({temperature_c:20,humidity_percent:50,rain_mm:0,fetched_at:now.toISOString(),observed_at:now.toISOString(),expires_at:"2026-09-26T11:00:00Z"},now)).toBe(false);
  });
});
