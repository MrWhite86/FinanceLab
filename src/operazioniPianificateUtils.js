// Piccole funzioni pure usate dalle Operazioni Pianificate (movimenti ricorrenti automatici,
// vedi Settings.jsx/App.jsx). Nessuna dipendenza da Tauri/DOM qui dentro, così sono testabili
// in isolamento — stesso principio di backupUtils.js.
//
// Forma di una voce in config.operazioniPianificate:
// { id, nome, importo, tags: string[], tipoPeriodicita: 'mensile' | 'annuale', giorno: number (1-31),
//   mese: number (1-12, solo per 'annuale'), ultimaEsecuzione: string ISO (data), attiva: boolean }
//
// Importante: "tags" sono tag reali (gli stessi di config.tags), non un flag credito/debito
// indipendente — l'effetto sul saldo di un movimento deriva sempre dal tipo dei suoi tag
// (vedi useFinance.js), quindi un'operazione pianificata segue la stessa regola invece di
// introdurre un secondo sistema di segno parallelo.

/** Ultimo giorno del mese "mese" (1-12) dell'anno "anno". */
function ultimoGiornoMese(anno, mese) {
  return new Date(anno, mese, 0).getDate();
}

/** Data ISO (YYYY-MM-DD) per anno/mese/giorno desiderato, agganciando "giorno" all'ultimo giorno
 * del mese se lo supera (es. 31 a febbraio -> 28/29): politica scelta perché un'operazione
 * ricorrente reale non deve saltare/sparire silenziosamente nei mesi corti. */
function dataAgganciata(anno, mese, giorno) {
  const giornoValido = Math.min(giorno, ultimoGiornoMese(anno, mese));
  return `${String(anno).padStart(4, '0')}-${String(mese).padStart(2, '0')}-${String(giornoValido).padStart(2, '0')}`;
}

/**
 * La prima occorrenza dell'operazione strettamente successiva a "dataRiferimentoISO".
 * Puro calcolo calendariale: non guarda ultimaEsecuzione né lo stato "attiva" (quella logica
 * vive in occorrenzeMancanti), così è testabile isolatamente per ogni combinazione di date.
 */
export function prossimaOccorrenza(operazione, dataRiferimentoISO) {
  const [annoRif, meseRif] = dataRiferimentoISO.split('-').map(Number);

  if (operazione.tipoPeriodicita === 'annuale') {
    let candidata = dataAgganciata(annoRif, operazione.mese, operazione.giorno);
    if (candidata <= dataRiferimentoISO) candidata = dataAgganciata(annoRif + 1, operazione.mese, operazione.giorno);
    return candidata;
  }

  let anno = annoRif, mese = meseRif;
  let candidata = dataAgganciata(anno, mese, operazione.giorno);
  if (candidata <= dataRiferimentoISO) {
    mese += 1;
    if (mese > 12) { mese = 1; anno += 1; }
    candidata = dataAgganciata(anno, mese, operazione.giorno);
  }
  return candidata;
}

/**
 * Occorrenze da materializzare in un movimento, da operazione.ultimaEsecuzione (escluso) a
 * oggiISO (incluso), troncate a maxRecupero: recupera tutte le occorrenze mancate (es. app
 * rimasta chiusa a lungo), ma con un tetto di sicurezza contro date corrotte/vecchissime.
 * Un'operazione non attiva, o senza occorrenze mancanti, restituisce un array vuoto: nessun
 * movimento viene creato.
 */
export function occorrenzeMancanti(operazione, oggiISO, maxRecupero = 12) {
  if (!operazione.attiva) return [];
  const risultato = [];
  let riferimento = operazione.ultimaEsecuzione;
  while (risultato.length < maxRecupero) {
    const prossima = prossimaOccorrenza(operazione, riferimento);
    if (prossima > oggiISO) break;
    risultato.push(prossima);
    riferimento = prossima;
  }
  return risultato;
}
