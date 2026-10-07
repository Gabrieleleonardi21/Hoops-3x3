import { useState } from "react";
import { useInvio } from "../../hooks/useInvio";
import { useConfermaPerdita } from "../../hooks/useConfermaPerdita";
import { focusIniziale, useFocusModifica } from "../../hooks/useFocusFinestra";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import type { RegGiocatore, RegSquadra, User } from "../../types";
import { puoModificare } from "../../utils/permessi";
import { safeUrl } from "../../utils/safeUrl";
import { perditaSquadraAnagrafe } from "../../utils/testi";
import { TeamLogo } from "../ui/TeamLogo";

/** Campi modificabili (roster escluso: richiede UI dedicata) */
type EditDraft = Pick<RegSquadra, "nome" | "citta" | "anno" | "rank" | "referente" | "logo" | "website" | "instagram" | "note">;

/** Dove porta il logo, detto nel suo titolo: con lo stesso ordine del collegamento, sito > Instagram > ricerca Google */
function titoloLogo(s: RegSquadra): string {
  if (s.website) return `Vai al sito di ${s.nome}`;
  if (s.instagram) return `Instagram di ${s.nome}`;
  return `Cerca "${s.nome}" su Google`;
}

/** Modale con tutte le informazioni di una squadra dell'anagrafe.
 *  L'autore (o un ADMIN) può modificare tutti i campi principali o eliminare la squadra, dopo una conferma. `onUpdate` e
 *  `onRemove` rifiutano la promessa se il server non accetta: la modifica si chiude e la modale si chiude solo se hanno
 *  riuscito, altrimenti restano aperte con il motivo sotto i pulsanti. Finché un invio è in corso i pulsanti sono fermi e
 *  la modale non si chiude. */
