# Hoop 3x3 — Design system "Asphalt"

Direzione visiva dell'app (la design pass, unita in `main`). I token Tailwind sono in `src/index.css`
(`@theme`), che è la fonte di verità: dove questo documento e il CSS divergono vale il CSS.
Mockup di partenza in `docs/design/stitch-screens/` (home, profilo giocatore, campetti, punteggio partita).

## Concetto

Campetto di notte sotto le luci al sodio: superfici asfalto quasi nere, un solo accento
arancio "court", testo bianco gesso. Prodotto sportivo **data-intensivo**: densità alta,
numeri tabulari, bordi al posto delle ombre (le ombre ci sono solo sul pulsante e sul pannello
del Coach, che galleggiano sulla pagina, e nella barra interna della riga scelta dei Campetti).
Niente pastello e niente gradienti (eccetto l'overlay sulla foto hero).

La regola sulla trasparenza riguarda la sfocatura: il solo sfondo sfocato (`backdrop-blur`) è
quello di intestazione (sfondo al 90%) e scheda d'accesso (95%). I velini colorati non sfocano:
badge al 15%, avvisi al 10% (`court` o `loss`), filtro attivo dei Campetti al 15%, riga evidenziata
delle statistiche al 5%; non sfocano nemmeno i pannelli interni (`asphalt-950` al 60%), l'etichetta
della mappa (80%) e il fondo dei modali (`asphalt-950` all'80%).

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
| `chalk-dim`        | `#8C8780` | note e testo terziario (5.4:1 su 950, 4.6:1 su 800)         |
| `court`            | `#FF6A1F` | accento: CTA, nav attiva, rank #1, focus ring (6.8:1)      |
| `court-hover`      | `#FF7F3F` | hover del primario                                         |
| `gold`             | `#F5C542` | 1° posto e miglior valore (leader, trofeo, barra più alta della sparkline), finale e campione del tabellone |
| `win`              | `#3DD68C` | vittoria, DIFF positivo (10.4:1)                           |
| `loss`             | `#FF4D4D` | sconfitta, DIFF negativo, errori (5.9:1)                   |
| `live`             | `#FF3B3B` | badge LIVE con puntino pulsante                            |
| `navy`             | `#17203A` | solo l'overlay della hero (colore del logo, brand esistente) |

Testo su `court`: usare `asphalt-950` (6.8:1), mai bianco (2.9:1).
Il colore non è mai l'unico indicatore: W/L come lettera, DIFF con segno +/−, chi vince nel tabellone con la spunta; nella
`ScoreCard` il vincitore ha solo il testo «vince» per i lettori di schermo.

## Tipografia

| Ruolo     | Font                    | Pesi        | Note                                                    |
|-----------|-------------------------|-------------|---------------------------------------------------------|
| Display   | **Barlow Condensed**    | 600/700/800 | titoli, nomi squadra su scoreboard, numeri grandi; maiuscolo, tracking −0.01em |
| Corpo/UI  | **IBM Plex Sans**       | 400/500/600 | tabelle 13px con `tabular-nums`, label 11px maiuscole tracking 0.08em |

Perché: Barlow Condensed è la scelta "sport/atletico" di UI UX Pro Max (condensato = impatto
nei punteggi senza allargare le colonne). IBM Plex Sans al posto di Barlow regular perché ha
cifre più leggibili a 12–13px e forme neutre che non competono con il display.
Sostituiscono Archivo Black + Georgia (il serif editoriale non regge la densità numerica).

Non ci sono token di scala: i corpi sono le utility di Tailwind. In pratica: hero `clamp(40px, 7vw, 72px)`,
titoli di sezione 24 px, numeri delle `StatTile` 36 px, numero di maglia del profilo `clamp(56px, 10vw, 96px)`,
punteggio del timer `clamp(64px, 14vw, 112px)`; corpo 15/14 px, tabelle 13 px (12 px quelle del tabellino),
etichette 11 px. Line-height 1.5 nel corpo (default di Tailwind), 1.0 per il display (`.font-display`).

## Forma e spaziatura

- Radius: 4px card/input, 2px chip, 0 tabelle. Tondi solo il badge LIVE (con il suo puntino) e il pulsante del Coach.
- Spaziatura: la scala di Tailwind (multipli di 4px; padding card 12–16px). Righe delle tabelle di classifica 36px
  (`.standtable`), 32px quelle del tabellino (`.statstable`).
- Bordi 1px `asphalt-700` invece delle ombre. Card primaria/attiva: bordo superiore 3px `court`.
- Container: `max-w-5xl` (1024px) per intestazione, pagine e barra degli avvisi.
- Breakpoint per il controllo a vista: 375 / 768 / 1024 / 1440 (non automatizzato; i test end-to-end sull'area di tocco usano 390px).

## Gerarchia per schermata

1. **Home / classifica live**: hero (tappa in corso + LIVE) → tabella classifica (2/3) + prossime partite e score card compatta (1/3) → leader della tappa (5 stat tile).
2. **Player profile**: header con numero maglia gigante → 6 stat tile → andamento punti (sparkline) | storico tappe → ultime partite. L'analisi 3x3 (punti di forza, aree di miglioramento) sta nella finestra del giocatore dell'Archivio (`GiocatoreAnalisi`).
3. **Campetti**: «Usa la mia posizione» con il suo esito → ricerca e filtri → lista card (5fr, circa il 45%) + mappa (6fr, circa il 55%,
   quadrata: l'immagine della Maps Static API, o la griglia schematica senza chiave) con i pin disegnati dall'app (il selezionato in
   `court`, più grande; il segno dell'utente in `chalk`) → «Aggiungi un campetto» (primary, a tutta larghezza sotto la lista) →
   attribuzione dei dati in fondo. Nella card le caratteristiche sono badge di testo (mai solo un'icona o un colore), la distanza,
   solo con la posizione, in `court`, e per chi può «Modifica» ed «Elimina» come link (`Button variant="link"`, «Elimina» in `loss`)
   a destra dei link a Google Maps. Il form del campetto sta in una finestra più larga delle schede (560px) perché contiene la
   stessa mappa, su cui si sceglie la posizione: il pin provvisorio è un pin di 32px riempito in `court` e non cliccabile; i tre
   modi di dare la posizione stanno in un `fieldset` con la legenda «Posizione *».
4. **Punteggio partita** (`MatchCard`): `ScoreCard` compatta con i punteggi al centro (campi finché la gara è aperta) → tabellino
   dei giocatori editabile → eventi di gara apribili → barra delle azioni nel piede della card («Salva risultato» o «Correggi»,
   statistiche, eventi). Il **timer di gara** (`MatchTimer`) è una finestra a parte, pensata per il tavolo: punteggio gigante,
   clock e shot clock.

## Componenti riutilizzabili (React + Tailwind)

| Componente | File | Uso |
|---|---|---|
| `Button` | `ui/Button.tsx` | primary / outline / ghost / link, `size="sm"`; le classi di `className` vincono su quelle della variante (tailwind-merge) |
| `Input` | `ui/Input.tsx` | etichetta, `hint`, `error` |
| `Card`, `Section`, `Kicker`, `Badge`, `StatTile`, `Modal`, `Icon` | `ui/` | primitive di layout, etichette, modali, icone SVG |
| `ConfirmDialog` | `ui/ConfirmDialog.tsx` | finestra di conferma per ciò che fa perdere dati (ruolo `alertdialog`), sopra `Modal` |
| `StandingsTable` | `leaderboard/StandingsTable.tsx` | `<table>` semantica, ordinamento per colonna con `aria-sort`, rail arancio sulla riga evidenziata, loghi |
| `ScoreCard` | `partita/ScoreCard.tsx` | scoreboard con slot `center` (input) e `footer` (azioni, eventi); a partita conclusa «vince» (`sr-only`) segue il punteggio più alto; `size="lg"` c'è ma oggi nessuna pagina lo usa |
| `Bracket` | `gironi/Bracket.tsx` | tabellone per round, presentazionale; ogni card è un `role="group"` con il nome «Semifinale 1: Alfa contro Beta» («posto da assegnare», «Alfa passa il turno»); i controlli arrivano da `renderControls` |
| `Sparkline` | `profile/Sparkline.tsx` | barre SVG inline, nessuna libreria chart |
| `Hero` | `layout/Hero.tsx` | banda hero con foto e overlay |

Classi condivise in `index.css` (`@layer components`): campi `.statin`, `.scorein`, `.cellin` con le etichette `.input-label` e
`.form-label`; tabelle `.standtable` e `.statstable`; `.kicker`, `.linkbtn`, `.tapparow`, `.hovercard`, `.pulse`; Coach AI `.chatfab`,
`.chatpanel`, `.bubble-u`, `.bubble-a`; finestre `.modal-overlay` e `.modal-card`. Utility proprie: `grid-auto` e `area-tocco`
(sotto). Tutto il resto usa le utility Tailwind.

Da 21st.dev preso solo il *pattern* "Market Watchlist" (toggle di ordinamento, rail accent, sparkline SVG):
il componente originale è un grid di `<button>` su token shadcn, non riutilizzabile così com'è.

## Accessibilità

Lo stato reale, con dove è garantito:

- **Contrasto.** Il testo dei token del design (`chalk`, `chalk-muted`, `chalk-dim`, `court`, `win`, `loss`) è ≥ 4.5:1 sulla sua
  superficie (i valori nella tabella dei colori sono calcolati dagli esadecimali di `index.css`); il bordo dei campi
  (`asphalt-500`: `.statin`, `.scorein` e `.cellin`, il campo del tabellino di `StatsEditor`) è ≥ 3:1 sullo sfondo del campo
  (`asphalt-800`: 3.5:1) ed è ancora più netto sulle superfici (4.1:1 su `asphalt-950`; WCAG 1.4.11). Provato in
  `tests/unit/contrastoCampi.test.ts`, che calcola il rapporto dai colori di `index.css`.
- **Focus visibile.** Un anello di 2px `court` con offset 2px su ogni elemento interattivo (`:focus-visible` in `index.css`); è
  provato su ciò che prende il focus da codice (schede, esito del timer) in `tests/e2e/tastiera.spec.ts`. I campi di testo e di
  punteggio (`.statin`, `.scorein`, `.cellin`) al focus non hanno l'anello ma il bordo `court`.
- **Area di tocco ≥ 44px.** Per chi usa il dito (sotto i 640px di larghezza **oppure** con puntatore grossolano: `(width < 40rem), (pointer: coarse)`) la utility `area-tocco` dà almeno 44×44px
  ai pulsanti fatti con `Button` (collegamenti compresi), a quelli con la sola icona (X, cestini) e a «Scheda», «Profilo» ed «Esci»,
  senza cambiare la grandezza dell'icona o del testo; con il mouse e sopra i 640px l'aspetto non cambia. Restano come sono le voci della
  navigazione, le schede dell'anagrafe (Giocatori, Squadre, Statistiche stagione) e i nomi delle card. Provato in
  `tests/e2e/area-di-tocco.spec.ts` a 390px di larghezza.
- **Movimento.** `prefers-reduced-motion` azzera transizioni e animazioni (`index.css`).
- **Icone e colore.** Icone SVG, mai emoji (`ui/Icon.tsx`); il colore non è l'unico indicatore (W/L come lettera, DIFF con segno;
  chi vince nel tabellone ha la spunta, e nella `ScoreCard` il testo «vince» solo per i lettori di schermo). I test di `Bracket` e
  `ScoreCard` leggono ruoli e testi, non le classi di stile: un solo test per componente fissa i token di colore, come documentazione.
- **Tabelle.** `<th scope="col">` e `<caption className="sr-only">` (visibile solo ai lettori di schermo, che con quello annunciano la
  tabella) in tutte e sette: classifiche (`StandingsTable`, classifica del circuito), statistiche di stagione, tabellini
  (`StatsView`, `StatsEditor`), analisi del giocatore (`GiocatoreAnalisi`) e storico tappe del profilo. Provato in
  `tests/unit/captionTabelle.test.tsx` e `tests/unit/statisticheStagione.test.tsx`. `StandingsTable` ordina per colonna con `aria-sort`.
- **Pulsanti con la sola icona** hanno `aria-label`.
- **Finestre.** Le finestre modali (`Modal`: schede, timer, conferme) trattengono il focus con Tab e Maiusc+Tab, lo restituiscono a ciò
  che le ha aperte e si chiudono con Esc una alla volta (`usePilaFinestre`); le conferme hanno ruolo `alertdialog`, le altre `dialog`.
  Provato in `tests/unit/modal.test.tsx`. Il pannello del Coach è un `dialog` non modale: Tab non è trattenuto e la pagina sotto resta
  raggiungibile (`coachTools.test.ts`, «non è una finestra modale»).
