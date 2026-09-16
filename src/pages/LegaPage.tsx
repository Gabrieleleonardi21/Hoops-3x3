/** Pagina principale della lega attiva: gestisce nome, creazione, lista tappe e classifica circuito. */
import { useMemo, useRef } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useLega } from "../hooks/useLega";
import { TappaForm } from "../components/tappa/TappaForm";
import { TappaCard } from "../components/tappa/TappaCard";
import { GuestBanner } from "../components/auth/GuestBanner";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Section } from "../components/ui/Section";
import { StandingsTable } from "../components/leaderboard/StandingsTable";
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

  // La classifica circuito riusa StandingsTable: rank = punti circuito, "gare" = tappe giocate
  const circuitRows = circuitRanking.map((r) => ({ id: r.nome, nome: r.nome, g: r.nTappe, v: r.rank, p: 0, pf: 0, ps: 0 }));

  return (
    <>
      <GuestBanner text="Modalità Ospite: i dati sono salvati solo su questo browser, non sincronizzati tra dispositivi. I controlli obbligatori su roster e punti sono disattivati. Registrati per la gestione completa." />

      {/* Breadcrumb di navigazione verso la lista leghe */}
      <Link to="/leghe" className="mb-3 inline-flex items-center gap-1 text-[13px] text-chalk-muted hover:text-chalk">
        <Icon name="arrowLeft" size={14} /> Le mie leghe
      </Link>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] max-w-md flex-1">
          <Input label="La tua lega — circuito italiano 3x3" labelClassName="form-label"
            value={legaName} onChange={(e) => setLegaName(e.target.value)}
            placeholder="Es. Roma Streetball League" className="font-display text-2xl h-12" />
        </div>
        {/* Import / Export JSON */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={esportaLega}><Icon name="download" size={14} /> Esporta JSON</Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Icon name="upload" size={14} /> Importa JSON</Button>
          {/* Input file nascosto: sicuro perché accetta solo .json e il contenuto è parsato */}
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={importaLega} />
        </div>
      </div>

      <TappaForm onCreate={(input) => { const t = createTappa(input); navigate(`/lega/tappa/${t.id}`); }} />

      <Section title="Le tappe del circuito" kicker={`${tappe.length} ${tappe.length === 1 ? "tappa" : "tappe"}`}>
        {tappe.length > 0 ? (
          <div className="rounded border border-asphalt-700 bg-asphalt-900 px-3">
            {tappe.map((t) => <TappaCard key={t.id} t={t} onOpen={() => navigate(`/lega/tappa/${t.id}`)} />)}
          </div>
        ) : (
          <p className="text-[15px] text-chalk-muted">Nessuna tappa in calendario: crea la prima qui sopra.</p>
        )}
      </Section>

      {/* Classifica circuito — visibile solo se ci sono squadre con rank */}
      {circuitRanking.length > 0 && (
        <Section title="Classifica circuito" kicker="Punti ranking · tappe giocate">
          <div className="overflow-x-auto rounded border border-asphalt-700">
            <table className="standtable">
              <caption className="sr-only">Classifica circuito</caption>
              <thead>
                <tr><th className="w-9" scope="col">#</th><th className="text-left" scope="col">Squadra</th><th className="w-20" scope="col">Punti</th><th className="w-16" scope="col">Tappe</th></tr>
              </thead>
              <tbody>
                {circuitRows.map((row, i) => (
                  <tr key={row.id}>
                    <td className={`font-display text-base ${i === 0 ? "text-court" : "text-chalk-muted"}`}>{i + 1}</td>
                    <td className="tname font-display text-base">{row.nome}</td>
                    <td className="font-semibold text-court">{row.v > 0 ? row.v : "—"}</td>
                    <td className="text-chalk-muted">{row.g}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}
