/** Regole dei campi di accesso, condivise da registrazione, accesso e recupero della password: così la nuova password ha le
 *  stesse regole di quella della registrazione, scritte in un posto solo. */
import { z } from "zod";

/** Byte massimi di una password: BCrypt ignora quanto supera i 72 byte, e il server la rifiuta */
const BYTE_MASSIMI_PASSWORD = 72;
const codifica = new TextEncoder();

export const emailSchema = z.string().email("Mail non valida");

/** Da 8 caratteri a 72 byte UTF-8: il tetto è in byte, non in caratteri (una «è» ne occupa 2) */
export const passwordSchema = z.string()
  .min(8, "Password di almeno 8 caratteri")
  .refine((p) => codifica.encode(p).length <= BYTE_MASSIMI_PASSWORD, "Password di al massimo 72 byte");

/** Da 2 a 80 caratteri come il server (RegisterRequestDTO e CambioNomeDTO; gli 80 sono anche il maxLength dei campi). Il campo
 *  vuoto ha il suo messaggio. Lo usano la registrazione e il cambio del nome nel profilo. */
export const nomeUtenteSchema = z.string()
  .trim() // si contano i caratteri senza gli spazi ai bordi (« a» non vale 2), e il nome che parte è già ripulito
  .min(1, "Inserisci il nome utente")
  .min(2, "Nome utente di almeno 2 caratteri")
  .max(80, "Nome utente di al massimo 80 caratteri");
