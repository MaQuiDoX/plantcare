"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main" className="standalone"><div className="standalone-card"><h1>No pudimos cargar este espacio.</h1><p>Hubo un problema al conectar con los datos. Volvé a intentarlo en un momento.</p><div className="button-row"><button className="button button-primary" onClick={reset}>Volver a intentar</button><Link className="button button-secondary" href="/login">Ir al inicio</Link></div></div></main>;
}
