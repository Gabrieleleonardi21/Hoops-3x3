/** Scheda «Nome utente»: il nome nuovo vale subito (intestazione compresa) e compare come autore in anagrafe, archivio e campetti. */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "../../hooks/useAuth";
import { useInvio } from "../../hooks/useInvio";
import { useUtente } from "../../hooks/useUtente";
import { profiloApi } from "../../services/profiloApi";
import { nomeUtenteSchema } from "../../utils/credenziali";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Esito, Scheda } from "./Scheda";

const schema = z.object({ name: nomeUtenteSchema });
type Dati = z.infer<typeof schema>;

export function CambioNome() {
  const utente = useUtente();
  const { aggiorna } = useAuth();
  const { invio, errore, esegui } = useInvio();
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const form = useForm<Dati>({ resolver: zodResolver(schema), defaultValues: { name: utente.name } });
  const errori = form.formState.errors;

  const invia = form.handleSubmit(async (dati) => {
    setMessaggio(null);
    const riuscito = await esegui(async () => {
      const aggiornato = await profiloApi.cambiaNome(dati.name);
      aggiorna(aggiornato);
      // Il campo mostra il nome com'è sul server (che lo ripulisce dagli spazi ai bordi)
      form.reset({ name: aggiornato.name });
    });
    if (riuscito) setMessaggio("Nome aggiornato.");
  });

  let testoPulsante = "Salva il nome";
  if (invio) testoPulsante = "Salvataggio in corso…";

  return (
    <Scheda titolo="Nome utente">
      <form className="flex flex-col gap-3" onSubmit={invia} noValidate>
        <Input label="Nome utente" autoComplete="username" maxLength={80} {...form.register("name")}
          error={!!errori.name} hint={errori.name?.message} />
        <Esito messaggio={messaggio} errore={errore} />
        <Button type="submit" className="self-start" disabled={invio}>{testoPulsante}</Button>
      </form>
    </Scheda>
  );
}
