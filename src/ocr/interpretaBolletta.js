// Interpretazione del testo grezzo estratto da motoreOcr.js per un caso d'uso specifico:
// trovare gli importi e le date candidati in un documento tipo bolletta. Funzioni pure,
// nessuna dipendenza da tesseract.js/React/Tauri: prendono testo in ingresso, restituiscono
// candidati in uscita, cosi' sono testabili senza dover eseguire un vero OCR.
//
// Non "capiscono" il documento: un motore di OCR puro testo non sa distinguere con certezza
// l'importo dovuto da un codice cliente o un consumo in kWh. Per questo si limita a proporre
// più candidati ordinati per rilevanza (in base alla vicinanza a parole chiave configurabili),
// lasciando sempre la conferma finale all'utente.

const PAROLE_CHIAVE_IMPORTO_DEFAULT = ['totale da pagare', 'importo dovuto', 'totale bolletta', 'da pagare', 'importo', 'totale'];
const PAROLE_CHIAVE_DATA_DEFAULT = ['scadenza', 'scade il', 'data di scadenza', 'entro il'];

const FINESTRA_CONTESTO = 45; // caratteri prima del match, per cercare le parole chiave vicine

/** Frammento di testo PRIMA del match (usato per il punteggio: una parola chiave dopo il numero, es. "10,00 Canone", non deve contare come se lo precedesse). */
function estraiFinestraPrecedente(testo, indice) {
  return testo.slice(Math.max(0, indice - FINESTRA_CONTESTO), indice);
}

/** Frammento di testo prima e dopo la posizione del match, solo per mostrarlo all'utente nell'interfaccia. */
function estraiContesto(testo, indice, lunghezzaMatch) {
  const inizio = Math.max(0, indice - FINESTRA_CONTESTO);
  const fine = Math.min(testo.length, indice + lunghezzaMatch + 15);
  return testo.slice(inizio, fine).replace(/\s+/g, ' ').trim();
}

/**
 * Punteggio di rilevanza: somma pesata delle parole chiave (case-insensitive) che compaiono nel
 * testo che PRECEDE il match. Le parole chiave più all'inizio della lista pesano di più (permette
 * di anteporre una parola chiave "imparata" per un fornitore specifico, vedi ocrModelliFornitore
 * in constants.js, e farla contare più delle parole chiave generiche di default).
 */
function calcolaPunteggio(finestraPrecedente, paroleChiave) {
  const testoLower = finestraPrecedente.toLowerCase();
  return paroleChiave.reduce((punteggio, parola, indice) => (
    testoLower.includes(parola.toLowerCase()) ? punteggio + (paroleChiave.length - indice) : punteggio
  ), 0);
}

/**
 * Trova gli importi in euro nel testo (formato italiano, es. "42,50" o "1.234,56"), ordinati
 * per rilevanza decrescente (i più vicini a una parola chiave vengono prima). A parità di
 * punteggio, mantiene l'ordine di apparizione nel testo.
 */
export function trovaImporti(testo, paroleChiave = PAROLE_CHIAVE_IMPORTO_DEFAULT) {
  const regex = /\d{1,3}(?:\.\d{3})*,\d{2}/g;
  const candidati = [];
  let match;
  while ((match = regex.exec(testo)) !== null) {
    const valore = Number(match[0].replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(valore)) continue;
    const contesto = estraiContesto(testo, match.index, match[0].length);
    const punteggio = calcolaPunteggio(estraiFinestraPrecedente(testo, match.index), paroleChiave);
    candidati.push({ valore, testoOriginale: match[0], contesto, punteggio });
  }
  return candidati.sort((a, b) => b.punteggio - a.punteggio);
}

/** Converte una data in formato italiano (gg/mm/aaaa o gg-mm-aaaa, anno a 2 o 4 cifre) in ISO (aaaa-mm-gg), o null se non valida. */
function dataItalianaAIso(giorno, mese, anno) {
  const g = Number(giorno);
  const m = Number(mese);
  let a = Number(anno);
  if (anno.length === 2) a += 2000;
  if (g < 1 || g > 31 || m < 1 || m > 12) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(g).padStart(2, '0')}`;
}

/**
 * Trova le date nel testo (formato italiano gg/mm/aaaa, con separatore / oppure -), ordinate
 * per rilevanza decrescente allo stesso modo di trovaImporti.
 */
export function trovaDate(testo, paroleChiave = PAROLE_CHIAVE_DATA_DEFAULT) {
  // L'anno a 4 cifre va tentato PRIMA di quello a 2: l'alternanza regex prende la prima
  // opzione che matcha senza backtracking, quindi "\d{2}|\d{4}" leggerebbe solo le prime
  // due cifre di un anno a 4 cifre (es. "2026" -> "20").
  const regex = /(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})/g;
  const candidati = [];
  let match;
  while ((match = regex.exec(testo)) !== null) {
    const valore = dataItalianaAIso(match[1], match[2], match[3]);
    if (!valore) continue;
    const contesto = estraiContesto(testo, match.index, match[0].length);
    const punteggio = calcolaPunteggio(estraiFinestraPrecedente(testo, match.index), paroleChiave);
    candidati.push({ valore, testoOriginale: match[0], contesto, punteggio });
  }
  return candidati.sort((a, b) => b.punteggio - a.punteggio);
}

/**
 * Quando l'utente conferma manualmente un candidato (di trovaImporti/trovaDate), estrae dal suo
 * "contesto" le parole immediately prima del valore, da usare come nuova parola chiave "imparata"
 * per quel fornitore (vedi ocr.modelliFornitore in constants.js e impareOcrFornitore in App.jsx).
 * Non richiede che il candidato avesse già un punteggio: impara anche da un candidato trovato
 * "a caso" (punteggio 0), purché ci sia del testo prima del valore da cui ricavare un indizio.
 */
export function estraiParolaChiaveDaContesto(contesto, testoOriginale) {
  const indice = contesto.lastIndexOf(testoOriginale);
  if (indice <= 0) return '';
  const parole = contesto.slice(0, indice).trim().split(/\s+/).filter(Boolean);
  return parole.slice(-3).join(' ').toLowerCase();
}

export { PAROLE_CHIAVE_IMPORTO_DEFAULT, PAROLE_CHIAVE_DATA_DEFAULT };
