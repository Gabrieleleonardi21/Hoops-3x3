# Hoop 3x3 — Design system "Asphalt"

Direzione visiva per la design pass (branch `ai-design-pass`). Fonte di verità per i token
Tailwind in `src/index.css` (`@theme`). Mockup di riferimento in `reference/stitch-screens/`.

## Concetto

Campetto di notte sotto le luci al sodio: superfici asfalto quasi nere, un solo accento
arancio "court", testo bianco gesso. Prodotto sportivo **data-intensivo**: densità alta,
numeri tabulari, bordi al posto delle ombre. Niente pastello, niente glassmorphism,
niente gradienti (eccetto l'overlay sulla foto hero).

## Colori

| Token              | Hex       | Uso                                                        |
|--------------------|-----------|------------------------------------------------------------|
| `asphalt-950`      | `#0B0D12` | sfondo pagina                                              |
| `asphalt-900`      | `#12151C` | superfici / card                                           |
| `asphalt-800`      | `#1B1F29` | hover, elementi elevati, input                             |
| `asphalt-700`      | `#2A2F3D` | bordi 1px                                                  |
| `asphalt-600`      | `#3A4052` | bordi forti, divisori tabella header                       |
| `asphalt-500`      | `#6B7390` | bordo input e controlli (3.9:1 su 900: WCAG 1.4.11)         |
| `chalk`            | `#F2EDE4` | testo primario (16.7:1 su 950)                  |
| `chalk-muted`      | `#A9A398` | testo secondario (7.8:1)                                   |
| `chalk-dim`        | `#6E6960` | testo disabilitato / note (3.0–3.6:1: solo testo non essenziale, mai per dati) |
| `court`            | `#FF6A1F` | accento: CTA, nav attiva, rank #1, focus ring (6.8:1)      |
| `court-hover`      | `#FF7F3F` | hover del primario                                         |
| `gold`             | `#F5C542` | badge MVP / 1° posto (solo quello)                         |
| `win`              | `#3DD68C` | vittoria, DIFF positivo (10.4:1)                           |
| `loss`             | `#FF4D4D` | sconfitta, DIFF negativo, errori (5.9:1)                   |
| `live`             | `#FF3B3B` | badge LIVE con puntino pulsante                            |
| `navy`             | `#17203A` | solo logo e overlay hero (brand esistente)                 |

Testo su `court`: usare `asphalt-950` (6.8:1), mai bianco (2.9:1).
Il colore non è mai l'unico indicatore: W/L come lettera, DIFF con segno +/−.

## Tipografia

| Ruolo     | Font                    | Pesi        | Note                                                    |
|-----------|-------------------------|-------------|---------------------------------------------------------|
| Display   | **Barlow Condensed**    | 600/700/800 | titoli, nomi squadra su scoreboard, numeri grandi; maiuscolo, tracking −0.01em |
| Corpo/UI  | **IBM Plex Sans**       | 400/500/600 | tabelle 13px con `tabular-nums`, label 11px maiuscole tracking 0.08em |

Perché: Barlow Condensed è la scelta "sport/atletico" di UI UX Pro Max (condensato = impatto
nei punteggi senza allargare le colonne). IBM Plex Sans al posto di Barlow regular perché ha
cifre più leggibili a 12–13px e forme neutre che non competono con il display.
Sostituiscono Archivo Black + Georgia (il serif editoriale non regge la densità numerica).

Scala: display-xl 64/56/40 (clamp), display-lg 32, display-md 24, display-sm 18;
body 15/14, table 13, label 11. Line-height 1.5 corpo, 1.0 display.

## Forma e spaziatura

- Radius: 4px card/input, 2px chip, 0 tabelle. Unica pill: badge LIVE.
- Griglia 8px. Padding card 12–16px. Righe tabella 36px.
- Bordi 1px `asphalt-700` invece delle ombre. Card primaria/attiva: bordo superiore 3px `court`.
- Container: `max-w-5xl` (1024px) — oggi è 880px; leaderboard e bracket hanno bisogno di respiro.
- Breakpoint di verifica: 375 / 768 / 1024 / 1440.

## Gerarchia per schermata

1. **Home / classifica live**: hero (tappa in corso + LIVE) → tabella classifica (2/3) + prossime partite e score card compatta (1/3) → leader della tappa (5 stat tile).
2. **Player profile**: header con numero maglia gigante → 6 stat tile → analisi 3x3 + andamento (sparkline) | storico tappe → ultime partite.
3. **Campetti**: filtri → lista card (45%) + mappa (55%). *Solo mockup: nessun modello dati esiste.*
4. **Punteggio partita**: scoreboard gigante (leggibile da 1 m) con clock e shot clock → stat giocatori editabili | eventi di gara → barra azioni sticky.

## Componenti da costruire (React + Tailwind)

`ui/`: Button (primary/outline/ghost), Badge (live/win/loss/gold), Kicker, StatTile, Card.
`leaderboard/`: StandingsTable (`<table>` semantica, ordinamento per colonna, rail arancio riga evidenziata).
`partita/`: ScoreCard (scoreboard), Clock.
`gironi/`: Bracket (colonne per round, connettori CSS).
`profile/`: Sparkline (SVG inline, nessuna libreria chart).

Da 21st.dev preso solo il *pattern* "Market Watchlist" (toggle di ordinamento, rail accent, sparkline SVG):
il componente originale è un grid di `<button>` su token shadcn, non riutilizzabile così com'è.

## Accessibilità

Testo ≥ 4.5:1 sulla sua superficie · focus ring 2px `court` offset 2px · touch target ≥ 44px
su mobile · `prefers-reduced-motion` rispettato (già presente) · icone SVG, mai emoji ·
tabelle con `<th scope>` e caption · pulsanti solo-icona con `aria-label`.
