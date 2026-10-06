import { useState } from "react";
import { Link } from "react-router-dom";
import { useInvio } from "../../hooks/useInvio";
import { useConfermaPerdita } from "../../hooks/useConfermaPerdita";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { REG_ROLES } from "../../constants/roles";
import { eta } from "../../utils/eta";
import { puoModificare } from "../../utils/permessi";
import { safeUrl } from "../../utils/safeUrl";
import { perditaGiocatore } from "../../utils/testi";
import type { GiocatoreInput } from "../../services/anagrafeApi";
import type { RegGiocatore, RegSquadra, User } from "../../types";

/** I campi che il server fa scrivere (senza id, autore, autoreId e ts) */
type EditDraft = GiocatoreInput;

/** Modale con tutte le informazioni di un giocatore dell'anagrafe.
 *  L'autore (o un ADMIN) può modificare tutti i campi o eliminare il giocatore, dopo una conferma. `onUpdate` e `onRemove`
 *  rifiutano la promessa se il server non accetta: la modifica si chiude e la modale si chiude solo se hanno riuscito,
 *  altrimenti restano aperte con il motivo sotto i pulsanti. Finché un invio è in corso i pulsanti sono fermi e la modale
 *  non si chiude. */
export function GiocatoreModal({
  g,
  user,
  squadre,
  onClose,
  onRemove,
  onUpdate,
}: {
  g: RegGiocatore;
  user: User;
  squadre?: RegSquadra[];
  onClose: () => void;
  onRemove: () => Promise<void>;
  onUpdate: (updated: RegGiocatore) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const { invio, errore, setErrore, esegui } = useInvio();
  const { chiedi, finestra } = useConfermaPerdita(() => perditaGiocatore(g, squadre));
  const [draft, setDraft] = useState<EditDraft>({
    nome: g.nome, cognome: g.cognome, soprannome: g.soprannome,
    nascita: g.nascita, citta: g.citta, nazionalita: g.nazionalita,
    altezza: g.altezza, peso: g.peso, ruolo: g.ruolo,
    numero: g.numero, squadra: g.squadra, esperienza: g.esperienza, note: g.note,
  });

  const set = (k: keyof EditDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  // Esc, sfondo e X non chiudono durante un invio: l'esito, soprattutto se è un errore, deve restare sotto gli occhi.
  // Con la conferma aperta Esc è della conferma: Modal manda l'Esc solo alla finestra in primo piano
  const chiudi = () => { if (!invio) onClose(); };
  const saveEdit = async () => {
    // Si esce dalla modifica solo se il server ha accettato: se rifiuta, i campi restano come scritti
    if (await esegui(() => onUpdate({ ...g, ...draft }), "Modifica non riuscita")) setEditing(false);
  };
  const handleRemove = async () => {
    if (await esegui(() => onRemove(), "Eliminazione non riuscita")) onClose();
  };
  // Entrando in modifica il messaggio di un'azione fallita prima (per esempio un'eliminazione) non resta sopra il form
  const iniziaModifica = () => { setEditing(true); setErrore(null); };
  const annullaModifica = () => { setEditing(false); setErrore(null); };
  const canEdit = puoModificare(user, g.autoreId);
  const age = eta(g.nascita);
  // Cerca il logo della squadra abbinando il nome del giocatore con la lista squadre
  const squadraLogo = squadre?.find((s) => s.nome === g.squadra)?.logo ?? null;

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex gap-2 text-[13.5px]"><span className="w-28 shrink-0 text-chalk-muted">{label}</span><span className="font-semibold text-chalk">{value}</span></div>
  );

  return (
    <Modal label={`Scheda giocatore ${g.nome} ${g.cognome}`} onClose={chiudi}
      title={<>{g.nome} {g.cognome}{g.numero && <span className="text-court"> #{g.numero}</span>}</>}
      subtitle={g.soprannome ? `"${g.soprannome}"` : undefined}>
      {/* Logo squadra */}
      {squadraLogo && (
        <div className="mb-4 flex justify-center">
          <img src={safeUrl(squadraLogo)} alt="" aria-hidden className="h-20 w-20 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}

      {/* ── Modalità visualizzazione ── */}
      {!editing && (
        <div className="mb-4 flex flex-col gap-1.5">
          {row("Ruolo", <>{g.ruolo}{g.squadra ? ` · ${g.squadra}` : ""}</>)}
          {g.nascita && row("Nato il", <>{g.nascita}{age !== null ? ` (${age} anni)` : ""}{g.citta ? ` a ${g.citta}` : ""}</>)}
          {!g.nascita && g.citta && row("Città", g.citta)}
          {g.nazionalita && row("Nazionalità", g.nazionalita)}
          {(g.altezza || g.peso) && row("Fisico", [g.altezza ? `${g.altezza} cm` : "", g.peso ? `${g.peso} kg` : ""].filter(Boolean).join(" · "))}
          {g.esperienza && row("Esperienza", `${g.esperienza} anni`)}
          {g.note && <p className="mt-2 mb-0 text-[13.5px] text-chalk-muted">{g.note}</p>}
          <Link to={`/giocatore/${g.id}`} className="mt-2 inline-flex items-center gap-1 self-start text-[13px] font-semibold text-court hover:underline">
            Profilo e statistiche <Icon name="chevron" size={12} />
          </Link>
        </div>
      )}

      {/* ── Modalità modifica ── */}
      {editing && (
        <div className="mb-4 flex flex-col gap-2.5">
          {/* maxLength come GiocatoreRequestDTO (nome e cognome 80, note 2000): oltre, il server risponde 400 */}
          <div className="grid-auto" style={{ "--min": "140px" }}>
            <Input label="Nome" value={draft.nome} onChange={set("nome")} maxLength={80} />
            <Input label="Cognome" value={draft.cognome} onChange={set("cognome")} maxLength={80} />
            <Input label="Soprannome" value={draft.soprannome} onChange={set("soprannome")} />
            <Input label="Data di nascita" type="date" value={draft.nascita} onChange={set("nascita")} />
            <Input label="Città" value={draft.citta} onChange={set("citta")} />
            <Input label="Nazionalità" value={draft.nazionalita} onChange={set("nazionalita")} />
            <Input label="Altezza (cm)" type="number" min={0} value={draft.altezza} onChange={set("altezza")} />
            <Input label="Peso (kg)" type="number" min={0} value={draft.peso} onChange={set("peso")} />
            <label className="input-label">
              Ruolo
              <select className="statin mt-1" value={draft.ruolo} onChange={set("ruolo")}>
                {REG_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <Input label="N. maglia" type="number" min={0} value={draft.numero} onChange={set("numero")} />
            <Input label="Squadra" value={draft.squadra} onChange={set("squadra")} />
            <Input label="Anni di esperienza" type="number" min={0} value={draft.esperienza} onChange={set("esperienza")} />
          </div>
          <Input label="Note sportive" value={draft.note} onChange={set("note")} placeholder="es. tiratore da fuori" maxLength={2000} />
          <div className="mt-1 flex gap-2">
            <Button onClick={saveEdit} disabled={invio}>Salva modifiche</Button>
            <Button variant="ghost" onClick={annullaModifica} disabled={invio}>Annulla</Button>
          </div>
        </div>
      )}

      {errore && <p className="mb-3 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}

      {/* Footer: autore + azioni */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-asphalt-700 pt-3">
        <span className="text-[10.5px] text-chalk-dim">Registrato da {g.autore}</span>
        {canEdit && !editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={iniziaModifica} disabled={invio}><Icon name="edit" size={14} /> Modifica</Button>
            <Button variant="ghost" size="sm" className="text-loss" onClick={() => chiedi("Eliminare il giocatore?", handleRemove)} disabled={invio}><Icon name="trash" size={14} /> Elimina</Button>
          </div>
        )}
      </div>
      {finestra}
    </Modal>
  );
}
