/** Pagina di selezione lega: mostra tutte le leghe dell'utente,
 *  permette di crearne una nuova, aprirla o eliminarla. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../stores/useAppStore";
import { useInvio } from "../hooks/useInvio";
import { useConfermaPerdita } from "../hooks/useConfermaPerdita";
import { useUtente } from "../hooks/useUtente";
import { conteggio, perditaLega } from "../utils/testi";
import { GuestBanner } from "../components/auth/GuestBanner";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { Section } from "../components/ui/Section";
import { ErroreCaricamento } from "../components/ui/ErroreCaricamento";
import { MAX_NOME_LEGA } from "../constants/rules";
import type { LegaMeta } from "../types";

/** `disabled`: un'altra azione sulle leghe è in corso, quindi i pulsanti aspettano; `pubblicabili`: chi ha un account può avere tappe
 *  nell'Archivio circuito, e la conferma dice che escono anche loro */
function LegaCard({ m, disabled, pubblicabili, onOpen, onDelete }: {
  m: LegaMeta; disabled: boolean; pubblicabili: boolean; onOpen: () => void; onDelete: () => void;
}) {
  // Eliminare una lega cancella tutte le sue tappe e non si recupera: si chiede sempre conferma, dicendo quante sono
  const { chiedi, finestra } = useConfermaPerdita(() => perditaLega(m, pubblicabili));
  const date = m.ts ? new Date(m.ts).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }) : null;

  return (
    <div className="flex flex-col gap-2 rounded border border-asphalt-700 bg-asphalt-900 p-4 transition-colors hover:border-asphalt-500">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 font-display text-2xl text-chalk">{m.nome}</div>
        <button onClick={() => chiedi("Eliminare la lega?", onDelete)} disabled={disabled} className="area-tocco shrink-0 text-chalk-dim hover:text-loss" title="Elimina lega" aria-label={`Elimina lega ${m.nome}`}>
          <Icon name="trash" size={16} />
        </button>
      </div>
      <div className="text-xs text-chalk-muted">
        {conteggio(m.nTappe, "tappa", "tappe")}{date ? ` · ${date}` : ""}
      </div>
      <Button size="sm" className="mt-1 self-start" onClick={onOpen} disabled={disabled}>Apri <Icon name="chevron" size={14} /></Button>
      {finestra}
    </div>
  );
}

export function LegheListPage() {
  const user      = useUtente();
  const leghe     = useAppStore((s) => s.leghe);
  // Perché l'elenco non è arrivato dal server (leghe === null): «Riprova» lo richiede con rehydrate
  const erroreLeghe = useAppStore((s) => s.erroreLeghe);
  const rehydrate   = useAppStore((s) => s.rehydrate);
  const createLega  = useAppStore((s) => s.createLega);
  const selectLega  = useAppStore((s) => s.selectLega);
  const deleteLega  = useAppStore((s) => s.deleteLega);
  const navigate  = useNavigate();
  const [nome, setNome] = useState("");
  // Una sola azione alla volta (crea, apri, elimina): finché una è in corso i pulsanti aspettano, così un doppio clic non crea due
  // leghe; se fallisce il motivo compare sotto il campo del nome, e il nome scritto resta
  const { invio, errore, esegui } = useInvio();


  const handleCreate = async () => {
    if (!nome.trim()) return;
    if (await esegui(() => createLega(nome), "Creazione non riuscita")) navigate("/lega");
  };

  const handleOpen = async (id: string) => {
    if (await esegui(() => selectLega(id), "Apertura non riuscita")) navigate("/lega");
  };

  // La conferma l'ha già chiesta la card (LegaCard): qui si elimina
  const handleDelete = async (m: LegaMeta) => {
    await esegui(() => deleteLega(m.id), "Eliminazione non riuscita");
  };

  return (
    <div>
      <GuestBanner text="Modalità Ospite: i dati sono salvati solo su questo browser." />

      <div className="mb-6 border-b border-asphalt-700 pb-4">
        <h1 className="font-display text-4xl">Le mie <span className="text-court">leghe</span></h1>
        <p className="mt-1 text-[13px] text-chalk-muted">Ogni lega è un circuito indipendente con le sue tappe, squadre e statistiche.</p>
      </div>

      {/* Form creazione nuova lega; il nome non va oltre il limite del server (NuovaLegaDTO), altrimenti sarebbe un 400 */}
      <div className="mb-7 flex flex-wrap items-end gap-2.5">
        <div className="min-w-[240px] max-w-sm flex-1">
          <Input label="Nome della nuova lega" value={nome} onChange={(e) => setNome(e.target.value)}
            placeholder="Es. Roma Streetball 2025" maxLength={MAX_NOME_LEGA}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") handleCreate(); }} />
        </div>
        <Button onClick={handleCreate} disabled={invio}><Icon name="plus" size={16} /> Crea lega</Button>
      </div>
      {errore && <p className="-mt-4 mb-6 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}

      {/* Lista leghe esistenti. Un elenco che non è arrivato dal server (null) non si mostra come vuoto: si dice perché, con «Riprova» */}
      {leghe === null && (
        <Section title="Leghe">
          <ErroreCaricamento cosa="Non è stato possibile caricare le tue leghe." motivo={erroreLeghe ?? "errore imprevisto"}
            onRiprova={() => { void rehydrate(); }} />
        </Section>
      )}
      {leghe !== null && (
        <Section title="Leghe" kicker={conteggio(leghe.length, "lega", "leghe")}>
          {leghe.length === 0 ? (
            <p className="text-[15px] text-chalk-muted">Nessuna lega ancora: crea la prima qui sopra.</p>
          ) : (
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
              {leghe.map((m) => (
                <LegaCard key={m.id} m={m} disabled={invio} pubblicabili={!user.guest} onOpen={() => handleOpen(m.id)} onDelete={() => handleDelete(m)} />
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
