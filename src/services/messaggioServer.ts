/** Risposte dei client REST che portano solo un `message` da mostrare com'è (recupero della password, cambio email). */
import { z } from "zod";
import { ApiError } from "./api";

const rispostaSchema = z.object({ message: z.string().min(1) });

/** Il messaggio della risposta. Fuori forma → ApiError con `seNonValida`: non si inventa un testo al posto di quello del server */
export function messaggioDi(risposta: unknown, seNonValida: string): string {
  const esito = rispostaSchema.safeParse(risposta);
  if (!esito.success) throw new ApiError(200, seNonValida);
  return esito.data.message;
}
