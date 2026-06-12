# HOOP 3X3

App web per la gestione di un circuito italiano di basket 3x3: tornei, gironi, statistiche e classifiche.

## Funzionalità

- **Lega** — crea e configura la tua lega con nome, stagione e regole personalizzate
- **Tappe** — organizza tornei con sorteggio gironi (casuale o con teste di serie), calendario partite e avanzamento automatico
- **Live scoring** — inserisci i punteggi in tempo reale con log eventi (canestro da 1, canestro da 2, fallo, timeout)
- **Statistiche** — traccia punti, rimbalzi, assist, palle rubate e stoppate per ogni giocatore
- **Anagrafe** — archivio centralizzato di giocatori e squadre riutilizzabile tra le tappe
- **Archivio** — storico di tutte le tappe concluse con classifiche finali
- **Leaderboard** — classifiche individuali per categoria statistica su tutta la stagione
- **Video** — galleria di highlight e partite (link YouTube)
- **Coach AI** — assistente virtuale che conosce le regole FIBA 3x3 (richiede API key Anthropic)

### Regole FIBA 3x3 (default)
| Parametro | Valore |
|---|---|
| Punti per vincere | 21 |
| Durata massima | 10 minuti |
| Shot clock | 12 secondi |
| Overtime | primo a 2 punti |

## Stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 6](https://vitejs.dev/) — bundler e dev server
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- [React Router 7](https://reactrouter.com/) — routing
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) — form e validazione
- `localStorage` — persistenza dei dati (nessun backend richiesto)

## Avvio rapido

```bash
npm install
npm run dev
```

L'app è disponibile su `http://localhost:5173`.

## Script disponibili

| Comando | Descrizione |
|---|---|
| `npm run dev` | Avvia il dev server con hot reload |
| `npm run build` | Build di produzione |
| `npm run preview` | Anteprima della build di produzione |
| `npm run test` | Esegue i test unitari (Vitest) |
| `npm run test:e2e` | Esegue i test end-to-end (Playwright) |
| `npm run lint` | Linting del codice sorgente |

## Coach AI (opzionale)

Per abilitare l'assistente AI crea un file `.env` nella root del progetto:

```env
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

> **Attenzione:** in produzione non esporre mai la chiave direttamente nel frontend. Usa un backend proxy che gestisca le chiamate all'API Anthropic.

## Struttura del progetto

```
src/
├── components/       # Componenti UI suddivisi per dominio
│   ├── anagrafe/     # Giocatori e squadre
│   ├── archivio/     # Storico tappe
│   ├── auth/         # Login e registrazione
│   ├── coach/        # Pannello Coach AI
│   ├── gironi/       # Gestione gironi e classifiche
│   ├── layout/       # Header e navigazione
│   ├── leaderboard/  # Classifiche stagionali
│   ├── partita/      # Live scoring e statistiche
│   ├── squadra/      # Roster editor
│   ├── tappa/        # Gestione tappa
│   ├── ui/           # Componenti base (Button, Input, Loading)
│   └── video/        # Galleria video
├── constants/        # Regole, ruoli, tipi di evento
├── hooks/            # Custom hooks
├── pages/            # Pagine dell'app
├── services/         # Storage (localStorage) e AI
├── stores/           # Store Zustand globale
├── types/            # Definizioni TypeScript
└── utils/            # Funzioni di utilità (gironi, classifica, ecc.)
```

## Dati e persistenza

Tutti i dati sono salvati nel `localStorage` del browser, senza necessità di un server. Per ambienti multi-utente o condivisione reale dei dati, è necessario sostituire il layer `src/services/storage.ts` con chiamate a un'API backend.
