/** Campetti: i campi da streetball del circuito, dall'API (`GET /api/campetti`, D9). All'apertura quelli intorno a Roma; con «Usa la mia
 *  posizione» quelli intorno all'utente, con le distanze e in ordine di distanza; la casella di ricerca cerca per nome o città su tutta
 *  l'Italia. I filtri lavorano sui risultati, nel browser. La mappa (MappaCampetti) inquadra solo i campetti mostrati. La posizione
 *  dell'utente va al nostro server solo come centro della ricerca (lat/lng), mai a Google (D7). Aggiunta e modifica: Task 4. */
import { useEffect, useMemo, useState } from "react";
import { STATI_CAMPETTO, type Campetto, type StatoCampetto } from "../types/campetto";
import type { RicercaCampetti } from "../services/campettiApi";
import { useCampettiStore } from "../stores/useCampettiStore";
import { usePosizione } from "../hooks/usePosizione";
import { distanzaKm, type Coordinate } from "../utils/geo";
import { conteggio } from "../utils/testi";
import { MappaCampetti } from "../components/campetti/MappaCampetti";
import { PosizioneUtente } from "../components/campetti/PosizioneUtente";
import { CampettoCard } from "../components/campetti/CampettoCard";
import { ErroreCaricamento } from "../components/ui/ErroreCaricamento";
import { Loading } from "../components/ui/Loading";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";

/** Dove si apre la pagina (contratto della fase 5) e il raggio della ricerca intorno a un punto, anche intorno all'utente */
const ROMA: Coordinate = { lat: 41.9028, lng: 12.4964 };
const RAGGIO_KM = 20;
/** Attesa dopo l'ultimo tasto prima di interrogare il server: una richiesta per parola, non per lettera */
const ATTESA_RICERCA_MS = 300;

type Filtro = "illuminato" | "coperto" | "gratuito" | "canestri" | "retine" | "fontanella";
const FILTRI: [Filtro, string][] = [
  ["illuminato", "Illuminato"], ["coperto", "Coperto"], ["canestri", "4 canestri"], ["gratuito", "Gratuito"], ["retine", "Retine"], ["fontanella", "Fontanella"],
];

/** true se il campetto passa il filtro */
function passa(c: Campetto, f: Filtro): boolean {
  if (f === "canestri") return c.canestri >= 4;
  return c[f];
}

/** Per città e poi per nome, come il server senza posizione: i filtri non cambiano l'ordine ma lo si rende esplicito */
const perCittaENome = (a: Campetto, b: Campetto) => a.citta.localeCompare(b.citta) || a.nome.localeCompare(b.nome);

