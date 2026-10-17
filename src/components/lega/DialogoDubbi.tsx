/** La finestra dopo l'import dalle foto dei fogli: per ogni tappa letta i dubbi del lettore (e quelli della conversione), poi la
 *  scelta di passare le correzioni al Coach AI oppure no. Nomi e dubbi vengono dalla foto e dal server: sono solo testo React,
 *  mai HTML. Costruita su ConfirmDialog: Esc, lo sfondo e la X valgono «Non ora». */
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { NESSUN_DUBBIO } from "../../utils/testi";

/** Una tappa importata con i suoi dubbi, nell'ordine dei fogli */
export interface TappaDubbi {
  nome: string;
  dubbi: string[];
}

export function DialogoDubbi({ tappe, onCoach, onChiudi }: {
  tappe: TappaDubbi[]; onCoach: () => void; onChiudi: () => void;
}) {
  let titolo = "Tappa importata dal foglio";
  let passarla = "passarla";
  if (tappe.length > 1) {
    titolo = "Tappe importate dai fogli";
    passarla = "passarle";
  }
  return (
    <ConfirmDialog title={titolo} confermaTesto="Apri il Coach" annullaTesto="Non ora" onConfirm={onCoach} onCancel={onChiudi}>
      {tappe.map((t, i) => (
        // L'indice come chiave: l'elenco nasce una volta e non cambia, e due fogli possono avere lo stesso nome
        <section key={i} className="mb-3">
          <h3 className="font-semibold">{t.nome}</h3>
          {t.dubbi.length > 0 && (
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {t.dubbi.map((d, j) => <li key={j}>{d}</li>)}
            </ul>
          )}
          {t.dubbi.length === 0 && <p className="mt-1 text-chalk-muted">{NESSUN_DUBBIO}</p>}
        </section>
      ))}
      <p>
        Vuoi {passarla} al Coach AI per le correzioni? Può rinominare le squadre, sistemare i giocatori, registrare o annullare
        risultati e sorteggiare i gironi.
      </p>
    </ConfirmDialog>
  );
}
