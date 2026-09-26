import Link from "next/link";
import { getAgenda, getCareProfile, getSavedWeather } from "@/features/care/queries";
import { getWeatherConfig } from "@/features/care/weather";
import { LocationForm, WeatherButton } from "@/features/care/forms";
import { AgendaCard, Calendar } from "@/features/care/agenda-view";
import { todayInTimezone } from "@/features/journal/validation";

export const metadata={title:"Agenda de riego"};
export default async function CarePage({searchParams}:{searchParams:Promise<{page?:string}>}) {
  const params=await searchParams;
  const requested=Number(params.page); const page=Number.isSafeInteger(requested)&&requested>0&&requested<=10000 ? requested:1;
  const [profile,agenda]=await Promise.all([getCareProfile(),getAgenda(page)]);
  const weather=await getSavedWeather(profile);
  const today=todayInTimezone(profile.timezone);
  return <><Link href="/plants" className="text-link">← Mi colección</Link><div className="editor-heading"><span className="eyebrow">EL RITMO DE TU JARDÍN</span><h1>Agenda de riego</h1><p>Un momento para revisar la humedad y decidir si tu planta necesita agua.</p></div>
    <p className="notice">La fecha es una estimación. Comprobá el sustrato y las necesidades de la especie antes de regar. Esta agenda se recalcula al consultarla; todavía no envía notificaciones.</p>
    <section className="weather-panel"><div><h2>El clima de tu zona</h2>{weather ? <><p className="weather-reading">{weather.temperature_c.toFixed(1)} °C <span>· Humedad {weather.humidity_percent} % · Lluvia última hora {weather.rain_mm} mm</span></p><p>{weather.fresh ? "Observación vigente" : "Observación vencida: no se usa para ajustar la agenda"} · {new Date(weather.observed_at).toLocaleString("es-AR",{timeZone:profile.timezone})}</p></> : <p>Sin observaciones guardadas para tu ubicación. Guardá las coordenadas y consultá el clima.</p>}<p className="field-hint">Datos: <a href="https://openweathermap.org/" target="_blank" rel="noreferrer">OpenWeather</a>. Temperatura exterior actual, no pronóstico ni medición dentro de tu casa.</p></div><WeatherButton configured={Boolean(getWeatherConfig())}/></section>
    <details className="care-location"><summary>Configurar ubicación y zona horaria</summary><LocationForm {...profile}/></details>
    <Calendar entries={agenda.entries} today={today}/>
    <div className="care-list">{agenda.entries.length ? agenda.entries.map((entry)=><AgendaCard key={entry.id} entry={entry}/>) : <section className="empty-collection"><h2>No hay agendas en esta página</h2><p>Abrí una planta de tu colección y elegí «Riego y cuidados» para configurar su intervalo base.</p><Link className="button button-primary" href="/plants">Ir a mis plantas</Link></section>}</div>
    {(agenda.count>12||page>1)&&<nav className="pagination" aria-label="Páginas de agenda">{page>1&&<Link href={`/plants/care?page=${page-1}`}>← Anterior</Link>}<span>Página {page} · {agenda.count} agendas</span>{page*12<agenda.count&&<Link href={`/plants/care?page=${page+1}`}>Siguiente →</Link>}</nav>}
  </>;
}