export function CampettiPage() {
  const [q, setQ] = useState("");
  /** Il testo della casella com'era ATTESA_RICERCA_MS fa: è quello che va al server */
  const [testo, setTesto] = useState("");
  const [filtri, setFiltri] = useState<Set<Filtro>>(new Set());
  const [stato, setStato] = useState<"" | StatoCampetto>("");
  const [sel, setSel] = useState<string | null>(null);
  const posizioneUtente = usePosizione();
  const { campetti, errore, carica } = useCampettiStore();

  useEffect(() => {
    const timer = setTimeout(() => setTesto(q.trim()), ATTESA_RICERCA_MS);
    return () => clearTimeout(timer);
  }, [q]);

  /** La ricerca che vale adesso (D9): il testo su tutta l'Italia (con la posizione, se c'è, per l'ordine di distanza); altrimenti i
   *  campetti intorno all'utente o, senza posizione, intorno a Roma. Lo store scarta le risposte delle ricerche superate */
  const posizione = posizioneUtente.posizione;
  const ricerca = useMemo<RicercaCampetti>(() => {
    if (testo && posizione) return { q: testo, lat: posizione.lat, lng: posizione.lng };
    if (testo) return { q: testo };
    if (posizione) return { lat: posizione.lat, lng: posizione.lng, raggioKm: RAGGIO_KM };
    return { ...ROMA, raggioKm: RAGGIO_KM };
  }, [testo, posizione]);
  useEffect(() => { void carica(ricerca); }, [ricerca, carica]);

  /** I risultati filtrati nel browser e ordinati: per distanza con la posizione, altrimenti per città e nome */
  const lista = useMemo(() => {
    const filtrati = (campetti ?? [])
      .filter((c) => [...filtri].every((f) => passa(c, f)))
      .filter((c) => !stato || c.stato === stato);
    if (posizione) return filtrati.sort((a, b) => distanzaKm(posizione, a) - distanzaKm(posizione, b));
    return filtrati.sort(perCittaENome);
  }, [campetti, filtri, stato, posizione]);

  const toggle = (f: Filtro) => setFiltri((prev) => {
    const next = new Set(prev);
    if (next.has(f)) next.delete(f);
    else next.add(f);
    return next;
  });

  /** Dove si sta cercando, accanto al conteggio */
  let dove = "intorno a Roma";
  if (testo) dove = "in tutta Italia";
  else if (posizione) dove = "intorno a te";

  /** L'elenco: il caricamento, l'errore con «Riprova», nessun risultato (dal server o dai filtri) o le card. Un caricamento non riuscito
   *  non si mostra come zona vuota */
  const elenco = () => {
    if (campetti === null && errore) {
      return <ErroreCaricamento cosa="Non è stato possibile caricare i campetti." motivo={errore} onRiprova={() => { void carica(ricerca); }} />;
    }
    if (campetti === null) return <Loading>Sto cercando i campetti…</Loading>;
    if (campetti.length === 0) return <p className="text-[13px] text-chalk-muted">Nessun campetto trovato.</p>;
    if (lista.length === 0) return <p className="text-[13px] text-chalk-muted">Nessun campetto con questi filtri.</p>;
    return lista.map((c) => {
      let distanza: number | undefined;
      if (posizione) distanza = distanzaKm(posizione, c);
      return <CampettoCard key={c.id} campetto={c} selezionato={c.id === sel} onSeleziona={setSel} distanzaKm={distanza} />;
    });
  };

  return (
    <>
      <div className="mb-4">
        <h1 className="font-display text-4xl">Campetti</h1>
        <p className="mt-1 text-[13px] text-chalk-muted">Trova un campo, organizza la prossima tappa.</p>
      </div>

      <div className="mb-3">
        <PosizioneUtente stato={posizioneUtente.stato} onChiedi={posizioneUtente.chiedi} />
      </div>

      {/* Ricerca e filtri */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="sr-only">Cerca città o campo</span>
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chalk-dim" />
          <input className="statin pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca città o campo in tutta Italia…" />
        </label>
        {FILTRI.map(([f, label]) => {
          let classe = "border-asphalt-700 text-chalk-muted hover:border-asphalt-500 hover:text-chalk";
          if (filtri.has(f)) classe = "border-court bg-court/15 text-court";
          return (
            <button key={f} type="button" onClick={() => toggle(f)} aria-pressed={filtri.has(f)}
              className={`h-9 rounded-sm border px-3 text-xs font-semibold uppercase tracking-[0.06em] transition-colors ${classe}`}>
              {label}
            </button>
          );
        })}
        <label className="flex items-center gap-2 text-xs text-chalk-muted">
          <span className="sr-only">Stato del campo</span>
          <select className="statin h-9" value={stato} onChange={(e) => setStato(e.target.value as "" | StatoCampetto)}>
            <option value="">Ogni stato del campo</option>
            {STATI_CAMPETTO.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[5fr_6fr]">
        {/* Elenco */}
        <div className="flex flex-col gap-2">
          <span className="kicker">{conteggio(lista.length, "campetto", "campetti")} · {dove}</span>
          {elenco()}
          <Button className="mt-1 w-full" disabled title="In arrivo"><Icon name="plus" size={16} /> Aggiungi un campetto</Button>
        </div>

        {/* Mappa */}
        <div className="lg:sticky lg:top-[7.5rem]">
          <MappaCampetti campetti={lista} selezionato={sel} onSeleziona={setSel} posizioneUtente={posizione ?? undefined} />
        </div>
      </div>

      {/* Attribuzione (D5): i campetti vengono da Pick-Roll, con il permesso del proprietario; le coordinate dei campetti di esempio
          (il seed del backend) dai centroidi di OpenStreetMap, licenza ODbL */}
      <p className="mt-6 text-xs text-chalk-dim">
        Campetti: dati di <a href="https://pick-roll.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-chalk">Pick-Roll</a>.
        Coordinate dei campetti di esempio © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-chalk">OpenStreetMap</a> contributors.
      </p>
    </>
  );
}
