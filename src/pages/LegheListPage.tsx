/** Pagina di selezione lega: mostra tutte le leghe dell'utente,
 *  permette di crearne una nuova, aprirla o eliminarla. */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAppStore } from "../stores/useAppStore";
import { GuestBanner } from "../components/auth/GuestBanner";
import { Input } from "../components/ui/Input";
import { INK, RED, RULE } from "../constants/colors";
import type { LegaMeta } from "../types";

function LegaCard({ m, onOpen, onDelete }: { m: LegaMeta; onOpen: () => void; onDelete: () => void }) {
  const date = m.ts ? new Date(m.ts).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : null;

  return (
    <div className="col gap-8" style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 16 }}>
      <div className="row between gap-8 items-start">
        <div className="disp up" style={{ fontSize: 18, flex: 1 }}>{m.nome}</div>
        {/* Elimina lega */}
        <button onClick={onDelete} className="linkbtn" style={{ color: INK, opacity: 0.4, flexShrink: 0 }}
          title="Elimina lega">×</button>
      </div>
      <div className="ui" style={{ fontSize: 12, opacity: 0.6 }}>
        {m.nTappe} {m.nTappe === 1 ? "tappa" : "tappe"}
        {date ? ` · ${date}` : ""}
      </div>
      <button onClick={onOpen} className="blackbtn" style={{ padding: "9px 14px", marginTop: 4 }}>
        Apri →
      </button>
    </div>
  );
}

export function LegheListPage() {
  const user      = useAppStore((s) => s.user);
  const leghe     = useAppStore((s) => s.leghe);
  const createLega  = useAppStore((s) => s.createLega);
  const selectLega  = useAppStore((s) => s.selectLega);
  const deleteLega  = useAppStore((s) => s.deleteLega);
  const navigate  = useNavigate();
  const [nome, setNome] = useState("");

  if (!user) return <Navigate to="/" replace />;

  const handleCreate = () => {
    if (!nome.trim()) return;
    createLega(nome);
    navigate("/lega");
  };

  const handleOpen = (id: string) => {
    selectLega(id);
    navigate("/lega");
  };

  const handleDelete = (m: LegaMeta) => {
    // Conferma prima di eliminare: i dati non sono recuperabili
    if (!window.confirm(`Eliminare la lega "${m.nome}" con tutte le sue tappe? L'operazione non è reversibile.`)) return;
    deleteLega(m.id);
  };

  return (
    <div>
      <GuestBanner text="Modalità Ospite: i dati sono salvati solo su questo browser." />

      <div style={{ borderBottom: `4px solid ${INK}`, paddingBottom: 16, marginBottom: 24 }}>
        <div className="disp up" style={{ fontSize: 28, marginBottom: 4 }}>
          Le mie <span className="t-orange">leghe</span>
        </div>
        <p style={{ fontSize: 14, fontStyle: "italic", margin: 0 }}>
          Ogni lega è un circuito indipendente con le sue tappe, squadre e statistiche.
        </p>
      </div>

      {/* Form creazione nuova lega */}
      <div className="row items-end wrap gap-10" style={{ marginBottom: 28 }}>
        <div style={{ flex: "1 1 260px", maxWidth: 360 }}>
          <Input
            label="Nome della nuova lega"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Es. Roma Streetball 2025"
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") handleCreate(); }}
          />
        </div>
        <button onClick={handleCreate} className="redbtn" style={{ padding: "10px 18px" }}>
          + Crea lega
        </button>
      </div>

      {/* Lista leghe esistenti */}
      {leghe.length === 0 ? (
        <p style={{ fontStyle: "italic", fontSize: 15, borderTop: `1px solid ${RULE}`, paddingTop: 20 }}>
          Nessuna lega ancora: crea la prima qui sopra.
        </p>
      ) : (
        <>
          <div className="ui up" style={{ fontSize: 11, letterSpacing: "0.1em", fontWeight: 700, marginBottom: 10, color: RED }}>
            {leghe.length} {leghe.length === 1 ? "lega" : "leghe"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
            {leghe.map((m) => (
              <LegaCard key={m.id} m={m} onOpen={() => handleOpen(m.id)} onDelete={() => handleDelete(m)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
