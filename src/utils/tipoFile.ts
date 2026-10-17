/** Il tipo di un file scelto con «Importa file», deciso dai primi byte. Il nome e il `type` del File non contano: il browser
 *  ricava il `type` dall'estensione, e un PDF rinominato .jpg (o un HTML salvato come .json) passerebbe. Le stesse firme le
 *  controlla anche il server sulle foto: qui servono a dire subito che cosa non va, senza mandare niente. */

export type TipoFile = "json" | "jpeg" | "png" | "webp";

/** Quanti byte servono per riconoscere le firme (WebP arriva al byte 11; per il JSON bastano BOM e qualche spazio) */
const BYTE_LETTI = 16;

/** Firme delle foto ammesse: i byte attesi a partire da `da` */
const FIRME: { tipo: TipoFile; parti: { da: number; byte: number[] }[] }[] = [
  { tipo: "jpeg", parti: [{ da: 0, byte: [0xff, 0xd8, 0xff] }] },
  { tipo: "png", parti: [{ da: 0, byte: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }] },
  // WebP: «RIFF», 4 byte di lunghezza, «WEBP» (un WAV è RIFF ma non WEBP)
  { tipo: "webp", parti: [{ da: 0, byte: [0x52, 0x49, 0x46, 0x46] }, { da: 8, byte: [0x57, 0x45, 0x42, 0x50] }] },
];

/** Byte bianchi ammessi prima della «{» di un JSON: spazio, tabulazione, a capo */
const BIANCHI = [0x20, 0x09, 0x0a, 0x0d];

/** true se il JSON comincia con un oggetto: dopo un eventuale BOM UTF-8 (EF BB BF) e gli spazi, il primo byte è «{» */
function eOggettoJson(b: Uint8Array): boolean {
  let i = 0;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3;
  while (i < b.length && BIANCHI.includes(b[i])) i++;
  return b[i] === 0x7b;
}

/** Il tipo del file dai suoi primi byte; null se non è né un JSON (oggetto) né una foto JPEG, PNG o WebP */
export async function tipoFile(file: File): Promise<TipoFile | null> {
  const b = new Uint8Array(await file.slice(0, BYTE_LETTI).arrayBuffer());
  const firma = FIRME.find((f) => f.parti.every((p) => p.byte.every((x, j) => b[p.da + j] === x)));
  if (firma) return firma.tipo;
  if (eOggettoJson(b)) return "json";
  return null;
}
