/** La geometria della riduzione di una foto del foglio prima di mandarla al server (il canvas sta in hooks/useImportaFoto: qui solo
 *  i conti, che si provano senza browser). Una foto del telefono pesa 3-12 MB: ridotta a 1600 px sul lato lungo resta leggibile
 *  per il lettore e sta nel limite del server. */

/** I passi della riduzione, in ordine: si prova il primo e, se il risultato supera ancora MAX_BASE64, il secondo */
export const PIANO_RIDUZIONE = [{ lato: 1600, qualita: 0.8 }, { lato: 1200, qualita: 0.7 }];

/** Caratteri base64 al massimo di un'immagine: lo stesso limite del server (FoglioService.MAX_BASE64), oltre risponde 400 */
export const MAX_BASE64 = 1_500_000;

/** Le misure con il lato lungo al massimo `latoMassimo` e le stesse proporzioni, in pixel interi (almeno 1). Una foto già
 *  più piccola resta com'è: ingrandirla peserebbe di più senza leggersi meglio */
export function misuraRidotta(larghezza: number, altezza: number, latoMassimo: number): { larghezza: number; altezza: number } {
  const scala = Math.min(1, latoMassimo / Math.max(larghezza, altezza));
  return { larghezza: Math.max(1, Math.round(larghezza * scala)), altezza: Math.max(1, Math.round(altezza * scala)) };
}

/** true se la parte base64 del data URL (dopo la virgola) supera il limite del server */
export function troppoGrande(dataUrl: string): boolean {
  return dataUrl.length - (dataUrl.indexOf(",") + 1) > MAX_BASE64;
}
