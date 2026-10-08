/** Chiamata al modello per Coach AI tramite il backend (POST /api/coach/chat), che inoltra
 *  a Groq con la chiave tenuta sul server. Serve un account registrato (endpoint autenticato). */
import { api, ApiError } from "./api";
export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  /** Nomi dei tool eseguiti per produrre questa risposta (solo assistant; mostrati come badge in chat). */
  tools?: string[];
}

/** Definizione di una proprietà parametro (supporta scalari e array). */
export interface ToolParamProp {
  type: string;
  description: string;
  items?: { type: string }; // usato quando type === "array"
  enum?: string[];          // valori ammessi (es. la modalità di sorteggio)
}

/** Definizione di uno strumento che l'AI può invocare (formato OpenAI function calling). */
export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, ToolParamProp>;
      required: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** Codici di errore tipizzati per mostrare messaggi specifici all'utente.
 *  BAD_REQUEST = richiesta rifiutata dal server (400): il suo messaggio dice che cosa fare. */
export type AiErrorCode = "AUTH" | "RATE" | "UNAVAILABLE" | "BAD_REQUEST" | "SERVER" | "NETWORK";

export class AiError extends Error {
  /** Strumenti già eseguiti quando l'errore è arrivato a metà del ciclo (askCoachWithTools): le azioni sono avvenute, e la chat
   *  le mostra anche con l'errore */
  calledTools: string[] = [];
  constructor(public code: AiErrorCode, message: string) {
    super(message);
  }
}

// Messaggio a livello API: superset di ChatMsg, include messaggi tool non mostrati in UI
interface ApiMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/** Limiti di ogni richiesta al Coach del server (CoachAiService.valida): oltre risponde 400. Messaggi compreso il preambolo, e
 *  caratteri dei messaggi in JSON */
const MAX_MESSAGGI_SERVER = 60;
const MAX_CARATTERI_SERVER = 100_000;

/** Fa stare `messages` nei limiti del server prima di una chiamata, togliendo i messaggi più vecchi della cronologia (subito dopo
 *  il preambolo). Non tocca il preambolo, la domanda di adesso (l'ultimo della cronologia) né gli scambi con gli strumenti di questa
 *  richiesta, che vengono dopo. `cronologia` = quanti messaggi della cronologia restano; restituisce il nuovo numero, e `ciSta` false
 *  se nemmeno così la richiesta rientra */
function neiLimiti(messages: ApiMsg[], cronologia: number): { cronologia: number; ciSta: boolean } {
  const troppi = () => messages.length > MAX_MESSAGGI_SERVER || JSON.stringify(messages).length > MAX_CARATTERI_SERVER;
  while (troppi() && cronologia > 1) {
    messages.splice(1, 1);
    cronologia--;
  }
  return { cronologia, ciSta: !troppi() };
}

/** Il ciclo ha eseguito delle azioni ma la conversazione non entra più in una richiesta: si chiude senza chiedere il riepilogo */
const TROPPO_LUNGA = "Ho eseguito le azioni indicate qui sotto, ma la conversazione è diventata troppo lunga per un riepilogo: "
  + "cancella la chat per continuare.";
/** Come sopra, ma senza nessuna azione eseguita: il preambolo e la domanda da soli non entrano nei limiti del server */
const TROPPO_LUNGA_SENZA_AZIONI = "La conversazione è diventata troppo lunga per una richiesta al Coach: cancella la chat per continuare.";

/** Tempo massimo della chat (ms): il server aspetta il modello fino a 60 secondi (CoachAiService), quindi il client
 *  aspetta un po' di più, per ricevere la risposta o l'errore del server invece di abbandonare prima */
const TEMPO_MASSIMO_COACH = 65_000;

/** Chiamata HTTP al Coach del backend (POST /api/coach/chat, che parla con il modello): messaggi API-level e, se servono, le
 *  definizioni degli strumenti */
