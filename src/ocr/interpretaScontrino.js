// Interpretazione del testo grezzo estratto da motoreOcr.js per un caso d'uso specifico:
// uno scontrino della spesa. A differenza di interpretaBolletta.js (che cerca UN importo e
// UNA data in tutto il documento), qui il problema è diverso: lo scontrino ha tante righe
// prodotto, ciascuna con una propria descrizione e un proprio prezzo, da isolare ed
// eventualmente classificare in una macro-categoria (pane, latticini, carne...). Funzioni
// pure, nessuna dipendenza da tesseract.js/React/Tauri, stesso principio di interpretaBolletta.js.
//
// Come in interpretaBolletta.js, questo modulo non "capisce" lo scontrino: propone righe
// candidate e categorie suggerite, ma la conferma finale (e l'eventuale correzione) resta
// sempre dell'utente.

// Righe che il layout di uno scontrino tipico contiene ma che non sono prodotti: intestazione
// del negozio, riepilogo pagamento, piè di pagina fiscale. Il controllo è per sottostringa
// case-insensitive, quindi basta una di queste parole per escludere l'intera riga.
const PAROLE_ESCLUSE_RIGA = [
  'totale', 'subtotale', 'contante', 'contanti', 'resto', 'reso', 'sconto',
  'scontrino', 'fiscale', 'documento commerciale', 'iva', 'p.iva', 'partita iva',
  'cod. fisc', 'cassa', 'cassiere', 'operatore', 'grazie', 'arrivederci', 'benvenut',
  'bancomat', 'carta di credito', 'pagamento', 'buono', 'punti fedelta', 'punti fedeltà',
  'carta fedelta', 'carta fedeltà', 'fidaty',
];

// Prezzo a FINE riga (a volte seguito da un codice IVA di una lettera, es. "2,50 B"): ancorare
// alla fine della riga è la difesa principale contro numeri "decoy" a metà riga, come il peso
// di un prodotto sfuso ("MELE KG 1,200"), che altrimenti verrebbero scambiati per il prezzo.
// Il "(?!\d)" dopo i due decimali evita di leggere "1,20" dentro "1,200" (un peso a 3 decimali).
const REGEX_PREZZO_FINE_RIGA = /(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)\s*[A-Za-z]?\s*$/;

function rigaEsclusa(riga) {
  const testoLower = riga.toLowerCase();
  return PAROLE_ESCLUSE_RIGA.some(parola => testoLower.includes(parola));
}

/**
 * Isola le righe-prodotto dal testo grezzo di uno scontrino: per ogni riga non esclusa che
 * termina con un prezzo valido, restituisce { descrizione, importo, testoOriginale }.
 * Non tenta di unire righe spezzate su più linee (es. descrizione su una riga e
 * "peso X prezzo/kg = importo" sulla successiva): limitazione nota, l'utente corregge a mano
 * i casi che l'estrazione automatica manca.
 */
export function estraiRigheProdotto(testo) {
  const righe = (testo || '').split('\n');
  const risultato = [];
  for (const rigaGrezza of righe) {
    const riga = rigaGrezza.trim();
    if (!riga || rigaEsclusa(riga)) continue;

    const match = riga.match(REGEX_PREZZO_FINE_RIGA);
    if (!match) continue;

    const descrizione = riga.slice(0, match.index).replace(/\s+/g, ' ').trim();
    if (descrizione.length < 2) continue;

    const importo = Number(match[1].replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(importo) || importo <= 0) continue;

    risultato.push({ descrizione, importo, testoOriginale: riga });
  }
  return risultato;
}

/**
 * Cerca l'importo totale dello scontrino: la prima riga che contiene "totale" (ma non
 * "subtotale", che indicherebbe un parziale) e termina con un prezzo. Restituisce null se non
 * trovato. Usato come riferimento per un futuro controllo di coerenza nella UI (somma delle
 * righe vs totale dichiarato), non per validare le singole righe qui.
 */
export function estraiTotale(testo) {
  const righe = (testo || '').split('\n');
  const rigaTotale = righe.find(r => /\btotale\b/i.test(r) && !/subtotale/i.test(r));
  if (!rigaTotale) return null;
  const match = rigaTotale.trim().match(REGEX_PREZZO_FINE_RIGA);
  if (!match) return null;
  return Number(match[1].replace(/\./g, '').replace(',', '.'));
}

