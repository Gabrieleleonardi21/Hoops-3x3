/** Scheda «Password»: serve quella attuale (un JWT rubato da solo non basta), la nuova ha le regole della registrazione. Il server
 *  chiude le altre sessioni e rinnova questa: profiloApi salva il token nuovo, qui si aggiorna l'utente e si svuota il form. */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../hooks/useAuth";
import { useInvio } from "../../hooks/useInvio";
import { useUtente } from "../../hooks/useUtente";
import { profiloApi } from "../../services/profiloApi";
import { passwordSchema } from "../../utils/credenziali";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Esito, Scheda } from "./Scheda";

// Il confronto con il secondo campo come in ReimpostaPasswordPage
const schema = z.object({ attuale: z.string().min(1, "Inserisci la password attuale"), nuova: passwordSchema, ripeti: z.string() })
  .refine((d) => d.nuova === d.ripeti, { path: ["ripeti"], message: "Le due password non coincidono" });
type Dati = z.infer<typeof schema>;
const VUOTO: Dati = { attuale: "", nuova: "", ripeti: "" };

export function CambioPassword() {
  useUtente(); // la scheda esiste solo per un utente entrato (come le altre)
  const { aggiorna } = useAuth();
  const { invio, errore, esegui } = useInvio();
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const form = useForm<Dati>({ resolver: zodResolver(schema), defaultValues: VUOTO });
  const errori = form.formState.errors;

  const invia = form.handleSubmit(async (dati) => {
    setMessaggio(null);
    const riuscito = await esegui(async () => {
      aggiorna(await profiloApi.cambiaPassword(dati.attuale, dati.nuova));
      form.reset(VUOTO);
    });
    if (riuscito) setMessaggio("Password aggiornata. Gli altri dispositivi sono stati scollegati.");
  });

  let testoPulsante = "Cambia la password";
  if (invio) testoPulsante = "Salvataggio in corso…";

  return (
    <Scheda titolo="Password">
      <form className="flex flex-col gap-3" onSubmit={invia} noValidate>
        <Input label="Password attuale" type="password" autoComplete="current-password" {...form.register("attuale")}
          error={!!errori.attuale} hint={errori.attuale?.message} />
        <Input label="Nuova password" type="password" autoComplete="new-password" {...form.register("nuova")}
          error={!!errori.nuova} hint={errori.nuova?.message} />
        <Input label="Ripeti la password" type="password" autoComplete="new-password" {...form.register("ripeti")}
          error={!!errori.ripeti} hint={errori.ripeti?.message} />
        <Esito messaggio={messaggio} errore={errore} />
        <Button type="submit" className="self-start" disabled={invio}>{testoPulsante}</Button>
      </form>
    </Scheda>
  );
}