async function chiamaCoach(
  messages: ApiMsg[],
  tools?: ToolDef[],
): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  let data: { choices?: { message?: { content?: string; tool_calls?: ToolCall[] } }[]; error?: { message?: string } };
  try {
    data = await api("/api/coach/chat", {
      method: "POST", body: { messages, tools: tools ?? [] }, tempoMassimo: TEMPO_MASSIMO_COACH,
    });
  } catch (e) {
    if (!(e instanceof ApiError)) throw new AiError("SERVER", "errore imprevisto");
    if (e.status === 0) throw new AiError("NETWORK", e.message);
    if (e.status === 400) throw new AiError("BAD_REQUEST", e.message);
    if (e.status === 401) throw new AiError("AUTH", e.message);
    if (e.status === 429) throw new AiError("RATE", e.message);
    if (e.status === 503) throw new AiError("UNAVAILABLE", e.message);
    throw new AiError("SERVER", e.message);
  }
  if (data.error) throw new AiError("SERVER", data.error.message || "errore API Groq");

  const msg = data.choices?.[0]?.message;
  return { content: msg?.content?.trim() ?? null, tool_calls: msg?.tool_calls };
}

/** Chiamata semplice senza tool calling (compatibilità con il vecchio flusso). */
export async function askCoach(preamble: string, history: ChatMsg[]): Promise<string> {
  // Mappa a {role, content}: scarta eventuali campi extra (es. `tools`) dal payload API
  const messages: ApiMsg[] = [
    { role: "system", content: preamble },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  const { content } = await chiamaCoach(messages);
  return content || "Non ho una risposta ora, riprova.";
}

/** Esegue uno strumento: riceve nome e argomenti e restituisce il testo per il modello; se l'azione non si può fare
 *  lancia un errore con il motivo. Può essere async. */
type OnToolCall = (name: string, args: Record<string, unknown>) => string | Promise<string>;

/** Argomenti di una chiamata: un oggetto JSON. null se il testo non si legge o non è un oggetto (null, un elenco…) */
function leggiArgomenti(testo: string): Record<string, unknown> | null {
  try {
    const args: unknown = JSON.parse(testo);
    if (typeof args === "object" && args !== null && !Array.isArray(args)) return args as Record<string, unknown>;
  } catch { /* JSON non valido */ }
  return null;
}

/** Richiesta abbandonata (chat cancellata, logout): niente altre chiamate al modello né altri strumenti. Le chiamate
 *  consumerebbero il limite di richieste e, dopo un nuovo accesso, partirebbero con il token di un altro utente */
function fermaSeAbbandonata(segnale?: AbortSignal) {
  if (segnale?.aborted) throw segnale.reason;
}

/** Esegue uno strumento senza mai interrompere il ciclo. Con argomenti non validi lo strumento non parte (prima
 *  partiva con argomenti vuoti). Un errore dello strumento (un rifiuto, un 403, la rete) diventa il suo risultato:
 *  il modello sa che cosa è fallito e lo spiega. `eseguito` false = l'azione non è avvenuta, niente badge. */
async function eseguiProtetto(onToolCall: OnToolCall, name: string, argomenti: string) {
  const args = leggiArgomenti(argomenti);
  if (!args) return { risultato: "Argomenti non validi (serve un oggetto JSON): azione non eseguita.", eseguito: false };
  try {
    return { risultato: await onToolCall(name, args), eseguito: true };
  } catch (e) {
    let motivo = "errore imprevisto";
    if (e instanceof Error) motivo = e.message;
    return { risultato: `Errore: ${motivo}`, eseguito: false };
  }
}

/**
 * Chiamata con tool calling in loop agentico. Finché l'AI invoca strumenti:
 * 1. registra il turno assistant che li richiede
 * 2. esegue onToolCall per ogni tool e rimanda i risultati come messaggi tool
 * 3. richiama il modello; ripete finché risponde con testo o si raggiunge il cap
 *
 * I tool dello stesso turno girano IN SEQUENZA: così un tool che dipende da un altro
 * (es. sorteggia_gironi dopo crea_tappa) legge lo stato già aggiornato, senza race.
 * Ogni esecuzione è protetta (eseguiProtetto): uno strumento che fallisce non ferma gli altri.
 *
 * Guardia anti-stallo: una chiamata con firma (nome + argomenti) identica a una già
 * fatta (riuscita o no) non viene rieseguita; se un round contiene solo ricicli il loop si chiude,
 * evitando di bruciare i round con un modello bloccato che ripete la stessa azione.
 *
 * Prima di ogni chiamata la richiesta si fa stare nei limiti del server (neiLimiti): 30 messaggi di cronologia più 8 giri di
 * strumenti superano i 60 messaggi che il server accetta. Se un errore (rete, 429, server) interrompe il ciclo a metà, l'AiError
 * porta in `calledTools` gli strumenti già eseguiti: le loro azioni sono avvenute.
 *
 * @param onToolCall - vedi OnToolCall: un errore lanciato diventa il risultato dello strumento
 * @param segnale - interrompe la richiesta: prima di ogni chiamata al modello e di ogni strumento si controlla, e se è
 *   interrotta la promessa è rifiutata con il motivo del segnale
 * @returns testo finale da mostrare in chat + nomi degli strumenti eseguiti (non quelli falliti o non partiti)
 */
export async function askCoachWithTools(
  preamble: string,
  history: ChatMsg[],
  tools: ToolDef[],
  onToolCall: OnToolCall,
  segnale?: AbortSignal,
): Promise<{ text: string; calledTools: string[] }> {
  const messages: ApiMsg[] = [
    { role: "system", content: preamble },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const calledTools: string[] = [];
  try {
    return await ciclo(messages, history.length, tools, onToolCall, calledTools, segnale);
  } catch (e) {
    if (e instanceof AiError) e.calledTools = [...calledTools];
    throw e;
  }
}

/** Il ciclo di askCoachWithTools; `calledTools` si riempie man mano, così chi chiama lo ha anche se il ciclo lancia */
async function ciclo(
  messages: ApiMsg[],
  nCronologia: number,
  tools: ToolDef[],
  onToolCall: OnToolCall,
  calledTools: string[],
  segnale?: AbortSignal,
): Promise<{ text: string; calledTools: string[] }> {
  let cronologia = nCronologia;
  /** Prepara la prossima chiamata nei limiti del server; false se non ci sta */
  const ciSta = () => {
    const esito = neiLimiti(messages, cronologia);
    cronologia = esito.cronologia;
    return esito.ciSta;
  };
  // Firme (nome + argomenti) dei tool già eseguiti in questa richiesta: blocca i ricicli
  // identici di un modello bloccato (es. richiama crea_tappa che risponde "già creata").
  const seen = new Set<string>();
  // Cap ai round di tool: copre un flusso completo di tappa (crea → sorteggia →
  // risultati → fasi dirette → risultati → concludi) e blocca eventuali loop infiniti.
  const MAX_TOOL_ROUNDS = 8;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    fermaSeAbbandonata(segnale);
    // Un altro giro non entra nei limiti del server: si passa alla chiusura
    if (!ciSta()) break;
    const res = await chiamaCoach(messages, tools);

    // Nessun tool richiesto: è la risposta finale da mostrare in chat
    if (!res.tool_calls?.length) {
      return { text: res.content || "Non ho una risposta ora, riprova.", calledTools };
    }

    // Registra il turno assistant che ha richiesto i tool
    messages.push({ role: "assistant", content: res.content, tool_calls: res.tool_calls });

    // Esegue i tool in sequenza e accoda ogni risultato come messaggio tool
    let eseguitoQualcosa = false; // false se il round contiene SOLO ricicli → si esce
    for (const tc of res.tool_calls) {
      fermaSeAbbandonata(segnale);
      // Guardia anti-stallo: stesso tool con gli stessi argomenti già chiamato → non ripetere. Il testo non dice
      // «eseguita»: la prima chiamata può essere fallita, e il modello direbbe all'utente che è fatta
      const firma = `${tc.function.name}:${tc.function.arguments}`;
      if (seen.has(firma)) {
        messages.push({ role: "tool", tool_call_id: tc.id, content: `Azione "${tc.function.name}" già chiamata con gli stessi argomenti in questa richiesta (vedi il suo risultato): non ripeterla, rispondi all'utente.` });
        continue;
      }

      seen.add(firma);
      eseguitoQualcosa = true;
      const { risultato, eseguito } = await eseguiProtetto(onToolCall, tc.function.name, tc.function.arguments);
      if (eseguito) calledTools.push(tc.function.name);
      messages.push({ role: "tool", tool_call_id: tc.id, content: risultato });
    }

    // Round di soli ricicli: il modello è bloccato, esci e chiudi con una risposta testuale
    if (!eseguitoQualcosa) break;
  }

  // Cap raggiunto o loop interrotto: una chiamata finale senza tool forza la risposta di chiusura.
  fermaSeAbbandonata(segnale);
  if (!ciSta()) {
    if (calledTools.length === 0) return { text: TROPPO_LUNGA_SENZA_AZIONI, calledTools };
    return { text: TROPPO_LUNGA, calledTools };
  }
  const final = await chiamaCoach(messages);
  return { text: final.content || "Fatto!", calledTools };
}
