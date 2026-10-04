/** Pagina principale della lega attiva: gestisce nome, creazione, lista tappe e classifica circuito. */
import { useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { useLega } from "../hooks/useLega";
import type { NuovaTappaInput } from "../hooks/useLega";
import { TappaForm } from "../components/tappa/TappaForm";
import { TappaCard } from "../components/tappa/TappaCard";
import { GuestBanner } from "../components/auth/GuestBanner";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Section } from "../components/ui/Section";
import { ApiError } from "../services/api";
import { useAppStore } from "../stores/useAppStore";
import { leggiFileLega, testoFileLega } from "../utils/legaFile";

export function LegaPage() {
  const { user, legaName, tappe, setLegaName, createTappa } = useLega();
  const legaId    = useAppStore((s) => s.legaId);
  const importLega = useAppStore((s) => s.importLega);
  const navigate  = useNavigate();
  const fileRef   = useRef<HTMLInputElement>(null);
  /** Perché l'ultimo import non è riuscito: resta finché non si sceglie un altro file */
  const [erroreImport, setErroreImport] = useState<string | null>(null);

  /** Crea la tappa e la apre; se i dati sono fuori dai limiti restituisce il motivo, che il form mostra */
  const creaEApri = (input: NuovaTappaInput) => {
    const esito = createTappa(input);
    if (!esito.ok) return esito.errore;
    navigate(`/lega/tappa/${esito.tappa.id}`);
    return null;
  };

  /** Scarica la lega corrente come file JSON. */
  const esportaLega = () => {
    const blob = new Blob([testoFileLega(legaName, tappe)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${legaName.replace(/\s+/g, "_") || "lega"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Dice nella pagina perché l'import non è riuscito: la lega aperta resta com'era */
  const rifiutaImport = (motivo: string) => setErroreImport(`Import non riuscito: ${motivo}`);

  /** Controlla il testo del file, poi importa la lega. Il file è input non fidato: se non è una lega valida non arriva
   *  né nel browser né al server (leggiFileLega). Ogni esito negativo finisce in un messaggio nella pagina. */
  const importaDaTesto = async (testo: string, nomeFile: string) => {
    try {
      const esito = leggiFileLega(testo, nomeFile);
      if (!esito.ok) {
        rifiutaImport(esito.errore);
        return;
      }
      await importLega(esito.lega.nome, esito.lega.tappe);
      navigate("/lega");
    } catch (e) {
      // Il server risponde con il campo sbagliato (per esempio «tappe[0].nome: …»); l'ospite può fallire solo nel salvataggio nel browser
      if (e instanceof ApiError) rifiutaImport(e.message);
      else rifiutaImport("errore imprevisto");
    }
  };

  /** Importa una lega da un file JSON selezionato dall'utente. */
  const importaLega = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroreImport(null);
    const reader = new FileReader();
    reader.onload = () => { void importaDaTesto(String(reader.result), file.name); };
    // File spostato o senza permessi dopo averlo scelto
    reader.onerror = () => rifiutaImport("impossibile leggere il file");
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
          {/* Input file nascosto: .json è solo un suggerimento al selettore dei file; il contenuto, che è input non fidato, si controlla in leggiFileLega */}
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={importaLega} />
        </div>
        {/* Sulla riga sotto (w-full): il motivo per cui l'ultimo import non è riuscito */}
        {erroreImport && <p className="w-full text-[13px] font-semibold text-loss" role="alert">{erroreImport}</p>}
      </div>

      <TappaForm onCreate={creaEApri} />

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
