/** La lettura delle foto dei fogli per «Importa file»: ogni foto si riduce nel browser e va al server, una alla volta.
 *  La foto ridotta esiste solo come variabile locale mentre parte: non si salva (né localStorage né sessionStorage), non entra
 *  nella cronologia del Coach e non si logga. */
import { useCallback, useState } from "react";
import { ApiError } from "../services/api";
import { foglioApi } from "../services/foglioApi";
import { PIANO_RIDUZIONE, misuraRidotta, troppoGrande } from "../utils/ridimensionaFoto";
import { FOTO_NON_APRIBILE, FOTO_NON_RIDUCIBILE, LETTURA_FALLITA, LETTURA_IN_CORSO } from "../utils/testi";
import type { BozzaFoglio } from "../types";

/** Errore della riduzione: nomina già la foto, e arriva alla pagina com'è (senza il prefisso «Foto «x»: ») */
class ErroreRiduzione extends Error {}

/** La foto ridotta come data URL JPEG. Un data URL e non un blob: la CSP del sito ammette `data:` e non `blob:`, e il server lo
 *  vuole così. createImageBitmap con `from-image` raddrizza le foto del telefono, che arrivano coricate con l'orientamento solo
 *  nell'EXIF. Due passi: il primo tiene la foto leggibile, il secondo serve ai fogli fotografati con molti dettagli che a 1600 px
 *  superano ancora il limite del server; oltre, la foto va ritagliata. */
async function ridimensiona(file: File): Promise<string> {
  let immagine: ImageBitmap;
  try {
    immagine = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ErroreRiduzione(FOTO_NON_APRIBILE(file.name));
  }
  try {
    for (const passo of PIANO_RIDUZIONE) {
      const misura = misuraRidotta(immagine.width, immagine.height, passo.lato);
      const canvas = document.createElement("canvas");
      canvas.width = misura.larghezza;
      canvas.height = misura.altezza;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ErroreRiduzione(FOTO_NON_APRIBILE(file.name));
      ctx.drawImage(immagine, 0, 0, misura.larghezza, misura.altezza);
      const dataUrl = canvas.toDataURL("image/jpeg", passo.qualita);
      if (!troppoGrande(dataUrl)) return dataUrl;
    }
  } finally {
    immagine.close();
  }
  throw new ErroreRiduzione(FOTO_NON_RIDUCIBILE(file.name));
}

/** Il motivo di una lettura fallita, per l'utente: il messaggio del server (ApiError, anche 401 dopo il rinnovo e 429 con i
 *  secondi), altrimenti uno generico */
function motivo(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "errore imprevisto";
}

/** `leggiFoto` riduce e manda le foto una per una e restituisce le bozze nell'ordine. Alla prima che fallisce lancia un Error con
 *  il nome della foto e il motivo, e non manda le successive: un import a metà non c'è, e rimandarle chiede un nuovo clic.
 *  `stato` è il testo «Lettura del foglio i di n…» mentre si legge, null altrimenti. */
export function useImportaFoto() {
  const [stato, setStato] = useState<string | null>(null);

  const leggiFoto = useCallback(async (files: File[]): Promise<BozzaFoglio[]> => {
    const bozze: BozzaFoglio[] = [];
    try {
      for (const [i, file] of files.entries()) {
        setStato(LETTURA_IN_CORSO(i + 1, files.length));
        const immagine = await ridimensiona(file);
        try {
          bozze.push(await foglioApi.leggi(immagine));
        } catch (e) {
          throw new Error(LETTURA_FALLITA(file.name, motivo(e)));
        }
      }
    } finally {
      setStato(null);
    }
    return bozze;
  }, []);

  return { leggiFoto, stato };
}
