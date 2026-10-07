/** Campetti: ricerca dei campi da streetball con filtri, lista e mappa schematica.
 *  ATTENZIONE: usa i DATI DI ESEMPIO di src/data/campetti.ts (nessuna persistenza né geolocalizzazione);
 *  la mappa è un SVG stilizzato, non una mappa reale. L'UI è pronta per collegare dati veri. */
import { useMemo, useState } from "react";
import { CAMPETTI_DEMO, type Campetto } from "../data/campetti";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";

type Filtro = "illuminato" | "coperto" | "gratuito" | "canestri";
const FILTRI: [Filtro, string][] = [["illuminato", "Illuminato"], ["coperto", "Coperto"], ["canestri", "4 canestri"], ["gratuito", "Gratuito"]];

function fmtData(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Mappa schematica: griglia "strade" + pin. Sostituibile con una mappa reale mantenendo le stesse props. */
function MappaSchematica({ campetti, selected, onSelect }: { campetti: Campetto[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded border border-asphalt-700 bg-asphalt-900">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {/* isoipse/strade decorative */}
        {[15, 35, 55, 75, 95].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="var(--color-asphalt-700)" strokeWidth="0.3" />)}
        {[12, 30, 48, 66, 84].map((x) => <line key={x} x1={x} y1="0" x2={x} y2="100" stroke="var(--color-asphalt-700)" strokeWidth="0.3" />)}
        <path d="M60 0 C 62 30, 70 60, 78 100" fill="none" stroke="var(--color-asphalt-600)" strokeWidth="1.2" />
        <path d="M0 58 C 30 52, 60 66, 100 60" fill="none" stroke="var(--color-asphalt-600)" strokeWidth="0.8" />
      </svg>
      {campetti.map((c) => {
        const sel = c.id === selected;
        return (
          <button key={c.id} onClick={() => onSelect(c.id)} aria-label={`${c.nome}, ${c.distanzaKm} km`} aria-pressed={sel}
            className={`absolute -translate-x-1/2 -translate-y-full transition-transform ${sel ? "z-10 scale-125" : "hover:scale-110"}`}
            style={{ left: `${c.x}%`, top: `${c.y}%` }}>
            <Icon name="pin" size={28} className={sel ? "text-court" : "text-chalk-muted"} fill={sel ? "var(--color-court)" : "var(--color-asphalt-800)"} />
          </button>
        );
      })}
      <div className="absolute bottom-2 left-2 rounded-sm bg-asphalt-950/80 px-2 py-1 text-[10.5px] uppercase tracking-[0.08em] text-chalk-dim">
        Mappa schematica · dati di esempio
      </div>
    </div>
  );
}

export function CampettiPage() {
  const [q, setQ] = useState("");
  const [filtri, setFiltri] = useState<Set<Filtro>>(new Set());
  const [ordine, setOrdine] = useState<"distanza" | "rating">("distanza");
  const [sel, setSel] = useState<string | null>(CAMPETTI_DEMO[0]?.id ?? null);

  const lista = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CAMPETTI_DEMO
      .filter((c) => !s || `${c.nome} ${c.indirizzo} ${c.citta}`.toLowerCase().includes(s))
      .filter((c) => !filtri.has("illuminato") || c.illuminato)
      .filter((c) => !filtri.has("coperto") || c.coperto)
      .filter((c) => !filtri.has("gratuito") || c.gratuito)
      .filter((c) => !filtri.has("canestri") || c.canestri >= 4)
      .sort((a, b) => (ordine === "distanza" ? a.distanzaKm - b.distanzaKm : b.rating - a.rating));
  }, [q, filtri, ordine]);


  const toggle = (f: Filtro) => setFiltri((prev) => {
    const next = new Set(prev);
    if (next.has(f)) next.delete(f); else next.add(f);
    return next;
  });

  return (
    <>
      {/* I dati sono inventati (src/data/campetti.ts): la pagina resta nella navigazione, e lo dice chiaramente in cima */}
      <p role="note" className="mb-4 rounded border border-court/40 bg-court/10 px-3.5 py-2.5 text-[13px] font-medium text-chalk">
        <span className="font-semibold text-court">Dati di esempio.</span> I campetti, le valutazioni e le distanze qui sotto sono
        inventati per mostrare come sarà la pagina: non sono campi reali.
      </p>

      <div className="mb-4">
        <h1 className="font-display text-4xl">Campetti</h1>
        <p className="mt-1 text-[13px] text-chalk-muted">Trova un campo, organizza la prossima tappa.</p>
      </div>

      {/* Filtri */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="sr-only">Cerca città o campo</span>
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-chalk-dim" />
          <input className="statin pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca città o campo…" />
        </label>
        {FILTRI.map(([f, label]) => (
          <button key={f} onClick={() => toggle(f)} aria-pressed={filtri.has(f)}
            className={`h-9 rounded-sm border px-3 text-xs font-semibold uppercase tracking-[0.06em] transition-colors ${
              filtri.has(f) ? "border-court bg-court/15 text-court" : "border-asphalt-700 text-chalk-muted hover:border-asphalt-500 hover:text-chalk"}`}>
            {label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-chalk-muted">
          Ordina
          <select className="statin h-9 w-auto py-0 text-xs" value={ordine} onChange={(e) => setOrdine(e.target.value as "distanza" | "rating")}>
            <option value="distanza">Distanza</option>
            <option value="rating">Valutazione</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[5fr_6fr]">
        {/* Lista */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="kicker">{lista.length} {lista.length === 1 ? "campetto" : "campetti"} · Torino</span>
          </div>
          {lista.length === 0 && <p className="text-[13px] text-chalk-muted">Nessun campetto con questi filtri.</p>}
          {lista.map((c) => {
            const active = c.id === sel;
            return (
              <button key={c.id} onClick={() => setSel(c.id)} aria-pressed={active}
                className={`flex w-full gap-3 rounded border bg-asphalt-900 p-3 text-left transition-colors ${
                  active ? "border-court shadow-[inset_3px_0_0_var(--color-court)]" : "border-asphalt-700 hover:border-asphalt-500"}`}>
                <div className="h-16 w-20 shrink-0 overflow-hidden rounded-sm bg-asphalt-800">
                  <img src="/hero-court.jpg" alt="" className="h-full w-full object-cover opacity-70" loading="lazy" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-lg text-chalk">{c.nome}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-gold">
                      <Icon name="star" size={12} fill="currentColor" /> {c.rating.toFixed(1)} <span className="font-normal text-chalk-dim">({c.recensioni})</span>
                    </span>
                  </div>
                  <div className="text-xs text-chalk-muted">{c.indirizzo}, {c.citta} · {c.distanzaKm.toFixed(1)} km</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge>{c.superficie}</Badge>
                    {c.illuminato && <Badge>Illuminato</Badge>}
                    {c.coperto && <Badge>Coperto</Badge>}
                    <Badge>{c.canestri} canestri</Badge>
                    {!c.gratuito && <Badge tone="court">A pagamento</Badge>}
                  </div>
                  {c.ultimaTappa && <div className="mt-1.5 text-[11px] text-chalk-dim">Ultima tappa: {fmtData(c.ultimaTappa)}</div>}
                </div>
              </button>
            );
          })}
          <Button className="mt-1 w-full" disabled title="Funzionalità non ancora disponibile"><Icon name="plus" size={16} /> Aggiungi un campetto</Button>
        </div>

        {/* Mappa */}
        <div className="lg:sticky lg:top-[7.5rem] lg:h-[calc(100vh-9rem)]">
          <MappaSchematica campetti={lista} selected={sel} onSelect={setSel} />
        </div>
      </div>
    </>
  );
}
