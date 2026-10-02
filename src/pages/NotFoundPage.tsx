import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="py-16 text-center">
      <h2 className="font-display text-7xl text-court">404</h2>
      <p className="mt-2 text-chalk-muted">Air ball: questa pagina non esiste.</p>
      <Link to="/" className="linkbtn mt-3 inline-block">← Torna all'inizio</Link>
    </div>
  );
}
