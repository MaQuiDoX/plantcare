import Link from "next/link";
export default function NotFound() {
  return <main id="main" className="standalone"><div className="standalone-card"><span className="eyebrow">404</span><h1>Por acá todavía no crece nada.</h1><p>La página que buscás no existe.</p><Link className="button button-primary" href="/plants">Volver a Mis Plantas</Link></div></main>;
}
