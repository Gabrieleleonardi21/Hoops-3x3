/** Scheda «Elimina account»: immediata e definitiva, con la password e una finestra di conferma che dice che cosa sparisce (le leghe
 *  con tappe e pubblicazioni, comprese le modifiche ancora in coda) e che cosa resta (campetti e schede dell'anagrafe, senza autore).
 *  Dopo il 204 non resta niente nel browser e si torna alla home con «Account eliminato.»; un errore del server lascia l'utente
 *  dentro, con il messaggio. L'ADMIN non si elimina dall'app. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useConfermaPerdita } from "../../hooks/useConfermaPerdita";
import { useInvio } from "../../hooks/useInvio";
import { useUtente } from "../../hooks/useUtente";
import { useAppStore } from "../../stores/useAppStore";
import { ACCOUNT_ELIMINATO, ADMIN_DALLA_CONFIGURAZIONE, perditaAccount } from "../../utils/testi";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Esito, Scheda } from "./Scheda";

export function EliminaAccount() {
  const utente = useUtente();
  const { eliminaAccount } = useAuth();
  const navigate = useNavigate();
  const leghe = useAppStore((s) => s.leghe);
  const [password, setPassword] = useState("");
  const { invio, errore, esegui } = useInvio();
  // Il testo è lo stesso sopra il campo e nella finestra. Le schede dell'anagrafe restano (il server le lascia senza autore)
  const perdita = perditaAccount(leghe?.length ?? null, true);
  const { chiedi, finestra } = useConfermaPerdita(() => perdita);

  if (utente.ruolo === "ADMIN") {
    return (
      <Scheda titolo="Elimina account">
        <p className="m-0 text-sm text-chalk-muted">{ADMIN_DALLA_CONFIGURAZIONE}</p>
      </Scheda>
    );
  }

  /** Dopo il 204 la sessione è già svuotata (useAuth.eliminaAccount): resta solo da tornare alla home con il messaggio */
  const elimina = () => esegui(async () => {
    await eliminaAccount(password);
    navigate("/", { state: { messaggio: ACCOUNT_ELIMINATO } });
  });

  return (
    <Scheda titolo="Elimina account">
      <div className="flex flex-col gap-3">
        <p className="m-0 text-sm text-chalk-muted">{perdita}</p>
        <Input label="Password attuale" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
        <Esito messaggio={null} errore={errore} />
        <Button variant="outline" className="self-start border-loss text-loss hover:border-loss hover:bg-loss/10"
          disabled={invio || password === ""} onClick={() => chiedi("Eliminare l'account?", () => { void elimina(); })}>
          Elimina il mio account
        </Button>
      </div>
      {finestra}
    </Scheda>
  );
}
