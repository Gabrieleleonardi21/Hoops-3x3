/** Il profilo di chi ha un account: nome utente e password (le schede dell'email e dell'eliminazione si aggiungono sotto).
 *  L'ospite non ha un account: legge il perché, senza form. La pagina sta dentro RequireAuth (App.tsx). */
import { CambioNome } from "../components/profilo/CambioNome";
import { CambioPassword } from "../components/profilo/CambioPassword";
import { ProfiloOspite } from "../components/profilo/ProfiloOspite";
import { useUtente } from "../hooks/useUtente";

export function ProfiloPage() {
  const utente = useUtente();
  if (utente.guest) return <ProfiloOspite />;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <div>
        <h2 className="mt-0 mb-1 font-display text-2xl text-chalk">Il tuo account</h2>
        {/* L'email è scritta dall'utente: solo come testo */}
        <p className="m-0 text-sm text-chalk-muted">{utente.email}</p>
      </div>
      <CambioNome />
      <CambioPassword />
    </div>
  );
}
