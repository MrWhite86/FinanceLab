// Piccole funzioni pure usate dal meccanismo di backup automatico (vedi eseguiBackup in App.jsx).
// Nessuna dipendenza da Tauri/DOM qui dentro, così sono testabili in isolamento.

const PREFISSO_CARTELLA_BACKUP = 'backup_completo_';

/** Timestamp ordinabile alfabeticamente = ordinabile cronologicamente (es. "2026-08-15_143005"). */
export function timestampOrdinabile(date = new Date()) {
  return date.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '');
}

/** Nome della cartella di uno snapshot di backup, unico per secondo e ordinabile. */
export function nomeCartellaBackup(date = new Date()) {
  return `${PREFISSO_CARTELLA_BACKUP}${timestampOrdinabile(date)}`;
}

/**
 * Dati i nomi delle cartelle già presenti nella destinazione di backup, quali vanno rimosse
 * per rispettare "numeroDaTenere" (mantiene le più recenti, elimina le più vecchie). Ignora
 * qualunque cartella/file che non abbia il prefisso di uno snapshot di backup (difensivo:
 * non tocca nulla che l'utente abbia messo lì per conto suo).
 */
export function cartelleDaRimuovere(nomiEsistenti, numeroDaTenere) {
  const nomiBackup = (nomiEsistenti || [])
    .filter(nome => nome.startsWith(PREFISSO_CARTELLA_BACKUP))
    .sort(); // ordine alfabetico = ordine cronologico, dato il formato del timestamp
  const daEliminare = nomiBackup.length - numeroDaTenere;
  return daEliminare > 0 ? nomiBackup.slice(0, daEliminare) : [];
}

/**
 * True se, secondo la frequenza scelta, va eseguito un backup automatico ora (chiamata al login/
 * avvio dell'app). Gestisce solo 'avvio' e 'giornaliero': 'modifica' è gestito a parte con un
 * debounce sulle modifiche dei dati (vedi App.jsx), 'nessuno' non fa mai scattare nulla qui.
 */
export function backupDaEseguireAllAvvio(frequenza, ultimoBackupISO) {
  if (frequenza === 'avvio') return true;
  if (frequenza === 'giornaliero') {
    if (!ultimoBackupISO) return true;
    const trascorsoMs = Date.now() - new Date(ultimoBackupISO).getTime();
    return trascorsoMs >= 24 * 60 * 60 * 1000;
  }
  return false;
}
