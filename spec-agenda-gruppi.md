# Agenda Gruppi — app da coach di arrampicata

Versione aggiornata — integra il documento di specifica originale con le decisioni prese nella sessione di revisione (audio timer, allenamenti standard, categorie eserciziario, campi qualità/tipologia).

## Progetto

Sono Gabriele, coach di arrampicata. Sto progettando una web app locale per pianificare e condurre gli allenamenti dei miei gruppi, con un timer da palestra integrato. Attualmente uso il blocco note per tracciare gli allenamenti. Prossimo passo: costruzione con Claude Code.

## Contesto d'uso

- Gruppi fissi, giorni/orari fissi: Lunedì corso base; Martedì intermedi corda; Mercoledì pro poi corso intermedio; Giovedì intermedi corda poi pro.
- Orari sempre fissi, non capita di saltare settimane o spostare giorni.
- Nei giorni doppi seguo un gruppo alla volta, mai in contemporanea — l'app deve permettere di passare da una sessione all'altra della giornata, non mostrarle insieme.
- Uso l'app solo da telefono, solo in palestra, solo in italiano.
- I gruppi sono fissi/hardcoded per ora, non serve un editor.
- Ogni gruppo ha un colore identificativo che scelgo io.

## Flusso generale

- Pianifico prima della sessione, non registro a posteriori. Non serve distinguere "pianificata" da "svolta": il piano è il dato.
- È normale modificarlo al volo durante la sessione (saltare/aggiungere blocchi) senza frizione.
- Non costruisco un modello/default per gruppo nel senso "automatico": ogni settimana di base parto da zero, ma ora esiste la libreria di Allenamenti standard (vedi sotto) da cui posso partire volontariamente.
- Il timer deve essere visibile/udibile anche agli allievi, non solo a uso mio.
- "Oggi" senza sessione pianificata: se apro l'app e per il gruppo/orario previsto oggi non ho ancora pianificato nulla, l'app propone automaticamente l'ultima sessione fatta da quel gruppo come base pronta da modificare.

## Modello dati

### Eserciziario

- Esercizi con solo il nome (niente serie/ripetizioni/carico salvati qui). CRUD completo dall'app in ogni momento.
- Aggiungo esercizi né spesso né raramente — una via di mezzo.
- In futuro (non ora) vorrei poter allegare foto/video.
- Se elimino un esercizio già usato in sessioni passate: eliminazione secca, sparisce anche dallo storico (nessun blocco, nessun placeholder "[esercizio rimosso]"). L'eliminazione è considerata correzione di un errore, non un evento da tracciare; il circuito storico che lo conteneva si aggiorna silenziosamente.

Categorizzazione per pattern di movimento (un esercizio = una categoria):

- Spinta
- Trazione
- Verticale
- Orizzontale
- Spinta gambe
- Tirata gambe
- Core — con sottocategorie (eccezione ad hoc, non generalizzata alle altre categorie):
  - Antiflessione frontale
  - Antiflessione laterale
  - Antirotazione
- Accessori (bicipiti, tricipiti, alzate laterali, ecc.)
- Mobilità/allungamento
- Multiarticolare/Total body (snatch, clean, thruster, burpee, ecc. — movimenti che attraversano più pattern insieme, gestiti con categoria unica invece che multi-tag)

Campo "qualità" (opzionale, seconda dimensione indipendente dal pattern):

