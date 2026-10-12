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
