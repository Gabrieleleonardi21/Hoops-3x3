/** Recupero della password: due rotte pubbliche (senza JWT) di /api/auth/password. In entrambe il server risponde con un
 *  `message` da mostrare com'è; un rifiuto (400) o la rete assente sono un ApiError, che la schermata fa vedere. */
import { api } from "./api";
import { messaggioDi } from "./messaggioServer";
import { RISPOSTA_RECUPERO_NON_VALIDA } from "../utils/testi";

export const recuperoApi = {
  /** Chiede il link di recupero. Il server risponde sempre 200 con lo stesso messaggio, che l'email esista o no */
  async richiediLink(email: string): Promise<string> {
    const risposta = await api<unknown>("/api/auth/password/dimenticata", { method: "POST", body: { email } });
    return messaggioDi(risposta, RISPOSTA_RECUPERO_NON_VALIDA);
  },

  /** Imposta la nuova password con il token del link (non valido, scaduto o già usato → 400) */
  async reimposta(token: string, nuovaPassword: string): Promise<string> {
    const risposta = await api<unknown>("/api/auth/password/reimposta", { method: "POST", body: { token, nuovaPassword } });
    return messaggioDi(risposta, RISPOSTA_RECUPERO_NON_VALIDA);
  },
};
