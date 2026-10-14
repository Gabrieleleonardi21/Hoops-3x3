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
import { eSegnaposto } from "../domain/tappaOps";
import { MAX_NOME_LEGA } from "../constants/rules";
import { leggiFileLega, testoFileLega } from "../utils/legaFile";
import { tipoFile, type TipoFile } from "../utils/tipoFile";
import { fileDaFogli } from "../utils/foglioTappa";
import {
  FILE_NON_SUPPORTATO, FOTO_RISERVATA, FOTO_TROPPO_GRANDE, JSON_TROPPO_GRANDE, SCELTA_FILE, TROPPE_FOTO,
} from "../utils/testi";
import { useImportaFoto } from "../hooks/useImportaFoto";
import { useUtente } from "../hooks/useUtente";
import { DialogoDubbi, type TappaDubbi } from "../components/lega/DialogoDubbi";
import type { BozzaFoglio, Lega } from "../types";

/** Limiti di «Importa file» (D5): fino a 10 foto per volta, 20 MB l'una prima della riduzione (il browser la tiene tutta in
 *  memoria per ridurla); un JSON fino a 5 MB (un file di lega vero pesa poche centinaia di KB, uno enorme bloccherebbe la scheda) */
const MAX_FOTO = 10;
const MAX_BYTE_FOTO = 20 * 1024 * 1024;
const MAX_BYTE_JSON = 5 * 1024 * 1024;
/** Ciò che il selettore dei file propone: solo un suggerimento, il tipo vero si legge dai primi byte (tipoFile) */
const FILE_ACCETTATI = ".json,application/json,image/jpeg,image/png,image/webp";

/** Perché i file scelti non si possono importare, o null se vanno bene: un JSON da solo, oppure da 1 a 10 foto per chi ha un account
 *  (la lettura passa da un fornitore a pagamento, come il Coach) */
function erroreScelta(files: File[], tipi: (TipoFile | null)[], ospite: boolean): string | null {
  const ignoto = files.find((_, i) => tipi[i] === null);
  if (ignoto) return FILE_NON_SUPPORTATO(ignoto.name);
  if (tipi.includes("json")) {
    if (files.length > 1) return SCELTA_FILE;
    if (files[0].size > MAX_BYTE_JSON) return JSON_TROPPO_GRANDE;
    return null;
  }
  if (files.length > MAX_FOTO) return TROPPE_FOTO;
  if (ospite) return FOTO_RISERVATA;
  const grande = files.find((f) => f.size > MAX_BYTE_FOTO);
  if (grande) return FOTO_TROPPO_GRANDE(grande.name);
  return null;
}

