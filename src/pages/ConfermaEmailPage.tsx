/** Conferma del nuovo indirizzo email: ci si arriva dal link mandato al nuovo indirizzo (`/conferma-email?token=…`). Pubblica: il
 *  link si apre anche in un browser dove non si è entrati. Il token si consuma SOLO con il clic su «Conferma l'indirizzo»: aprire la
 *  pagina non manda niente, così uno scanner della posta che segue i link non lo brucia. */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useInvio } from "../hooks/useInvio";
import { profiloApi } from "../services/profiloApi";
import * as authService from "../services/authService";
import { Button } from "../components/ui/Button";

export function ConfermaEmailPage() {
  const [parametri] = useSearchParams();
  const tokenLink = parametri.get("token") ?? "";
  const { user, aggiorna } = useAuth();
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const { invio, errore, esegui } = useInvio();
  const registrato = !!user && !user.guest;

  /** Conferma sul server; se in questo browser c'è un utente registrato si rilegge dal server, così la sessione ha l'email nuova
   *  senza ricaricare. Se la lettura non riesce (sessione scaduta, rete) la conferma è comunque riuscita: l'utente resta com'era */
  const conferma = async () => {
    const testo = await profiloApi.confermaEmail(tokenLink);
    setMessaggio(testo);
    if (!registrato) return;
    const sessione = await authService.me();
    if (sessione.esito === "valida") aggiorna(sessione.user);
  };

  /** Il passo successivo, sempre lo stesso: il profilo per chi è entrato, il modulo d'accesso (sulla scheda «Accedi») per gli altri */
  let prosegui = <Link to="/" state={{ modo: "login" }} className="linkbtn">Accedi</Link>;
  if (registrato) prosegui = <Link to="/profilo" className="linkbtn">Vai al profilo</Link>;

  let testoPulsante = "Conferma l'indirizzo";
  if (invio) testoPulsante = "Conferma in corso…";

  let contenuto = (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-chalk-muted">Stai per confermare il nuovo indirizzo email del tuo account HOOP 3X3.</p>
      {errore && (
        <>
          <p className="m-0 text-[13px] font-semibold text-loss" role="alert">{errore}</p>
          {prosegui}
        </>
      )}
      <Button className="w-full" disabled={invio} onClick={() => { void esegui(conferma); }}>
        {testoPulsante}
      </Button>
    </div>
  );
  if (tokenLink === "") {
    contenuto = (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[13px] font-semibold text-loss" role="alert">Il link non è valido</p>
        {prosegui}
      </div>
    );
  }
  if (messaggio !== null) {
    contenuto = (
      <div className="flex flex-col gap-3">
        <p className="m-0 rounded border border-court/40 bg-court/10 px-3.5 py-2.5 text-[13px] font-medium text-chalk" role="status">{messaggio}</p>
        {prosegui}
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-md rounded border border-asphalt-600 bg-asphalt-900/95 p-5" aria-label="Conferma del nuovo indirizzo">
      <h2 className="mt-0 mb-4 font-display text-2xl text-chalk">Nuovo indirizzo email</h2>
      {contenuto}
    </section>
  );
}
