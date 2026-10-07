/** Pannello di modifica in-page: permette di cambiare nome, luogo, data, numero gironi
 *  e aggiungere squadre. Aggiungere squadre o cambiare i gironi azzera il sorteggio: se ci sono risultati si chiede
 *  prima conferma. Nome e numero di gironi si applicano all'uscita dal campo o con Invio e solo se cambiano: mentre
 *  si scrive, sorteggio e risultati restano e un nome svuotato non arriva alla tappa. */
import { useState, type InputHTMLAttributes } from "react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Icon } from "../ui/Icon";
import { impostaNumeroGironi, MAX_LUOGO, MAX_NOME_TAPPA } from "../../domain/tappaOps";
import { useConfermaPerdita } from "../../hooks/useConfermaPerdita";
import type { useTappa } from "../../hooks/useTappa";

/** Campo che si applica all'uscita o con Invio, non a ogni tasto: mentre si scrive mostra la bozza e la tappa non
 *  cambia; dopo torna a mostrare il valore della tappa (quello nuovo, oppure quello di prima se è stato rifiutato). */
function CampoConfermato({ valore, onConferma, ...campo }: {
  label: string; valore: string; onConferma: (valore: string) => void;
} & Pick<InputHTMLAttributes<HTMLInputElement>, "type" | "min" | "maxLength">) {
  const [bozza, setBozza] = useState<string | null>(null);
  const conferma = () => {
    if (bozza !== null) onConferma(bozza);
    setBozza(null);
  };
  return (
    <Input {...campo} value={bozza ?? valore} onChange={(e) => setBozza(e.target.value)} onBlur={conferma}
      onKeyDown={(e) => { if (e.key === "Enter") conferma(); }} />
  );
}

export function TappaEditPanel({ h }: { h: ReturnType<typeof useTappa> }) {
  // Il motivo dell'ultima modifica rifiutata (numero di gironi non valido, troppe squadre)
  const [errore, setErrore] = useState<string | null>(null);
  const { chiedi, finestra } = useConfermaPerdita(h.perditaRisultati);
  // La pagina apre il pannello solo con la tappa caricata; il controllo sta dopo gli hook, che vanno chiamati sempre
  const t = h.tappa;
  if (!t) return null;

  /** Nuovo numero di gironi: prima si controlla (funzione pura, non salva niente), così un numero non valido dà
   *  subito il messaggio e lo stesso numero non fa niente; la conferma si chiede solo per un cambio vero */
  const cambiaGironi = (valore: string) => {
    const n = Number(valore);
    const prova = impostaNumeroGironi(t, n);
    if (!prova.ok) { setErrore(prova.errore); return; }
    setErrore(null);
    if (prova.tappa === t) return;
    chiedi("Cambiare il numero di gironi?", () => setErrore(h.setNGironi(n)));
  };

  return (
    <Card className="mt-3">
      <h3 className="font-display text-lg mb-2.5">Modifica tappa</h3>
      <div className="grid-auto" style={{ "--min": "160px" }}>
        {/* Un nome vuoto è rifiutato: il campo torna al nome di prima. Nome e luogo non vanno oltre i limiti del
            server (TappaDTO): oltre, ogni salvataggio della tappa sarebbe un 400 */}
        <CampoConfermato label="Nome" valore={t.nome} onConferma={h.rinomina} maxLength={MAX_NOME_TAPPA} />
        <Input label="Luogo" value={t.luogo} onChange={(e) => h.setInfo("luogo", e.target.value)} maxLength={MAX_LUOGO} />
        <Input label="Data" type="date" value={t.data} onChange={(e) => h.setInfo("data", e.target.value)} />
        <CampoConfermato label="Numero gironi" type="number" min={1} valore={String(t.nGironi)} onConferma={cambiaGironi} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <Button variant="outline" size="sm" onClick={() => chiedi("Aggiungere una squadra?", () => setErrore(h.addTeam()))}>
          <Icon name="plus" size={14} /> Aggiungi squadra
        </Button>
        <span className="text-xs font-semibold text-court">
          Aggiungere/rimuovere squadre o cambiare il numero di gironi azzera sorteggio e risultati.
        </span>
      </div>
      {errore && <p className="mt-2 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}
      {finestra}
    </Card>
  );
}
