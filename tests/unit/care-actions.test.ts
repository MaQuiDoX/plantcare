import {beforeEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({user:vi.fn(),config:vi.fn(),profile:vi.fn(),cached:vi.fn(),admin:vi.fn(),rpc:vi.fn(),weather:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/features/auth/session",()=>({requireUser:mocks.user}));
vi.mock("@/features/care/queries",()=>({getCareProfile:mocks.profile,getSavedWeather:mocks.cached}));
vi.mock("@/features/care/weather",async(original)=>({...await original<typeof import("@/features/care/weather")>(),getWeatherConfig:mocks.config,weatherAdmin:mocks.admin,fetchWeather:mocks.weather}));
import {updateWeather} from "@/features/care/actions";
const owner="a7157311-ace0-4a59-9500-000000000001";
const token="c7157311-ace0-4a59-9500-000000000001";
beforeEach(()=>{
  vi.resetAllMocks();mocks.user.mockResolvedValue({id:owner});mocks.config.mockReturnValue({key:"private"});
  mocks.profile.mockResolvedValue({latitude:-34.6,longitude:-58.38,timezone:"America/Argentina/Buenos_Aires"});mocks.cached.mockResolvedValue(null);
  mocks.admin.mockReturnValue({rpc:mocks.rpc});mocks.rpc.mockResolvedValue({error:null,data:token});
  mocks.weather.mockResolvedValue({temperature:25,humidity:50,rain:0,observedAt:"2026-09-26T12:00:00Z"});
});
describe("acción de clima",()=>{
  it("exige sesión antes de cargar credenciales o consultar proveedores",async()=>{
    mocks.user.mockRejectedValue(new Error("UNAUTHENTICATED"));await expect(updateWeather()).rejects.toThrow("UNAUTHENTICATED");
    expect(mocks.config).not.toHaveBeenCalled();expect(mocks.weather).not.toHaveBeenCalled();
  });
  it("reutiliza clima vigente sin consumir una consulta",async()=>{
    mocks.cached.mockResolvedValue({fresh:true});expect(await updateWeather()).toMatchObject({status:"success"});
    expect(mocks.admin).not.toHaveBeenCalled();expect(mocks.weather).not.toHaveBeenCalled();
  });
  it("respeta la reserva de otra consulta",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:null});expect(await updateWeather()).toMatchObject({status:"error"});
    expect(mocks.weather).not.toHaveBeenCalled();
  });
  it("guarda el resultado con propietario de sesión y ubicación del perfil",async()=>{
    expect(await updateWeather()).toMatchObject({status:"success"});
    expect(mocks.rpc).toHaveBeenNthCalledWith(1,"claim_weather_fetch",{p_user:owner});
    expect(mocks.rpc).toHaveBeenLastCalledWith("finish_weather_fetch",expect.objectContaining({p_user:owner,p_token:token,p_lat:-34.6,p_lon:-58.38,p_temp:25}));
  });
  it("no inicia consultas sin ubicación ni credenciales",async()=>{
    mocks.profile.mockResolvedValue({latitude:null,longitude:null,timezone:"UTC"});expect(await updateWeather()).toMatchObject({status:"error"});expect(mocks.admin).not.toHaveBeenCalled();
    mocks.config.mockReturnValue(null);expect(await updateWeather()).toMatchObject({status:"error"});expect(mocks.weather).not.toHaveBeenCalled();
  });
});
