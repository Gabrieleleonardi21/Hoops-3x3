/** La card di un campetto nell'elenco: nome, indirizzo, distanza (solo con la posizione dell'utente), le caratteristiche scritte (D6:
 *  mai solo un'icona o un colore) e i due link a Google Maps, che non hanno bisogno della chiave. Nome, indirizzo e note li scrivono
 *  gli utenti: qui sono testo React, mai HTML. */
import type { Campetto } from "../../types/campetto";
import { fmtDistanza } from "../../utils/geo";
import { Badge } from "../ui/Badge";

interface Props {
  campetto: Campetto;
  selezionato: boolean;
  onSeleziona: (id: string) => void;
  /** Distanza dall'utente in km; assente senza la posizione */
  distanzaKm?: number;
}

/** Le caratteristiche di un campetto come etichette di testo, nell'ordine in cui si leggono: superficie e canestri sempre, poi quelle
 *  presenti; «Gratuito» o «A pagamento» sempre (è ciò che si vuole sapere prima di andarci) */
function etichette(c: Campetto): string[] {
  const voci = [c.superficie, `${c.canestri} canestri`];
  if (c.illuminato) voci.push("Illuminato");
  if (c.coperto) voci.push("Coperto");
  if (c.gratuito) voci.push("Gratuito");
  else voci.push("A pagamento");
  if (c.retine) voci.push("Retine");
  if (c.linee) voci.push("Linee");
  if (c.fontanella) voci.push("Fontanella");
  return voci;
}

/** Posizione nel formato `lat,lng` dei link di Google Maps: sono numeri validati da zod, non testo dell'utente */
const punto = (c: Campetto) => `${c.lat},${c.lng}`;

export function CampettoCard({ campetto: c, selezionato, onSeleziona, distanzaKm }: Props) {
  let bordo = "border-asphalt-700 hover:border-asphalt-500";
  if (selezionato) bordo = "border-court shadow-[inset_3px_0_0_var(--color-court)]";
  let luogo = c.citta;
  if (c.indirizzo) luogo = `${c.indirizzo}, ${c.citta}`;
  let tonoStato: "neutral" | "court" = "neutral";
  if (c.stato !== "buono") tonoStato = "court";
  return (
    <article aria-label={c.nome} className={`rounded border bg-asphalt-900 p-3 transition-colors ${bordo}`}>
      {/* La selezione (card e pin sulla mappa si seguono) è un pulsante; i link stanno fuori, perché non si annidano in un pulsante */}
      <button type="button" onClick={() => onSeleziona(c.id)} aria-pressed={selezionato} className="flex w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block font-display text-lg leading-tight text-chalk">{c.nome}</span>
          <span className="block text-xs text-chalk-muted">{luogo}</span>
        </span>
        {distanzaKm !== undefined && <span className="shrink-0 font-display text-base text-court">{fmtDistanza(distanzaKm)}</span>}
      </button>
      <div className="mt-2 flex flex-wrap gap-1">
        {etichette(c).map((testo) => <Badge key={testo}>{testo}</Badge>)}
        <Badge tone={tonoStato}>Stato: {c.stato}</Badge>
      </div>
      {c.note && <p className="mt-2 text-xs text-chalk-muted">{c.note}</p>}
      <div className="mt-2 flex gap-4 text-[13px]">
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${punto(c)}`} target="_blank" rel="noopener noreferrer"
          className="text-court hover:underline underline-offset-4">Indicazioni</a>
        <a href={`https://www.google.com/maps/search/?api=1&query=${punto(c)}`} target="_blank" rel="noopener noreferrer"
          className="text-chalk-muted hover:text-chalk hover:underline underline-offset-4">Apri in Google Maps</a>
      </div>
    </article>
  );
}
