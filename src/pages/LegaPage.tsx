/** Pagina principale della lega attiva: gestisce nome, creazione, lista tappe e classifica circuito. */
import { useMemo, useRef } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useLega } from "../hooks/useLega";
import { TappaForm } from "../components/tappa/TappaForm";
import { TappaCard } from "../components/tappa/TappaCard";
import { GuestBanner } from "../components/auth/GuestBanner";
import { Input } from "../components/ui/Input";
import { INK, ORANGE, RULE } from "../constants/colors";
import { useAppStore } from "../stores/useAppStore";
import type { Tappa } from "../types";

export function LegaPage() {
  const { user, legaName, tappe, setLegaName, createTappa } = useLega();
  const legaId    = useAppStore((s) => s.legaId);
  const importLega = useAppStore((s) => s.importLega);
  const navigate  = useNavigate();
  const fileRef   = useRef<HTMLInputElement>(null);

  /** Scarica la lega corrente come file JSON. */
  const esportaLega = () => {
    const blob = new Blob(
      [JSON.stringify({ nome: legaName, tappe }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${legaName.replace(/\s+/g, "_") || "lega"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Importa una lega da un file JSON selezionato dall'utente. */
  const importaLega = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as { nome?: string; tappe?: Tappa[] };
        if (!Array.isArray(data.tappe)) { alert("File non valido: manca il campo 'tappe'."); return; }
        importLega(data.nome ?? file.name.replace(".json", ""), data.tappe);
        navigate("/lega");
      } catch {
        alert("File JSON non valido.");
      }
    };
    reader.readAsText(file);
    // Resetta il file input così si può reimportare lo stesso file
    e.target.value = "";
  };

  // Classifica circuito: aggrega tutte le squadre da tutte le tappe,
  // prende il rank massimo per squadra (nome case-insensitive) e ordina in modo decrescente
  // Deve stare prima degli early return per rispettare le rules-of-hooks
  const circuitRanking = useMemo(() => {
    const map = new Map<string, { nome: string; rank: number; nTappe: number }>();
    for (const tappa of tappe) {
      for (const s of tappa.squadre) {
        const key = s.nome.trim().toLowerCase();
        const r = Number(s.rank) || 0;
        const cur = map.get(key);
        if (cur) {
          cur.rank = Math.max(cur.rank, r);
          cur.nTappe += 1;
        } else {
          map.set(key, { nome: s.nome.trim(), rank: r, nTappe: 1 });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.rank - a.rank);
  }, [tappe]);

  if (!user) return <Navigate to="/" replace />;
  // Se nessuna lega è attiva, manda alla lista per selezionarne una
  if (!legaId) return <Navigate to="/leghe" replace />;

  return (
    <>
      <GuestBanner text="Modalità Ospite: i dati sono salvati solo su questo browser, non sincronizzati tra dispositivi. I controlli obbligatori su roster e punti sono disattivati. Registrati per la gestione completa." />

      {/* Breadcrumb di navigazione verso la lista leghe */}
      <div style={{ marginBottom: 14 }}>
        <Link to="/leghe" className="linkbtn" style={{ fontSize: 12.5, color: INK, opacity: 0.6 }}>
          ← Le mie leghe
        </Link>
      </div>

      <div style={{ maxWidth: 420, marginBottom: 10 }}>
        <Input label="La tua lega — circuito italiano 3x3"
          labelStyle={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}
          value={legaName} onChange={(e) => setLegaName(e.target.value)}
          placeholder="Es. Roma Streetball League" />
      </div>

      {/* Import / Export JSON */}
      <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
        <button onClick={esportaLega} className="blackbtn" style={{ padding: "8px 14px", fontSize: 12 }}>
          Esporta JSON
        </button>
        <button onClick={() => fileRef.current?.click()} className="blackbtn" style={{ padding: "8px 14px", fontSize: 12 }}>
          Importa JSON
        </button>
        {/* Input file nascosto: sicuro perché accetta solo .json e il contenuto è parsato */}
        <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={importaLega} />
      </div>

      <TappaForm onCreate={(input) => { const t = createTappa(input); navigate(`/lega/tappa/${t.id}`); }} />

      {tappe.length > 0 ? (
        <section style={{ borderTop: `4px solid ${INK}` }}>
          <div className="ui" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", margin: "10px 0 2px", fontWeight: 700 }}>
            Le tappe del circuito
          </div>
          {tappe.map((t) => (
            <TappaCard key={t.id} t={t} onOpen={() => navigate(`/lega/tappa/${t.id}`)} />
          ))}
        </section>
      ) : (
        <p style={{ fontStyle: "italic", fontSize: 15 }}>Nessuna tappa in calendario: crea la prima qui sopra.</p>
      )}

      {/* Classifica circuito — visibile solo se ci sono squadre con rank */}
      {circuitRanking.length > 0 && (
        <section style={{ borderTop: `4px solid ${INK}`, marginTop: 24 }}>
          <div className="ui" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", margin: "10px 0 8px", fontWeight: 700 }}>
            Classifica circuito
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${INK}` }}>
                <th className="ui" style={{ textAlign: "left", fontSize: 11, fontWeight: 700, padding: "4px 8px", width: 32 }}>#</th>
                <th className="ui" style={{ textAlign: "left", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>Squadra</th>
                <th className="ui" style={{ textAlign: "right", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>Punti</th>
                <th className="ui" style={{ textAlign: "right", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>Tappe</th>
              </tr>
            </thead>
            <tbody>
              {circuitRanking.map((row, i) => (
                <tr key={row.nome} style={{ borderBottom: `1px solid ${RULE}`, background: i === 0 ? "var(--card)" : "transparent" }}>
                  <td className="disp" style={{ fontSize: 13, padding: "6px 8px", color: i < 3 ? ORANGE : INK, fontWeight: 700 }}>
                    {i + 1}
                  </td>
                  <td className="disp" style={{ fontSize: 14, padding: "6px 8px", textTransform: "uppercase" }}>{row.nome}</td>
                  <td className="ui" style={{ fontSize: 13, fontWeight: 700, padding: "6px 8px", textAlign: "right", color: ORANGE }}>
                    {row.rank > 0 ? row.rank : "—"}
                  </td>
                  <td className="ui" style={{ fontSize: 12, padding: "6px 8px", textAlign: "right", opacity: 0.6 }}>{row.nTappe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