/**
 * Assegna a una descrizione-prodotto la macro-categoria più probabile, in base a un dizionario
 * { categoria: [parole chiave in ordine di priorità] } (stessa idea di "priorità per posizione"
 * di calcolaPunteggio in interpretaBolletta.js, cosi' una parola chiave "imparata" per un
 * prodotto specifico potrà un domani essere anteposta e vincere sulle parole generiche).
 * Match per sottostringa case-insensitive (non per parola esatta): stessa scelta pragmatica di
 * interpretaBolletta.js, i falsi positivi occasionali li corregge l'utente in fase di conferma.
 * Restituisce { categoria: null, punteggio: 0 } se nessuna parola chiave trova corrispondenza:
 * la UI decide come presentare "nessuna categoria riconosciuta" (non lo decide questo modulo).
 */
export function classificaCategoria(descrizione, categorie) {
  const testoLower = (descrizione || '').toLowerCase();
  let migliore = { categoria: null, punteggio: 0 };
  for (const [categoria, paroleChiave] of Object.entries(categorie)) {
    const punteggio = paroleChiave.reduce((acc, parola, indice) => (
      testoLower.includes(parola.toLowerCase()) ? acc + (paroleChiave.length - indice) : acc
    ), 0);
    if (punteggio > migliore.punteggio) migliore = { categoria, punteggio };
  }
  return migliore;
}

/**
 * Punto d'ingresso del modulo: dal testo grezzo OCR di uno scontrino produce l'elenco delle
 * righe-prodotto rilevate, ciascuna con la categoria suggerita, più il totale dichiarato se
 * riconosciuto. Non crea alcun movimento/sottovoce: è solo interpretazione del testo, la
 * creazione dei record resta responsabilità del chiamante (Importa.jsx/App.jsx).
 */
export function interpretaScontrino(testo, categorie) {
  const righe = estraiRigheProdotto(testo).map(riga => ({
    ...riga,
    ...classificaCategoria(riga.descrizione, categorie),
  }));
  return { righe, totaleRilevato: estraiTotale(testo) };
}

/**
 * Macro-categorie di partenza per la spesa alimentare/casa, con parole chiave in italiano
 * ordinate dalla più specifica alla più generica. Punto di partenza ragionevole, non un elenco
 * esaustivo: l'utente può correggere le classificazioni sbagliate (il meccanismo di
 * apprendimento per parola chiave, analogo a ocr.modelliFornitore per le bollette, è previsto
 * ma non ancora implementato in questo modulo).
 */
export const CATEGORIE_DEFAULT = {
  'pane e prodotti da forno': ['pane', 'panino', 'grissini', 'focaccia', 'baguette', 'ciabatta', 'cracker', 'fette biscottate', 'piadina'],
  'latticini e uova': ['latte', 'yogurt', 'formaggio', 'mozzarella', 'burro', 'uova', 'ricotta', 'parmigiano', 'grana', 'philadelphia', 'panna'],
  'carne e salumi': ['pollo', 'manzo', 'maiale', 'salame', 'prosciutto', 'wurstel', 'bresaola', 'tacchino', 'salsiccia', 'mortadella', 'bistecca'],
  'pesce': ['pesce', 'tonno', 'salmone', 'gamberi', 'merluzzo', 'branzino', 'orata', 'cozze', 'vongole'],
  'frutta e verdura': ['mele', 'banane', 'pomodori', 'insalata', 'patate', 'carote', 'zucchine', 'arance', 'limoni', 'cipolle', 'verdura', 'frutta'],
  'bevande': ['acqua', 'vino', 'birra', 'succo', 'cola', 'aranciata', 'the', 'tè', 'caffe', 'caffè', 'bibita'],
  'dispensa': ['pasta', 'riso', 'olio', 'zucchero', 'sale', 'farina', 'sugo', 'biscotti', 'cereali', 'legumi', 'conserva', 'passata'],
  'igiene e pulizia': ['detersivo', 'sapone', 'shampoo', 'dentifricio', 'carta igienica', 'ammorbidente', 'detergente', 'scottex', 'bagnoschiuma'],
};
