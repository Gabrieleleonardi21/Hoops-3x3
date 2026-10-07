/** Hook di autenticazione: login, registrazione (backend + JWT) e modalità ospite (solo browser).
 *  L'utente della sessione è persistito in localStorage così il reload non obbliga a rifare il login;
 *  il token JWT lo gestisce services/api.ts.
 *  La cache dell'anagrafe si svuota a ogni accesso, registrazione e uscita (anche dell'ospite): il server manda i dati personali
 *  solo a chi ha un token, quindi chi entra deve riscaricarla completa e chi esce non deve tenere in memoria dati riservati. */
import { useAppStore, SESSION_KEY } from "../stores/useAppStore";
import { useAnagrafeStore } from "../stores/useAnagrafeStore";
import * as authService from "../services/authService";
import type { User } from "../types";

/** Salva l'utente della sessione nel browser (anche App.tsx, quando all'avvio il server restituisce quello aggiornato) */
export function saveSession(u: User) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch { /* quota exceeded */ }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function useAuth() {
  const { user, setUser, reset, rehydrate, salvaTutto } = useAppStore();

  /** Chi ha appena fatto l'accesso o la registrazione entra: il token c'è già (lo ha salvato authService), quindi l'anagrafe già in
   *  cache, vista senza token, ha la forma pubblica e si svuota; poi si caricano le leghe */
  const entra = async (u: User) => {
    setUser(u);
    saveSession(u);
    useAnagrafeStore.getState().svuota();
    await rehydrate();
  };

  /** Registrazione: il server risponde già con il token, poi si caricano le leghe (vuote) */
  const register = async (name: string, email: string, pass: string) => entra(await authService.register(name, email, pass));

  /** Login: lancia ApiError (401 credenziali, 0 server spento) che il form mostra all'utente */
  const login = async (email: string, pass: string) => entra(await authService.login(email, pass));

  const enterGuest = async () => {
    const u: User = { name: "Ospite", guest: true };
    setUser(u);
    saveSession(u);
    await rehydrate(); // ripristina eventuale lega ospite precedente
  };

  /** Uscita. Primo passo: salvare le modifiche ancora in attesa, finché il token c'è. Se qualcuna non arriva
   *  al server decide `conferma`, passata dall'interfaccia (il pulsante «Esci» mostra la finestra di conferma):
   *  false = l'utente resta. Lo stesso per l'ospite con modifiche che il browser non ha salvato (spazioEsaurito): non ha una
   *  coda, e `nonSalvate` resta 0. Senza `conferma` si esce comunque: è il caso della sessione già finita, quando
   *  salvare non è più possibile. Poi lo stato locale, così l'interfaccia non aspetta la rete, e la revoca sul server.
   *  @returns `uscito` false se l'utente ha scelto di restare; `nonSalvate` = tappe con modifiche che non sono
   *  arrivate al server (perse, se si è usciti) */
  const logout = async (
    conferma?: (nonSalvate: number) => Promise<boolean>,
  ): Promise<{ uscito: boolean; nonSalvate: number }> => {
    const nonSalvate = await salvaTutto();
    const { user: chiEsce, spazioEsaurito } = useAppStore.getState();
    const eraOspite = chiEsce?.guest === true;
    if ((nonSalvate > 0 || (eraOspite && spazioEsaurito)) && conferma) {
      const esci = await conferma(nonSalvate);
      if (!esci) return { uscito: false, nonSalvate };
    }
    clearSession();
    reset();
    // Prima di aspettare la rete, senza await fino alla cancellazione del token (dentro authService.logout): nessun caricamento
    // può ripartire con il token di chi esce e riempire di nuovo la cache con i suoi dati riservati
    useAnagrafeStore.getState().svuota();
    // L'ospite non ha una sessione sul server: un token che c'è è di un'altra scheda, registrata, e cancellarlo (o revocarlo) la
    // farebbe uscire senza conferma, con le tappe non salvate perse. Esce solo lo stato dell'ospite
    if (!eraOspite) await authService.logout();
    return { uscito: true, nonSalvate };
  };

  return { user, register, login, enterGuest, logout };
}
