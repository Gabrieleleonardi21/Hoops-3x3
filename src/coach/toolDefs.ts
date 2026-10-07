/** Gli strumenti che il Coach AI può invocare nell'app, come li vede il modello: nome, descrizione e argomenti.
 *  Chi li esegue è in toolHandlers.ts, una funzione per strumento con lo stesso nome. */
import type { ToolDef } from "../services/aiService";
import { MAX_SQUADRE, MIN_SQUADRE } from "../constants/rules";

export const COACH_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "crea_lega",
      description: "Crea una nuova lega nell'app HOOP 3X3 e la imposta come attiva. Usalo solo se l'utente chiede esplicitamente di creare una lega.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome della lega da creare (es. 'Circuito Roma 2025')" },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crea_tappa",
      description: "Crea una nuova tappa nella lega attiva con tutte le squadre partecipanti. IMPORTANTE: chiama questo tool UNA SOLA VOLTA per tappa, mettendo TUTTE le squadre nell'array 'squadre'. NON chiamare questo tool più volte per la stessa tappa. Cerca le squadre nell'anagrafe per nome: se non esistono le registra automaticamente.",
      parameters: {
        type: "object",
        properties: {
          nome:    { type: "string", description: "Nome della tappa (es. 'Tappa 1 Roma')" },
          luogo:   { type: "string", description: "Luogo dove si svolge la tappa" },
          data:    { type: "string", description: "Data in formato YYYY-MM-DD" },
          squadre: { type: "array",  description: `Array con i nomi di TUTTE le squadre partecipanti, da ${MIN_SQUADRE} a ${MAX_SQUADRE}. Esempio: ['Ballers Roma', 'Street Kings', 'Wildcats']`, items: { type: "string" } },
          nGironi: { type: "number", description: "Numero di gironi: intero da 1 a metà delle squadre (default 2, oppure 1 con meno di 4 squadre)" },
        },
        required: ["nome", "squadre"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "annulla_risultato",
      description: "Annulla il risultato di una partita già registrata, riportandola a non disputata. Usalo se l'utente segnala un errore di inserimento.",
      parameters: {
        type: "object",
        properties: {
          squadra_a:  { type: "string", description: "Nome (o parte del nome) della prima squadra" },
          squadra_b:  { type: "string", description: "Nome (o parte del nome) della seconda squadra" },
          tappa_nome: { type: "string", description: "Nome della tappa (opzionale, default: ultima tappa)" },
        },
        required: ["squadra_a", "squadra_b"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "aggiorna_squadra",
      description: "Aggiorna i dati di una squadra già esistente nell'anagrafe (es. logo, città, referente). Passa solo i campi da modificare.",
      parameters: {
        type: "object",
        properties: {
          nome:      { type: "string", description: "Nome attuale della squadra (per trovarla in anagrafe)" },
          citta:     { type: "string", description: "Nuova città" },
          referente: { type: "string", description: "Nuovo referente/capitano" },
          logo:      { type: "string", description: "Nuovo URL del logo" },
          website:   { type: "string", description: "Nuovo URL del sito web" },
          instagram: { type: "string", description: "Nuovo URL Instagram" },
          anno:      { type: "string", description: "Anno di fondazione" },
          rank:      { type: "string", description: "Punti ranking circuito" },
          note:      { type: "string", description: "Note libere" },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registra_squadra",
      description: "Registra una nuova squadra nell'anagrafe condivisa del circuito. Usalo solo se l'utente chiede esplicitamente di aggiungere o registrare una squadra.",
      parameters: {
        type: "object",
        properties: {
          nome:      { type: "string", description: "Nome della squadra (obbligatorio)" },
          citta:     { type: "string", description: "Città di provenienza" },
          anno:      { type: "string", description: "Anno di fondazione" },
          rank:      { type: "string", description: "Punti ranking circuito" },
          referente: { type: "string", description: "Nome del referente o capitano" },
          logo:      { type: "string", description: "URL del logo (opzionale)" },
          website:   { type: "string", description: "URL del sito web (opzionale)" },
          instagram: { type: "string", description: "URL Instagram (opzionale)" },
          note:      { type: "string", description: "Note libere sulla squadra" },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registra_giocatore",
      description: "Registra un nuovo giocatore nell'anagrafe condivisa del circuito. Usalo solo se l'utente chiede esplicitamente di aggiungere o registrare un giocatore.",
      parameters: {
        type: "object",
        properties: {
          nome:        { type: "string", description: "Nome del giocatore (obbligatorio)" },
          cognome:     { type: "string", description: "Cognome del giocatore (obbligatorio)" },
          squadra:     { type: "string", description: "Nome della squadra di appartenenza" },
          ruolo:       { type: "string", description: "Ruolo (es. Playmaker, Ala, Centro)" },
          nascita:     { type: "string", description: "Data di nascita in formato YYYY-MM-DD" },
          citta:       { type: "string", description: "Città di provenienza" },
          nazionalita: { type: "string", description: "Nazionalità" },
          altezza:     { type: "string", description: "Altezza in cm" },
          peso:        { type: "string", description: "Peso in kg" },
          numero:      { type: "string", description: "Numero di maglia" },
          soprannome:  { type: "string", description: "Soprannome" },
          esperienza:  { type: "string", description: "Anni di esperienza nel 3x3" },
          note:        { type: "string", description: "Note sportive libere" },
        },
        required: ["nome", "cognome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sorteggia_gironi",
      description: "Esegue il sorteggio dei gironi per una tappa. Chiamalo dopo aver creato la tappa con le squadre. Se non specifichi la tappa, usa l'ultima creata.",
      parameters: {
        type: "object",
        properties: {
          tappa_nome: { type: "string", description: "Nome (o parte del nome) della tappa su cui sorteggiare. Ometti per usare l'ultima tappa." },
          mode:       { type: "string", enum: ["casuale", "ranking"], description: "Modalità: 'casuale' (default) oppure 'ranking' (distribuzione a serpentina per ranking)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "genera_fasi_dirette",
      description: "Genera la fase a eliminazione diretta dalla classifica dei gironi: un tabellone a turni (ottavi, quarti, semifinali, finale, secondo quante squadre si qualificano) in cui le migliori teste di serie possono passare il primo turno senza giocare. Chiamalo quando tutte le partite dei gironi sono state registrate. Se non specifichi la tappa, usa l'ultima creata.",
      parameters: {
        type: "object",
        properties: {
          tappa_nome:  { type: "string", description: "Nome (o parte del nome) della tappa. Ometti per usare l'ultima tappa." },
          qualificate: { type: "number", description: "Quante squadre per girone si qualificano: un intero da 1 in su (default 2)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registra_risultato",
      description: "Registra il punteggio di una partita, sia dei gironi sia della fase a eliminazione diretta (ottavi, quarti, semifinali, finale). Usalo quando l'utente fornisce il risultato di una gara (es. 'Ballers Roma 21 - Street Kings 15'). Trova da solo la partita giusta; usa 'fase' solo se serve distinguere. Se non specifichi la tappa, usa l'ultima creata.",
      parameters: {
        type: "object",
        properties: {
          squadra_a:  { type: "string", description: "Nome (o parte del nome) della prima squadra" },
          punti_a:    { type: "number", description: "Punteggio della prima squadra" },
          squadra_b:  { type: "string", description: "Nome (o parte del nome) della seconda squadra" },
          punti_b:    { type: "number", description: "Punteggio della seconda squadra" },
          tappa_nome: { type: "string", description: "Nome della tappa (opzionale, default: ultima tappa)" },
          fase:       { type: "string", description: "Opzionale: 'girone' o 'diretta' (eliminazione diretta). Passalo SOLO se la stessa coppia di squadre si affronta in entrambe le fasi e bisogna distinguere." },
        },
        required: ["squadra_a", "punti_a", "squadra_b", "punti_b"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "concludi_tappa",
      description: "Conclude e pubblica la tappa nell'Archivio circuito quando tutte le partite sono state registrate. Richiede un account non ospite.",
      parameters: {
        type: "object",
        properties: {
          tappa_nome: { type: "string", description: "Nome della tappa da concludere (opzionale, default: ultima tappa)" },
        },
        required: [],
      },
    },
  },
];
