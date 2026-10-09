/** Il form di un campetto, per aggiungerne uno o correggerlo (D6): i campi di `CampettoRequestDTO` con i limiti del server, la
 *  posizione in uno dei tre modi di D4 («Usa la mia posizione», un clic sulla mappa, latitudine e longitudine scritte a mano) e i
 *  controlli prima dell'invio, così un 400 del server non arriva per ciò che si può dire subito. `onSave` rifiuta la promessa se il
 *  server non accetta: il motivo compare sotto i pulsanti e i dati restano (come GiocatoreForm). Nome, indirizzo, città e note li
 *  scrive l'utente: qui sono valori di input e testo React, mai HTML. */
import { useEffect, useState, type ChangeEvent } from "react";
import { useInvio } from "../../hooks/useInvio";
import { usePosizione, type StatoPosizione } from "../../hooks/usePosizione";
import { MAX_CITTA_CAMPETTO, MAX_INDIRIZZO_CAMPETTO, MAX_NOME_CAMPETTO, MAX_NOTE_CAMPETTO } from "../../constants/rules";
import { STATI_CAMPETTO, SUPERFICI, type Campetto, type CampettoInput, type StatoCampetto, type Superficie } from "../../types/campetto";
import type { Coordinate } from "../../utils/geo";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { MappaCampetti } from "./MappaCampetti";

/** I campi come li tiene il form: i numeri sono testo finché non si invia, così si può scrivere «45,07» o cancellare tutto */
interface Bozza {
  nome: string;
  indirizzo: string;
  citta: string;
  lat: string;
  lng: string;
  superficie: Superficie;
  canestri: string;
  illuminato: boolean;
  coperto: boolean;
  gratuito: boolean;
  retine: boolean;
  linee: boolean;
  fontanella: boolean;
  stato: StatoCampetto;
  note: string;
}
type Spunta = "illuminato" | "coperto" | "gratuito" | "retine" | "linee" | "fontanella";
const SPUNTE: [Spunta, string][] = [
  ["illuminato", "Illuminato"], ["coperto", "Coperto"], ["gratuito", "Gratuito"], ["retine", "Retine"], ["linee", "Linee"], ["fontanella", "Fontanella"],
];

/** Un campetto nuovo: asfalto, due canestri, gratuito, in buono stato, senza posizione */
const VUOTA: Bozza = {
  nome: "", indirizzo: "", citta: "", lat: "", lng: "", superficie: "Asfalto", canestri: "2",
  illuminato: false, coperto: false, gratuito: true, retine: false, linee: false, fontanella: false, stato: "buono", note: "",
};

/** I messaggi dei controlli prima dell'invio */
const NOME_OBBLIGATORIO = "Il nome è obbligatorio.";
const POSIZIONE_OBBLIGATORIA = "La posizione è obbligatoria: usa la tua posizione, fai clic sulla mappa oppure scrivi latitudine e longitudine.";
const LAT_NON_VALIDA = "La latitudine deve essere un numero tra −90 e 90.";
const LNG_NON_VALIDA = "La longitudine deve essere un numero tra −180 e 180.";
const CANESTRI_NON_VALIDI = "I canestri devono essere un numero intero da 1 a 8.";
/** L'esito di «Usa la mia posizione» nel form: rimanda agli altri due modi quando non arriva */
const MESSAGGI_POSIZIONE: Partial<Record<StatoPosizione, string>> = {
  "in corso": "Sto leggendo la tua posizione…",
  concessa: "Posizione trovata: puoi ancora spostarla con un clic sulla mappa o correggendo le coordinate.",
  negata: "Posizione negata: fai clic sulla mappa oppure scrivi le coordinate.",
  "non disponibile": "Posizione non disponibile: fai clic sulla mappa oppure scrivi le coordinate.",
};

/** La bozza di un campetto esistente: i numeri come testo */
function bozzaDi(c: Campetto): Bozza {
  return {
    nome: c.nome, indirizzo: c.indirizzo, citta: c.citta, lat: String(c.lat), lng: String(c.lng), superficie: c.superficie,
    canestri: String(c.canestri), illuminato: c.illuminato, coperto: c.coperto, gratuito: c.gratuito, retine: c.retine, linee: c.linee,
    fontanella: c.fontanella, stato: c.stato, note: c.note,
  };
}

/** Un numero scritto dall'utente, anche con la virgola italiana; NaN se non è un numero (il campo vuoto compreso: Number("") è 0) */
function numero(testo: string): number {
  const pulito = testo.trim().replace(",", ".");
  if (!pulito) return NaN;
  return Number(pulito);
}

/** Una coordinata arrivata dalla mappa o dal browser, scritta nel campo con al massimo sei decimali (circa dieci centimetri) */
const scritta = (n: number) => String(Number(n.toFixed(6)));

