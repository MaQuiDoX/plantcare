export default function Loading() {
  return <div role="status" aria-label="Cargando colección" className="loading-state"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-banner" /><div className="skeleton skeleton-list" /><span className="sr-only">Cargando tus plantas…</span></div>;
}
