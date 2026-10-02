# TODO

## Refactor

- [x] **Estrarre le operazioni di tappa in funzioni pure** (`src/domain/tappaOps.ts`):
  `sorteggia(tappa, modo)`, `registraRisultato(tappa, partitaId, …)`, `generaFasiDirette(tappa)`,
  `concludi(tappa)` che restituiscono la nuova `Tappa`. Oggi `useCoachAI.ts` (~690 righe)
  duplica la logica di `useTappa` chiamando direttamente `useAppStore`: ogni modifica al
  salvataggio di un risultato va fatta in due posti. Con le funzioni pure, `useTappa` e i tool
  del Coach le chiamano entrambe e passano il risultato a `replaceTappa`; i tool diventano
  testabili con Vitest senza React. (Emerso dall'analisi graphify: `useAppStore` ponte fra 12
  comunità, ma l'unico accoppiamento reale è `useCoachAI`.)

## Backend

- [ ] Paginazione + ricerca server-side su `/api/anagrafe/*` quando l'anagrafe cresce.
- [x] Refresh token: JWT di accesso da 30 minuti, rinnovato in automatico con un refresh token di
  30 giorni in cookie httpOnly (ruotato a ogni rinnovo, revocato al logout).
- [ ] Refresh token, periodo di grazia: accettare per 30-60 secondi il token appena ruotato, così una
  risposta di rinnovo persa (pagina chiusa, rete caduta) non costringe a rifare il login.
- [ ] Refresh token rubato: rilevare il riuso di un token già ruotato e aggiungere «esci da tutti i
  dispositivi»; su un refresh respinto (401) cancellare anche cookie e riga scaduta.
- [ ] Deploy su origini diverse: passi in «Sessioni e refresh token» del README del backend.
- [ ] Valutare la normalizzazione di `partite`/statistiche in tabelle dedicate se servono
  classifiche cross-tappa calcolate in SQL (oggi JSONB in `tappe`).

## Frontend

- [ ] Rigenerare la hero a 2K con mcp-image quando la chiave Gemini ha il billing attivo.
- [x] `useAnagrafe` ricarica dal server a ogni mount: cachearla nello store.
- [ ] `me()` fa uscire l'utente anche quando il server non risponde: uscire solo se la sessione è
  davvero finita (401 del rinnovo).
- [ ] Rinnovare il JWT a timer o quando la scheda torna visibile: oggi, con il JWT già scaduto (basta
  che nessuna richiesta parta negli ultimi 2 minuti della sua vita), una modifica seguita dalla
  chiusura della pagina entro 400 ms più il tempo del rinnovo va persa.
- [ ] Sincronizzare logout e login tra le schede (evento `storage`) e tornare al form di accesso quando
  la sessione finisce a pagina aperta.