export function SquadraAnagrafeModal({
  s,
  giocatori,
  user,
  onClose,
  onRemove,
  onUpdate,
}: {
  s: RegSquadra;
  giocatori: RegGiocatore[];
  user: User;
  onClose: () => void;
  onRemove: () => Promise<void>;
  onUpdate: (updated: RegSquadra) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  // Premuto «Modifica» il focus va al primo campo del form; uscendone, a «Modifica» (i pulsanti premuti spariscono con la loro vista)
  const { form, azioni } = useFocusModifica(editing);
  const { invio, errore, setErrore, esegui } = useInvio();
  const { chiedi, finestra } = useConfermaPerdita(() => perditaSquadraAnagrafe(s));
  const [draft, setDraft] = useState<EditDraft>({
    nome: s.nome, citta: s.citta, anno: s.anno, rank: s.rank,
    referente: s.referente, logo: s.logo,
    website: s.website, instagram: s.instagram || "", note: s.note,
  });

  const set = (k: keyof EditDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  // Esc, sfondo e X non chiudono durante un invio: l'esito, soprattutto se è un errore, deve restare sotto gli occhi.
  // Con la conferma aperta Esc è della conferma: Modal manda l'Esc solo alla finestra in primo piano
  const chiudi = () => { if (!invio) onClose(); };
  const saveEdit = async () => {
    // Si esce dalla modifica solo se il server ha accettato: se rifiuta, i campi restano come scritti
    if (await esegui(() => onUpdate({ ...s, ...draft }), "Modifica non riuscita")) setEditing(false);
  };
  // Entrando in modifica il messaggio di un'azione fallita prima (per esempio un'eliminazione) non resta sopra il form
  const iniziaModifica = () => { setEditing(true); setErrore(null); };
  const annullaModifica = () => { setEditing(false); setErrore(null); };

  const gName = (id: string) => {
    const g = giocatori.find((x) => x.id === id);
    return g ? `${g.nome} ${g.cognome}` : "?";
  };

  const canEdit = puoModificare(user, s.autoreId);
  // Il blocco dei dati prende il focus solo se ha qualcosa da leggere: con il solo nome (l'unico campo obbligatorio) sarebbe un blocco
  // vuoto, alto 0, con l'anello arancione da tastiera; senza, il focus va al primo elemento raggiungibile, com'era
  const haDati = Boolean(s.citta || s.anno || s.referente || s.website || s.instagram || s.note || (s.roster || []).length > 0);

  const handleRemove = async () => {
    if (await esegui(() => onRemove(), "Eliminazione non riuscita")) onClose();
  };

  // Fallback: se mancano sito e Instagram usa una ricerca Google del nome squadra
  const logoLink = safeUrl(s.website || s.instagram ||
    `https://www.google.com/search?q=${encodeURIComponent(s.nome + " basket 3x3")}`);

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex gap-2 text-[13.5px]"><span className="w-28 shrink-0 text-chalk-muted">{label}</span><span className="font-semibold text-chalk">{value}</span></div>
  );

  return (
    <Modal label={`Scheda squadra ${s.nome}`} title={s.nome} width={520} onClose={chiudi}
      subtitle={Number(s.rank) > 0 ? `Ranking circuito: ${s.rank} pt` : undefined}>
      {/* Logo centrato — sempre cliccabile: sito > instagram > ricerca Google */}
      <div className="mb-4 flex justify-center">
        {s.logo ? (
          <a href={logoLink} target="_blank" rel="noopener noreferrer" title={titoloLogo(s)}>
            <TeamLogo src={s.logo} alt={`Logo ${s.nome}`} className="h-32 w-32" />
          </a>
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-sm bg-asphalt-800 font-display text-3xl text-chalk-muted">3×3</div>
        )}
      </div>

      {/* ── Modalità visualizzazione ── */}
      {/* Il focus iniziale è sul blocco dei dati, non sul primo collegamento (il logo, il sito: si aprono in un'altra scheda del browser, e
          un Invio dato di riflesso li aprirebbe), e il lettore di schermo legge i dati. tabIndex -1: si prende il focus per programma, senza
          entrare nell'ordine di Tab; l'anello del focus resta, con la tastiera è l'unico indicatore. Solo se c'è almeno un dato (haDati) */}
      {!editing && (
        <div {...focusIniziale(haDati)}>
          <div className="mb-4 flex flex-col gap-1.5">
            {s.citta && row("Città", <>{s.citta}{s.anno ? ` · fondata nel ${s.anno}` : ""}</>)}
            {!s.citta && s.anno && row("Fondata", s.anno)}
            {s.referente && row("Referente", s.referente)}
            {s.website && row("Sito web", <a href={safeUrl(s.website)} target="_blank" rel="noopener noreferrer" className="text-court hover:underline">{s.website.replace(/^https?:\/\//, "")}</a>)}
            {s.instagram && row("Instagram", <a href={safeUrl(s.instagram)} target="_blank" rel="noopener noreferrer" className="text-court hover:underline">
              @{s.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\/?/, "").replace(/\/$/, "")}
            </a>)}
          </div>

          {/* Roster */}
          {(s.roster || []).length > 0 && (
            <div className="mb-4 rounded border border-asphalt-700 bg-asphalt-950/60 p-3.5">
              <div className="kicker mb-2">Roster ({s.roster.length})</div>
              <div className="flex flex-col divide-y divide-asphalt-700/60">
                {s.roster.map((id) => <div key={id} className="py-1.5 text-sm font-semibold text-chalk">{gName(id)}</div>)}
              </div>
            </div>
          )}

          {s.note && <p className="mb-4 text-[13.5px] text-chalk-muted">{s.note}</p>}
        </div>
      )}

      {/* ── Modalità modifica ── */}
      {editing && (
        <div ref={form} className="mb-4 flex flex-col gap-2.5">
          <div className="grid-auto">
            <Input label="Nome squadra" value={draft.nome} onChange={set("nome")} />
            <Input label="Città" value={draft.citta} onChange={set("citta")} />
            <Input label="Anno fondazione" type="number" value={draft.anno} onChange={set("anno")} />
            <Input label="Ranking (pt)" type="number" min={0} value={draft.rank} onChange={set("rank")} />
            <Input label="Referente / capitano" value={draft.referente} onChange={set("referente")} />
            <Input label="Logo (URL)" value={draft.logo} onChange={set("logo")} placeholder="/logos/squadra.svg" />
            <Input label="Sito web" value={draft.website} onChange={set("website")} placeholder="https://squadra.it" />
            <Input label="Instagram" value={draft.instagram} onChange={set("instagram")} placeholder="https://instagram.com/squadra" />
          </div>
          {/* Note: 2000 caratteri come SquadraRequestDTO, oltre il server risponde 400 */}
          <Input label="Note" value={draft.note} onChange={set("note")} placeholder="es. campioni tappa Roma 2025" maxLength={2000} />
          <div className="mt-1 flex gap-2">
            <Button onClick={saveEdit} disabled={invio}>Salva modifiche</Button>
            <Button variant="ghost" onClick={annullaModifica} disabled={invio}>Annulla</Button>
          </div>
        </div>
      )}

      {errore && <p className="mb-3 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}

      {/* Footer: autore + azioni. Senza account il server non manda l'autore e le azioni non ci sono: niente da mostrare, nemmeno la riga */}
      {(s.autore || canEdit) && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-asphalt-700 pt-3">
          {s.autore && <span className="text-[10.5px] text-chalk-dim">Registrata da {s.autore}</span>}
          {canEdit && !editing && (
            <div ref={azioni} className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={iniziaModifica} disabled={invio}><Icon name="edit" size={14} /> Modifica</Button>
              <Button variant="ghost" size="sm" className="text-loss" onClick={() => chiedi("Eliminare la squadra?", handleRemove)} disabled={invio}><Icon name="trash" size={14} /> Elimina</Button>
            </div>
          )}
        </div>
      )}
      {finestra}
    </Modal>
  );
}
