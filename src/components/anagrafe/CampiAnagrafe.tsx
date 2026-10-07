/** I campi di un giocatore e di una squadra dell'anagrafe, gli stessi nel form di creazione e nella scheda in modifica (FP-5).
 *  I campi di testo hanno i maxLength di GiocatoreRequestDTO e SquadraRequestDTO: oltre, il server risponde 400. Sui campi numerici
 *  il browser ignora maxLength: il limite di caratteri lo controlla solo il server, che lo dice nel messaggio di errore. */
import { useId, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import { REG_ROLES } from "../../constants/roles";
import { Input } from "../ui/Input";
import type { GiocatoreInput, SquadraInput } from "../../services/anagrafeApi";
import type { RegSquadra } from "../../types";

/** I dati di una squadra che questi campi scrivono: il roster ha la sua interfaccia, solo nel form di creazione */
type DatiSquadra = Omit<SquadraInput, "roster">;

/** «Nome *» dove il campo è obbligatorio e lo si segna (nel form di creazione), altrimenti «Nome» */
function etichetta(testo: string, segna: boolean): string {
  if (segna) return `${testo} *`;
  return testo;
}

export function CampiGiocatore({ valori, set, segnaObbligatori = false, squadre, griglia }: {
  valori: GiocatoreInput;
  /** Il gestore del campo `k` (un input, o la select del ruolo) */
  set: (k: keyof GiocatoreInput) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  /** Asterisco su nome e cognome */
  segnaObbligatori?: boolean;
  /** Le squadre registrate, suggerite nel campo «Squadra» */
  squadre?: RegSquadra[];
  /** Stile della griglia: nella scheda, più stretta, le colonne sono più piccole */
  griglia?: CSSProperties;
}) {
  // Un id per ogni form: la creazione e la scheda possono stare nella stessa pagina
  const idSquadre = useId();
  let suggerimenti: string | undefined;
  if (squadre) suggerimenti = idSquadre;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid-auto" style={griglia}>
        <Input label={etichetta("Nome", segnaObbligatori)} value={valori.nome} onChange={set("nome")} maxLength={80} />
        <Input label={etichetta("Cognome", segnaObbligatori)} value={valori.cognome} onChange={set("cognome")} maxLength={80} />
        <Input label="Soprannome" value={valori.soprannome} onChange={set("soprannome")} placeholder="da campo" maxLength={80} />
        <Input label="Data di nascita" type="date" value={valori.nascita} onChange={set("nascita")} />
        <Input label="Città" value={valori.citta} onChange={set("citta")} maxLength={120} />
        <Input label="Nazionalità" value={valori.nazionalita} onChange={set("nazionalita")} maxLength={80} />
        <Input label="Altezza (cm)" type="number" min={0} value={valori.altezza} onChange={set("altezza")} />
        <Input label="Peso (kg)" type="number" min={0} value={valori.peso} onChange={set("peso")} />
        <label className="input-label">Ruolo
          <select className="statin mt-1" value={valori.ruolo} onChange={set("ruolo")}>
            {REG_ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <Input label="N. maglia" type="number" min={0} value={valori.numero} onChange={set("numero")} />
        <Input label="Squadra" value={valori.squadra} onChange={set("squadra")} list={suggerimenti} maxLength={120} />
        <Input label="Anni di esperienza" type="number" min={0} value={valori.esperienza} onChange={set("esperienza")} />
      </div>
      {squadre && (
        <datalist id={idSquadre}>
          {squadre.map((s) => <option key={s.id} value={s.nome} />)}
        </datalist>
      )}
      <Input label="Note sportive" value={valori.note} onChange={set("note")} placeholder="es. tiratore da fuori, ex serie C" maxLength={2000} />
    </div>
  );
}

export function CampiSquadra({ valori, set, segnaObbligatori = false, children }: {
  valori: DatiSquadra;
  /** Il gestore del campo `k` */
  set: (k: keyof DatiSquadra) => (e: ChangeEvent<HTMLInputElement>) => void;
  /** Asterisco sul nome */
  segnaObbligatori?: boolean;
  /** Ciò che sta tra i dati e le note: il roster, nel form di creazione */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid-auto">
        <Input label={etichetta("Nome squadra", segnaObbligatori)} value={valori.nome} onChange={set("nome")} maxLength={120} />
        <Input label="Città" value={valori.citta} onChange={set("citta")} maxLength={120} />
        <Input label="Anno di fondazione" type="number" value={valori.anno} onChange={set("anno")} />
        <Input label="Ranking circuito (punti)" type="number" min={0} value={valori.rank} onChange={set("rank")} />
        <Input label="Referente / capitano" value={valori.referente} onChange={set("referente")} maxLength={120} />
        <Input label="Logo (URL o /logos/nome.svg)" value={valori.logo} onChange={set("logo")} placeholder="/logos/squadra.svg" maxLength={500} />
        <Input label="Sito web (opzionale)" value={valori.website} onChange={set("website")} placeholder="https://squadra.it" maxLength={500} />
        <Input label="Instagram (opzionale)" value={valori.instagram} onChange={set("instagram")} placeholder="https://instagram.com/squadra" maxLength={500} />
      </div>
      {children}
      <Input label="Note" value={valori.note} onChange={set("note")} placeholder="es. campioni tappa di Roma 2025" maxLength={2000} />
    </div>
  );
}
