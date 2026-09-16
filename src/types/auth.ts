/** Utente attivo nella sessione corrente (registrato o ospite) */
export interface User {
  name: string;
  email?: string;   // assente per gli ospiti
  guest: boolean;   // true = modalità ospite senza account (dati solo nel browser)
  id?: string;      // id lato server (solo registrati)
  ruolo?: "USER" | "ADMIN";
}