- Valori possibili: Forza o Potenza soltanto (nessuna opzione Resistenza — la resistenza è una variabile di dosaggio: più ripetizioni/round, non una proprietà intrinseca dell'esercizio).
- Un esercizio ha al massimo una qualità, non multipla.
- Campo opzionale, può restare vuoto.
- Stesse etichette testuali delle categorie di Allenamenti standard, ma tassonomie indipendenti — nessuna relazione automatica nel modello dati.

### Circuiti

- Esercizi assemblati dall'eserciziario, riordinabili liberamente (drag).
- Un formato timer associato.
- Ritmo di lavoro/riposo unico per tutto il circuito (varia raramente tra esercizi — nei rari casi in cui serve, si crea un circuito diverso invece di complicare il modello).
- Il tipo di riposo in un circuito a più giri (solo tra round vs. anche tra esercizi dentro lo stesso round) dipende dal circuito, va reso configurabile caso per caso.
- Nuovo campo "tipologia": Forza / Potenza / Resistenza — classifica il circuito nel suo insieme (es. tanti round e ritmo serrato = Resistenza), indipendentemente dalla qualità dei singoli esercizi che lo compongono. Tassonomia separata dalle categorie di Allenamenti standard, pur condividendo gli stessi nomi.

### Sessioni

- Riscaldamento a testo libero (spesso improvvisato, non pianificato in dettaglio).
- Uno o più circuiti in sequenza.
- Note testuali libere.
- Duplicabili/riusabili per un'altra data — la duplicazione assegna automaticamente la data della prossima occorrenza dello stesso gruppo (stesso giorno della settimana successivo), senza scelta manuale.
- Nessun campo per numero allievi presenti.

### Agenda

- Si apre sempre sulla sessione di oggi, rilevata automaticamente da giorno/ora — zero navigazione.
- "Ultima volta: X" visibile appena apro un gruppo.
- Storico solo scorribile, niente ricerca/filtro/statistiche per ora (idea per il futuro).

### Allenamenti standard (nuova sezione)

- Libreria di sessioni-modello, organizzata per categoria di obiettivo (es. Forza, Potenza, Resistenza — nomi liberi, non hardcoded).
- Ogni gruppo ha le proprie categorie e varianti, separate dagli altri gruppi (non condivise).
- Ogni categoria contiene più varianti (tipicamente 3-4), ciascuna una sessione completa (riscaldamento + circuiti + note) salvata con un nome.
- Navigazione per l'uso: si sceglie il gruppo (se non già nel contesto), poi la categoria, poi la variante specifica.
- Applicazione: selezionare una variante e applicarla a "Oggi" ne copia il contenuto in una sessione indipendente, modificabile liberamente da quel momento senza toccare il modello originale in libreria.
- Creazione di una variante: due strade, entrambe disponibili — da zero dentro la libreria, oppure salvando una sessione esistente (es. quella di "Oggi" appena costruita) come nuova variante standard.
- CRUD completo su categorie e varianti, analogo a Eserciziario e Circuiti.

## Timer — tre formati

Avviabile agganciato a un circuito (parametri precompilati) oppure come strumento standalone.

### Tabata-style (90% dei casi, tipicamente 20″/10″ o 40″/20″)

Prepara (countdown iniziale) → Lavora → Riposa → Round (lavoro+riposo = 1 round) → Cicli (N round = 1 ciclo, ripete l'intera sequenza esercizi da capo) → Riposa tra i cicli.

Il numero di round coincide sempre esattamente col numero di esercizi nel circuito; ogni round = un esercizio diverso in ordine (round 1 = esercizio 1, ecc.). Modello di riferimento preso da uno screenshot di un'app esistente.

### EMOM (uso frequente, ma meno di Tabata)

Intervallo configurabile, non fisso a 60″ (es. 45″, 1'30″). Non collegato agli esercizi del circuito — basta il countdown puro, niente nome esercizio per round.

### AMRAP (raro)

Solo un cronometro/countdown verso un tempo limite, nessuna struttura a round — "basta un cronometro", non sovra-ingegnerizzare.

**Nota UI**: EMOM e AMRAP non devono essere troppo in evidenza nell'interfaccia — Tabata deve essere il formato predefinito/più prominente nel costruttore di circuito.

## Requisiti trasversali

- Schermo sempre acceso durante l'esecuzione (indispensabile).
- Nessuna pausa/skip di fase, solo avvia/stop.
- Propone di default l'ultimo intervallo usato.
- Preset salvabili e riutilizzabili (es. "Tabata 20/10x8", "Repeaters 10/5"), mostrati con tutti i parametri a colpo d'occhio.
- Quando scelgo un tipo di blocco ricorrente, l'app suggerisce automaticamente il preset timer associato.
- Durante l'esecuzione mostra sempre nome/ordine degli esercizi del circuito in corso.

## Audio e voce (aggiornato)

- Audio segue la suoneria/silenzioso del telefono, non va forzato. Se il telefono è in silenzioso, nessuna vibrazione di fallback: l'app resta muta.
- Segnale acustico di fine riposo: tripla battuta (bip-bip-bip, uno al secondo) negli ultimi 3 secondi di ogni fase di riposo, che culmina esattamente sull'inizio del nuovo esercizio/round. È un unico evento — non c'è un suono separato a inizio lavoro. Si applica al riposo tra round, al riposo tra cicli, e allo stesso modo alla fine di ogni intervallo in EMOM e AMRAP (comportamento uniforme sui tre formati).
- Countdown "Prepara": conto alla rovescia vocale (3, 2, 1) prima dell'inizio della fase di lavoro, distinto dal tripla-bip di fine riposo. Segue la stessa impostazione bip/voce scelta per il resto del timer (se è impostato "solo bip", anche la Prepara userà un bip invece della voce).
- Voce sostitutiva del bip: quando l'annuncio vocale è attivo, sostituisce il bip-bip-bip (non si sovrappongono).
- Contenuto annunciato, configurabile per timer: al momento di impostare/avviare un timer si sceglie cosa annunciare — frasi di fase (riposa/lavora/allenamento completato), nome esercizio ad ogni round, o entrambe. L'ultima scelta diventa il default proposto al timer successivo (stesso pattern del "propone l'ultimo intervallo usato").
- Fonte della voce: sistema ibrido — se esiste una registrazione personale (fatta da Gabriele) per quella frase/esercizio, si usa quella; altrimenti fallback automatico su sintesi vocale (TTS) di sistema, così non c'è mai un buco silenzioso.
- Libreria di registrazioni vocali: unica, accessibile sia dall'Eserciziario (per registrare/associare il nome di un esercizio) sia da una sezione impostazioni dedicata (per le frasi fisse: riposa, lavora, allenamento completato, ecc.). Stessa fonte dati, due punti di accesso.

## Navigazione

Bottom nav a 4 voci: Oggi, Agenda, Allenamenti standard, Eserciziario.

(Allenamenti standard non è stato accorpato nell'Agenda: l'Agenda resta "cosa ho fatto/oggi", gli Allenamenti standard sono una libreria separata di "cosa potrei fare".)

## Fuori scope esplicito

Sync/backup cloud, condivisione/export sessioni, widget home screen, login/account, statistiche/pattern aggregati sullo storico, ricerca/filtro nello storico, gestione più timer in contemporanea, editor gruppi/orari, distinzione pianificata/svolta, conteggio allievi presenti, parametri dettagliati per esercizio (serie/ripetizioni/carico), sottocategorie generalizzate a tutte le categorie pattern (solo Core le ha), multi-tag qualità sugli esercizi.

## Percorso di design (per contesto)

Partito da tema scuro + stile minimale come requisiti fermi. Esplorate e scartate: uno stile "segnaletica da palestra" (stencil, hazard yellow/black, industriale) — inizialmente il preferito, poi giudicato troppo aggressivo; font condensati tipo Bebas Neue, trovati "troppo urlati". Direzione finale scelta: coerente con l'altra app Diario Allenamento — sfondo antracite, card morbidamente arrotondate, tipografia sans-serif bold ma non urlata (Inter), pillole colorate per gruppo/formato timer, accento arancione per l'azione principale, bottom nav con icona+etichetta.

## Stato attuale e file pronti

Documento di specifica (questo file) e mockup HTML funzionante della schermata Home nello stile scelto (home-diario-style.html), pronti da passare a Claude Code insieme.

Progetti correlati già esistenti: Diario Allenamento (PWA training personale, Supabase+Netlify), ClimbCoach/ArrampiKit (prototipo multi-agente AI coaching), device VBT DIY (ESP32+IMU) per misurare velocità nelle trazioni.
