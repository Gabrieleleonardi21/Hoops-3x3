/** Scheda «Email»: l'indirizzo cambia solo dopo la conferma. Il server manda il link al NUOVO indirizzo (prova che esiste ed è suo:
 *  con un errore di battitura l'account resterebbe senza recupero della password) e l'email dell'account resta quella di prima
 *  finché non si apre il link (pagina ConfermaEmailPage). Serve la password attuale. L'ADMIN non la cambia dall'app. */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useInvio } from "../../hooks/useInvio";
import { useUtente } from "../../hooks/useUtente";
import { profiloApi } from "../../services/profiloApi";
import { emailSchema } from "../../utils/credenziali";
import { ADMIN_DALLA_CONFIGURAZIONE } from "../../utils/testi";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Esito, Scheda } from "./Scheda";

const schema = z.object({ nuovaEmail: emailSchema, password: z.string().min(1, "Inserisci la password attuale") });
type Dati = z.infer<typeof schema>;
const VUOTO: Dati = { nuovaEmail: "", password: "" };

export function CambioEmail() {
  const utente = useUtente();
  const { invio, errore, esegui } = useInvio();
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const form = useForm<Dati>({ resolver: zodResolver(schema), defaultValues: VUOTO });
  const errori = form.formState.errors;

  if (utente.ruolo === "ADMIN") {
    return (
      <Scheda titolo="Email">
        <p className="m-0 text-sm text-chalk-muted">{ADMIN_DALLA_CONFIGURAZIONE}</p>
      </Scheda>
    );
  }

  const invia = form.handleSubmit(async (dati) => {
    setMessaggio(null);
    // Un rifiuto del server lascia i campi pieni e senza messaggio di riuscita
    await esegui(async () => {
      setMessaggio(await profiloApi.richiediCambioEmail(dati.nuovaEmail, dati.password));
      form.reset(VUOTO);
    });
  });

  let testoPulsante = "Invia il link di conferma";
  if (invio) testoPulsante = "Invio in corso…";

  return (
    <Scheda titolo="Email">
      {/* L'email è scritta dall'utente: solo come testo */}
      <p className="mt-0 mb-3 text-sm text-chalk-muted">Email attuale: <span className="text-chalk">{utente.email}</span></p>
      <form className="flex flex-col gap-3" onSubmit={invia} noValidate>
        <Input label="Nuova email" type="email" autoComplete="email" {...form.register("nuovaEmail")}
          error={!!errori.nuovaEmail} hint={errori.nuovaEmail?.message} />
        <Input label="Password attuale" type="password" autoComplete="current-password" {...form.register("password")}
          error={!!errori.password} hint={errori.password?.message} />
        <Esito messaggio={messaggio} errore={errore} />
        <Button type="submit" className="self-start" disabled={invio}>{testoPulsante}</Button>
      </form>
    </Scheda>
  );
}