/** Le coordinate della bozza se sono valide entrambe, altrimenti null: decide il pin provvisorio sulla mappa */
function puntoDi(b: Bozza): Coordinate | null {
  const lat = numero(b.lat);
  const lng = numero(b.lng);
  if (Number.isNaN(lat) || Math.abs(lat) > 90 || Number.isNaN(lng) || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** I controlli prima dell'invio: il motivo del primo che non passa, oppure ciò che si manda al server (`versione` solo in modifica) */
function valida(b: Bozza, versione: number | undefined): { errore: string } | { input: CampettoInput } {
  if (!b.nome.trim()) return { errore: NOME_OBBLIGATORIO };
  if (!b.lat.trim() && !b.lng.trim()) return { errore: POSIZIONE_OBBLIGATORIA };
  const lat = numero(b.lat);
  if (Number.isNaN(lat) || Math.abs(lat) > 90) return { errore: LAT_NON_VALIDA };
  const lng = numero(b.lng);
  if (Number.isNaN(lng) || Math.abs(lng) > 180) return { errore: LNG_NON_VALIDA };
  const canestri = numero(b.canestri);
  if (!Number.isInteger(canestri) || canestri < 1 || canestri > 8) return { errore: CANESTRI_NON_VALIDI };
  const input: CampettoInput = {
    nome: b.nome.trim(), indirizzo: b.indirizzo.trim(), citta: b.citta.trim(), lat, lng, superficie: b.superficie, canestri,
    illuminato: b.illuminato, coperto: b.coperto, gratuito: b.gratuito, retine: b.retine, linee: b.linee, fontanella: b.fontanella,
    stato: b.stato, note: b.note.trim(),
  };
  // Solo in modifica: un campetto nuovo non ha una versione, e la chiave assente non entra nel JSON
  if (versione !== undefined) input.versione = versione;
  return { input };
}

interface Props {
  /** Il campetto da correggere; assente per uno nuovo */
  campetto?: Campetto;
  /** I campetti mostrati nella pagina: sono i pin della mappa su cui si sceglie la posizione */
  campetti: Campetto[];
  onSave: (input: CampettoInput) => Promise<void>;
  onAnnulla: () => void;
}

export function CampettoForm({ campetto, campetti, onSave, onAnnulla }: Props) {
  const [b, setB] = useState<Bozza>(() => {
    if (campetto) return bozzaDi(campetto);
    return VUOTA;
  });
  const { invio, errore, setErrore, esegui } = useInvio();
  const posizione = usePosizione();
  const set = (k: keyof Bozza) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setB((prev) => ({ ...prev, [k]: e.target.value }));
  const spunta = (k: Spunta) => (e: ChangeEvent<HTMLInputElement>) => setB((prev) => ({ ...prev, [k]: e.target.checked }));
  const mettiPunto = (p: Coordinate) => setB((prev) => ({ ...prev, lat: scritta(p.lat), lng: scritta(p.lng) }));

  // La posizione del browser arriva con una callback dentro usePosizione, che la espone come stato: quando c'è (o c'è di nuovo, dopo
  // un altro «Usa la mia posizione») finisce nei campi, da cui si può ancora correggere
  const trovata = posizione.posizione;
  useEffect(() => {
    if (trovata) mettiPunto(trovata);
  }, [trovata]);

  const salva = async () => {
    const esito = valida(b, campetto?.versione);
    if ("errore" in esito) { setErrore(esito.errore); return; }
    await esegui(() => onSave(esito.input), "Salvataggio non riuscito");
  };

  // In modifica il campetto non sta tra i pin: al suo posto c'è il pin provvisorio, che segue i campi
  const altri = campetti.filter((c) => c.id !== campetto?.id);
  const messaggioPosizione = MESSAGGI_POSIZIONE[posizione.stato];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid-auto" style={{ "--min": "140px" } as React.CSSProperties}>
        <Input label="Nome *" value={b.nome} onChange={set("nome")} maxLength={MAX_NOME_CAMPETTO} />
        <Input label="Indirizzo" value={b.indirizzo} onChange={set("indirizzo")} maxLength={MAX_INDIRIZZO_CAMPETTO} />
        <Input label="Città" value={b.citta} onChange={set("citta")} maxLength={MAX_CITTA_CAMPETTO} />
        <label className="input-label">Superficie
          <select className="statin mt-1" value={b.superficie} onChange={set("superficie")}>
            {SUPERFICI.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <Input label="Canestri" type="number" min={1} max={8} value={b.canestri} onChange={set("canestri")} />
        <label className="input-label">Stato del campo
          <select className="statin mt-1" value={b.stato} onChange={set("stato")}>
            {STATI_CAMPETTO.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-chalk">
        {SPUNTE.map(([k, testo]) => (
          <label key={k} className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={b[k]} onChange={spunta(k)} className="accent-court" /> {testo}
          </label>
        ))}
      </div>

      {/* La posizione (D4): un fieldset, perché i tre modi scrivono gli stessi due campi */}
      <fieldset className="flex flex-col gap-2 rounded border border-asphalt-700 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-[0.06em] text-chalk-muted">Posizione *</legend>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={posizione.chiedi} disabled={posizione.stato === "in corso"}>
            <Icon name="pin" size={16} /> Usa la mia posizione
          </Button>
          {/* Lo status c'è sempre, anche vuoto: una regione viva che compare dopo non sempre viene annunciata */}
          <p role="status" className="m-0 text-[13px] text-chalk-muted">{messaggioPosizione}</p>
        </div>
        <p className="m-0 text-[13px] text-chalk-muted">Oppure fai clic sulla mappa nel punto del campo, o scrivi le coordinate.</p>
        <MappaCampetti campetti={altri} selezionato={null} onSeleziona={() => {}} onClicMappa={mettiPunto} pinProvvisorio={puntoDi(b) ?? undefined} />
        <div className="grid-auto" style={{ "--min": "140px" } as React.CSSProperties}>
          <Input label="Latitudine" inputMode="decimal" value={b.lat} onChange={set("lat")} placeholder="es. 41.9028" />
          <Input label="Longitudine" inputMode="decimal" value={b.lng} onChange={set("lng")} placeholder="es. 12.4964" />
        </div>
      </fieldset>

      <Input label="Note" value={b.note} onChange={set("note")} placeholder="es. accesso dal cancello di via Roma" maxLength={MAX_NOTE_CAMPETTO} />
      {errore && <p className="m-0 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}
      <div className="flex gap-2">
        <Button onClick={salva} disabled={invio}>Salva il campetto</Button>
        <Button variant="ghost" onClick={onAnnulla} disabled={invio}>Annulla</Button>
      </div>
    </div>
  );
}
