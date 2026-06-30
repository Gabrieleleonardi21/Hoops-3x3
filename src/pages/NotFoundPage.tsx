import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="tac" style={{ padding: "40px 0" }}>
      <h2 className="disp" style={{ fontSize: 48, margin: 0 }}>404</h2>
      <p style={{ fontStyle: "italic" }}>Air ball: questa pagina non esiste.</p>
      <Link to="/" className="linkbtn">← Torna all'inizio</Link>
    </div>
  );
}