export function LegaPage() {
  const { legaName, tappe, setLegaName, createTappa } = useLega();
  const legaId    = useAppStore((s) => s.legaId);
  const importLega = useAppStore((s) => s.importLega);
  const navigate  = useNavigate();
  const utente    = useUtente();
  const fileRef   = useRef<HTMLInputElement>(null);
  /** Perché l'ultimo import non è riuscito: resta finché non si sceglie un altro file */
  const [erroreImport, setErroreImport] = useState<string | null>(null);
  const { leggiFoto, stato: statoLettura } = useImportaFoto();
  /** Le tappe appena importate dalle foto con i loro dubbi: finché c'è, la finestra dei dubbi è aperta */
  const [dubbi, setDubbi] = useState<TappaDubbi[] | null>(null);

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
   *  né nel browser né al server (leggiFileLega). Ogni esito negativo finisce in un messaggio nella pagina.
   *  @returns la lega importata, null se l'import non è riuscito */
  const importaDaTesto = async (testo: string, nomeFile: string): Promise<Lega | null> => {
    try {
      const esito = leggiFileLega(testo, nomeFile);
      if (!esito.ok) {
        rifiutaImport(esito.errore);
        return null;
      }
      await importLega(esito.lega.nome, esito.lega.tappe);
      navigate("/lega");
      return esito.lega;
    } catch (e) {
      // Il server risponde con il campo sbagliato (per esempio «tappe[0].nome: …»); l'ospite può fallire solo nel salvataggio nel browser
      if (e instanceof ApiError) rifiutaImport(e.message);
      else rifiutaImport("errore imprevisto");
      return null;
    }
  };

  /** Importa una lega da un file JSON: il testo con FileReader e poi importaDaTesto */
  const importaJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => { void importaDaTesto(String(reader.result), file.name); };
    // File spostato o senza permessi dopo averlo scelto
    reader.onerror = () => rifiutaImport("impossibile leggere il file");
    reader.readAsText(file);
  };

  /** Importa le foto dei fogli: le bozze lette diventano il file di una lega nuova (fileDaFogli) e si importano dalla stessa strada
   *  del JSON. Una foto non letta ferma tutto: nessuna lega a metà. A import fatto si apre la finestra dei dubbi */
  const importaFoto = async (foto: File[]) => {
    let bozze: BozzaFoglio[];
    try {
      bozze = await leggiFoto(foto);
    } catch (e) {
      if (e instanceof Error) rifiutaImport(e.message);
      else rifiutaImport("errore imprevisto");
      return;
    }
    const file = fileDaFogli(bozze, foto.map((f) => f.name));
    if (!file.ok) {
      rifiutaImport(file.errore);
      return;
    }
    const lega = await importaDaTesto(file.testo, "foglio.json");
    if (lega) setDubbi(lega.tappe.map((t, i) => ({ nome: t.nome, dubbi: file.dubbi[i] })));
  };

  /** «Importa file»: un JSON di HOOP 3X3 oppure da 1 a 10 foto di fogli. Il tipo si legge dai primi byte di ogni file (tipoFile),
   *  non dall'estensione; formati, numero e dimensioni si controllano prima di leggere o mandare qualcosa. */
  const importaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    // Resetta il campo così si può scegliere di nuovo lo stesso file (i File sono già copiati sopra)
    e.target.value = "";
    if (files.length === 0) return;
    setErroreImport(null);
    let tipi: (TipoFile | null)[];
    try {
      tipi = await Promise.all(files.map(tipoFile));
    } catch {
      rifiutaImport("impossibile leggere il file");
      return;
    }
    const errore = erroreScelta(files, tipi, utente.guest);
    if (errore) {
      rifiutaImport(errore);
      return;
    }
    if (tipi[0] === "json") importaJson(files[0]);
    else await importaFoto(files);
  };

  // Classifica circuito: aggrega tutte le squadre da tutte le tappe, prende il rank massimo per squadra (nome case-insensitive) e
  // ordina in modo decrescente. Le squadre con il nome segnaposto («Squadra 3», mai scritto da nessuno) restano fuori, e lo stesso
  // chi non ha punti ranking in nessuna tappa: una riga a «—» non classifica niente.
  // Deve stare prima degli early return per rispettare le rules-of-hooks
  const circuitRanking = useMemo(() => {
    const map = new Map<string, { nome: string; rank: number; nTappe: number }>();
    for (const tappa of tappe) {
      for (const s of tappa.squadre) {
        if (eSegnaposto(s.nome)) continue;
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
    return [...map.values()].filter((r) => r.rank > 0).sort((a, b) => b.rank - a.rank);
  }, [tappe]);

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
          {/* Il nome non va oltre il limite del server (PatchLegaDTO): oltre, la rinomina sarebbe un 400 */}
          <Input label="La tua lega — circuito italiano 3x3" labelClassName="form-label"
            value={legaName} onChange={(e) => setLegaName(e.target.value)} maxLength={MAX_NOME_LEGA}
            placeholder="Es. Roma Streetball League" className="font-display text-2xl h-12" />
        </div>
        {/* Esporta JSON / Importa file (JSON o foto dei fogli). Disattivato mentre le foto si leggono: un secondo import partirebbe
            sopra il primo */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={esportaLega}><Icon name="download" size={14} /> Esporta JSON</Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={statoLettura !== null}>
            <Icon name="upload" size={14} /> Importa file
          </Button>
          {/* Un solo input file nascosto: `accept` è solo un suggerimento al selettore dei file; il tipo vero si legge dai byte
              (tipoFile) e il contenuto, che è input non fidato, si controlla in leggiFileLega */}
          <input ref={fileRef} type="file" accept={FILE_ACCETTATI} multiple className="hidden"
            onChange={(e) => { void importaFile(e); }} />
        </div>
        {/* Sulla riga sotto (w-full): a che foglio è la lettura, annunciato senza interrompere */}
        {statoLettura && <p className="w-full text-[13px] text-chalk-muted" aria-live="polite">{statoLettura}</p>}
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
                    <td className="font-semibold text-court">{row.v}</td>
                    <td className="text-chalk-muted">{row.g}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Dopo l'import dalle foto: i dubbi del lettore e la scelta di passare le correzioni al Coach */}
      {dubbi && <DialogoDubbi tappe={dubbi} onCoach={() => setDubbi(null)} onChiudi={() => setDubbi(null)} />}
    </>
  );
}
