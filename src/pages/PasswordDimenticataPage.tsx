/** Richiesta del link per reimpostare la password: una mail, e il messaggio del server. Il server risponde sempre lo stesso testo,
 *  che la mail sia registrata o no: la pagina lo mostra com'è e non distingue i due casi (nessuno può scoprire chi ha un account). */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useInvio } from "../hooks/useInvio";
import { esitoIgnoto } from "../services/api";
import { recuperoApi } from "../services/recuperoApi";
import { emailSchema } from "../utils/credenziali";
import { Button } from "../components/ui/Button";
import { ErroreCaricamento } from "../components/ui/ErroreCaricamento";
import { Input } from "../components/ui/Input";

const schema = z.object({ email: emailSchema });
type Dati = z.infer<typeof schema>;

export function PasswordDimenticataPage() {
  // Il messaggio del server: quando c'è, la richiesta è partita e il form lascia il posto alla risposta
  const [messaggio, setMessaggio] = useState<string | null>(null);
  // true se non si sa se la richiesta è arrivata (rete assente, server che non risponde): lì ha senso «Riprova»
  const [daRiprovare, setDaRiprovare] = useState(false);
  const { invio, errore, esegui } = useInvio();
  const form = useForm<Dati>({ resolver: zodResolver(schema) });

  const invia = form.handleSubmit(async (dati) => {
    setDaRiprovare(false);
    await esegui(async () => {
      try {
        setMessaggio(await recuperoApi.richiediLink(dati.email));
      } catch (e) {
        setDaRiprovare(esitoIgnoto(e));
        throw e; // l'errore lo mostra useInvio
      }
    });
  });

  let testoPulsante = "Invia il link";
  if (invio) testoPulsante = "Invio in corso…";

  let contenuto = (
    <form className="flex flex-col gap-3" onSubmit={invia} noValidate>
      <p className="m-0 text-[13px] text-chalk-muted">Scrivi la mail del tuo account: ti mandiamo un link per scegliere una nuova password.</p>
      <Input label="Mail" type="email" autoComplete="email" {...form.register("email")}
        error={!!form.formState.errors.email} hint={form.formState.errors.email?.message} />
      {errore && !daRiprovare && <p className="m-0 text-[13px] font-semibold text-loss" role="alert">{errore}</p>}
      {errore && daRiprovare && (
        <ErroreCaricamento cosa="Invio non riuscito" motivo={errore} onRiprova={() => { void invia(); }} />
      )}
      <Button type="submit" className="w-full" disabled={invio}>{testoPulsante}</Button>
    </form>
  );
  if (messaggio !== null) {
    contenuto = <p className="m-0 rounded border border-court/40 bg-court/10 px-3.5 py-2.5 text-[13px] font-medium text-chalk" role="status">{messaggio}</p>;
  }

  return (
    <section className="mx-auto max-w-md rounded border border-asphalt-600 bg-asphalt-900/95 p-5" aria-label="Recupero della password">
      <h2 className="mt-0 mb-4 font-display text-2xl text-chalk">Password dimenticata</h2>
      {contenuto}
      <p className="mt-4 mb-0"><Link to="/" className="linkbtn">← Torna all'accesso</Link></p>
    </section>
  );
}
