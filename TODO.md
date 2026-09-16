# TODO

## Refactor

- [ ] **Estrarre le operazioni di tappa in funzioni pure** (`src/domain/tappaOps.ts`):
  `sorteggia(tappa, modo)`, `registraRisultato(tappa, partitaId, …)`, `generaFasiDirette(tappa)`,
  `concludi(tappa)` che restituiscono la nuova `Tappa`. Oggi `useCoachAI.ts` (~690 righe)
  duplica la logica di `useTappa` chiamando direttamente `useAppStore`: ogni modifica al
  salvataggio di un risultato va fatta in due posti. Con le funzioni pure, `useTappa` e i tool
  del Coach le chiamano entrambe e passano il risultato a `replaceTappa`; i tool diventano
  testabili con Vitest senza React. (Emerso dall'analisi graphify: `useAppStore` ponte fra 12
  comunità, ma l'unico accoppiamento reale è `useCoachAI`.)

## Backend

- [ ] Paginazione + ricerca server-side su `/api/anagrafe/*` quando l'anagrafe cresce.
- [ ] Refresh token (oggi JWT da 7 giorni, poi si rifà il login).
- [ ] Valutare la normalizzazione di `partite`/statistiche in tabelle dedicate se servono
  classifiche cross-tappa calcolate in SQL (oggi JSONB in `tappe`).

## Frontend

- [ ] Rigenerare la hero a 2K con mcp-image quando la chiave Gemini ha il billing attivo.
- [ ] `useAnagrafe` ricarica dal server a ogni mount: cachearla nello store.
