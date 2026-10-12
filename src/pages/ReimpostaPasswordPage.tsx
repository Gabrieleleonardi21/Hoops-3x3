/** Scelta della nuova password: ci si arriva dal link della mail (`/reimposta-password?token=…`). Il token si legge dall'indirizzo,
 *  così la pagina funziona anche ricaricandola; senza token non c'è niente da fare e lo dice subito. */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useInvio } from "../hooks/useInvio";
import { recuperoApi } from "../services/recuperoApi";
import { passwordSchema } from "../utils/credenziali";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

// Stesse regole della registrazione (passwordSchema), più il confronto con il secondo campo
const schema = z.object({ nuova: passwordSchema, ripeti: z.string() })
  .refine((d) => d.nuova === d.ripeti, { path: ["ripeti"], message: "Le due password non coincidono" });
type Dati = z.infer<typeof schema>;

/** Il collegamento per chiederne uno nuovo, sempre lo stesso: link scaduto, già usato o mai arrivato */
function NuovoLink() {
  return <Link to="/password-dimenticata" className="linkbtn">Richiedi un nuovo link</Link>;
}

export function ReimpostaPasswordPage() {
  const [parametri] = useSearchParams();
  const tokenLink = parametri.get("token") ?? "";
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const { invio, errore, esegui } = useInvio();
  const form = useForm<Dati>({ resolver: zodResolver(schema) });
  const errori = form.formState.errors;

  const invia = form.handleSubmit(async (dati) => {
    await esegui(async () => { setMessaggio(await recuperoApi.reimposta(tokenLink, dati.nuova)); });
  });

  let testoPulsante = "Imposta la password";
  if (invio) testoPulsante = "Salvataggio in corso…";

  let contenuto = (
    <form className="flex flex-col gap-3" onSubmit={invia} noValidate>
      <Input label="Nuova password" type="password" autoComplete="new-password" {...form.register("nuova")}
        error={!!errori.nuova} hint={errori.nuova?.message} />
      <Input label="Ripeti la password" type="password" autoComplete="new-password" {...form.register("ripeti")}
        error={!!errori.ripeti} hint={errori.ripeti?.message} />
      {errore && (
        <>
          <p className="m-0 text-[13px] font-semibold text-loss" role="alert">{errore}</p>
          <NuovoLink />
        </>
      )}
      <Button type="submit" className="w-full" disabled={invio}>{testoPulsante}</Button>
    </form>
  );
  if (tokenLink === "") {
    contenuto = (
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[13px] font-semibold text-loss" role="alert">Il link non è valido</p>
        <NuovoLink />
      </div>
    );
  }
  if (messaggio !== null) {
    contenuto = (
      <div className="flex flex-col gap-3">
        <p className="m-0 rounded border border-court/40 bg-court/10 px-3.5 py-2.5 text-[13px] font-medium text-chalk" role="status">{messaggio}</p>
        {/* Lo stato dice al modulo di accesso di partire dalla scheda «Accedi»: chi ha cambiato la password un account ce l'ha */}
        <Link to="/" state={{ modo: "login" }} className="linkbtn">Accedi</Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-md rounded border border-asphalt-600 bg-asphalt-900/95 p-5" aria-label="Reimpostazione della password">
      <h2 className="mt-0 mb-4 font-display text-2xl text-chalk">Nuova password</h2>
      {contenuto}
    </section>
  );
}
