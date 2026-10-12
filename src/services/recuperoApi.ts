/** Recupero della password: due rotte pubbliche (senza JWT) di /api/auth/password. In entrambe il server risponde con un
 *  `message` da mostrare com'è; un rifiuto (400) o la rete assente sono un ApiError, che la schermata fa vedere. */
import { z } from "zod";
import { api, ApiError } from "./api";
import { RISPOSTA_RECUPERO_NON_VALIDA } from "../utils/testi";

const rispostaSchema = z.object({ message: z.string().min(1) });

/** Il messaggio della risposta. Fuori forma → ApiError: non si inventa un testo al posto di quello del server */
function messaggioDi(risposta: unknown): string {
  const esito = rispostaSchema.safeParse(risposta);
  if (!esito.success) throw new ApiError(200, RISPOSTA_RECUPERO_NON_VALIDA);
  return esito.data.message;
}

export const recuperoApi = {
  /** Chiede il link di recupero. Il server risponde sempre 200 con lo stesso messaggio, che l'email esista o no */
  async richiediLink(email: string): Promise<string> {
    return messaggioDi(await api<unknown>("/api/auth/password/dimenticata", { method: "POST", body: { email } }));
  },

  /** Imposta la nuova password con il token del link (non valido, scaduto o già usato → 400) */
  async reimposta(token: string, nuovaPassword: string): Promise<string> {
    return messaggioDi(await api<unknown>("/api/auth/password/reimposta", { method: "POST", body: { token, nuovaPassword } }));
  },
};
