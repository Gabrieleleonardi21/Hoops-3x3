/** Profilo dell'utente: nome, password, email ed eliminazione dell'account (rotte sotto /api/auth/me, più la conferma dell'email,
 *  pubblica: il link arriva anche a chi non è entrato). Le risposte si validano con zod come nel recupero della password; un rifiuto
 *  del server (400 password sbagliata, 403 ADMIN, 409 email già registrata, 429) è un ApiError con il suo messaggio, che la scheda
 *  mostra com'è. Password e token viaggiano solo nel corpo delle richieste: mai nei log né nell'URL. */
import { z } from "zod";
import { api, ApiError, token } from "./api";
import { toUser } from "./authService";
import { messaggioDi } from "./messaggioServer";
import { RISPOSTA_PROFILO_NON_VALIDA } from "../utils/testi";
import type { User } from "../types";

const utenteSchema = z.object({
  id: z.string(), name: z.string(), email: z.string(), ruolo: z.enum(["USER", "ADMIN"]),
});
const authSchema = z.object({ token: z.string().min(1), user: utenteSchema });

/** L'utente della risposta come utente di sessione. Fuori forma → ApiError: non si inventa un utente */
function utenteDi(risposta: unknown): User {
  const esito = utenteSchema.safeParse(risposta);
  if (!esito.success) throw new ApiError(200, RISPOSTA_PROFILO_NON_VALIDA);
  return toUser(esito.data);
}

export const profiloApi = {
  /** Cambia il nome utente (2-80 caratteri). Restituisce l'utente com'è sul server */
  async cambiaNome(name: string): Promise<User> {
    return utenteDi(await api<unknown>("/api/auth/me", { method: "PATCH", body: { name } }));
  },

  /** Cambia la password. Il server chiude le altre sessioni e rinnova questa: il JWT nuovo sostituisce quello salvato PRIMA di
   *  restituire l'utente, altrimenti la scheda continuerebbe con un token il cui cookie di refresh non rinnova più */
  async cambiaPassword(attuale: string, nuova: string): Promise<User> {
    const risposta = await api<unknown>("/api/auth/me/password", {
      method: "POST", body: { passwordAttuale: attuale, nuovaPassword: nuova },
    });
    const esito = authSchema.safeParse(risposta);
    if (!esito.success) throw new ApiError(200, RISPOSTA_PROFILO_NON_VALIDA);
    // «Esci» premuto mentre la richiesta era in volo: il server ha già riaperto una sessione per questo browser, ma il JWT nuovo non si
    // salva (rimetterebbe dentro chi è uscito) e la sessione si chiude subito, come fa il rinnovo in api.ts
    if (!token.get()) {
      await api<void>("/api/auth/logout", { method: "POST", keepalive: true }).catch(() => {});
      return toUser(esito.data.user);
    }
    token.set(esito.data.token);
    return toUser(esito.data.user);
  },

  /** Chiede il cambio dell'email: il server manda un link al NUOVO indirizzo, e l'email cambia solo quando lo si conferma */
  async richiediCambioEmail(nuovaEmail: string, password: string): Promise<string> {
    const risposta = await api<unknown>("/api/auth/me/email", { method: "POST", body: { nuovaEmail, password } });
    return messaggioDi(risposta, RISPOSTA_PROFILO_NON_VALIDA);
  },

  /** Conferma il nuovo indirizzo con il token del link (non valido, scaduto o già usato → 400; indirizzo preso nel frattempo → 409) */
  async confermaEmail(tokenLink: string): Promise<string> {
    const risposta = await api<unknown>("/api/auth/email/conferma", { method: "POST", body: { token: tokenLink } });
    return messaggioDi(risposta, RISPOSTA_PROFILO_NON_VALIDA);
  },

  /** Elimina l'account (204, nessun corpo). È un POST e non un DELETE perché il corpo porta la password */
  async eliminaAccount(password: string): Promise<void> {
    await api<void>("/api/auth/me/elimina", { method: "POST", body: { password } });
  },
};
