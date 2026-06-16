/** Utente attivo nella sessione corrente (registrato o ospite) */
export interface User {
  name: string;
  email?: string;   // assente per gli ospiti
  guest: boolean;   // true = modalità ospite senza account
}

/** Account salvato nel localStorage (demo: in produzione gestire lato server) */
export interface Account {
  name: string;
  email: string;
  hash: string; // SHA-256 della password — solo a scopo dimostrativo
}
