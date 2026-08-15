// Valori di default e palette colori condivisi da tutta l'app.
// Non c'è logica qui dentro: sono solo dati statici, separati dal codice per essere
// facili da ritrovare e modificare senza scavare tra i componenti.

/**
 * Configurazione iniziale di un nuovo utente (usata da App.jsx finché non viene
 * sovrascritta dai dati salvati in localStorage per quello specifico utente).
 * - saldoStatoZero / dataStatoZero: il saldo di partenza da cui useFinance.js parte
 *   a sommare/sottrarre i movimenti per calcolare la liquidità attuale.
 * - coloreTema: colore principale dell'interfaccia (bottoni, grafici, header).
 * - percorsoSalvataggio: cartella di default per il backup locale (solo versione desktop Tauri).
 * - percorsoCattura: cartella opzionale (es. dentro iCloud Drive/Google Drive) sincronizzata
 *   col telefono, dove l'utente salva foto/scansioni da collegare poi a un record (vedi Importa.jsx).
 * - fileCatturaGestiti: nomi dei file di percorsoCattura già collegati a un record o creati come
 *   nuovo record, cosi' non ricompaiono più nella vista "Documenti da Importare".
 * - backupLocale/backupCloud: due destinazioni di backup indipendenti (vedi backupUtils.js e
 *   App.jsx/eseguiBackup), ognuna con la propria frequenza ('nessuno'|'avvio'|'giornaliero'|'modifica')
 *   e il proprio numero di snapshot da conservare (1-3). backupCloud si attiva solo se "attivo" è
 *   true e ha un percorso proprio (es. dentro iCloud Drive/Google Drive); backupLocale usa sempre
 *   percorsoSalvataggio. "ultimoBackup" (ISO) serve solo alla frequenza 'giornaliero'.
 * - tags: le "categorie" disponibili per i movimenti; ognuna ha un "tipo" (entrata/uscita/neutro)
 *   che determina se un movimento con quel tag aumenta, riduce o non tocca il saldo.
 * - anniAttivi: gli anni (registri) mostrati di default nella barra laterale.
 */
export const INITIAL_CONFIG = {
  saldoStatoZero: 10000,
  dataStatoZero: '2024-01-01',
  coloreTema: '#4f46e5',
  percorsoSalvataggio: '/Users/marcellobianco/Documents/FinanceLab_Data',
  percorsoCattura: '',
  fileCatturaGestiti: [],
  backupLocale: { frequenza: 'nessuno', numeroBackup: 1, ultimoBackup: null },
  backupCloud: { attivo: false, percorso: '', frequenza: 'nessuno', numeroBackup: 1, ultimoBackup: null },
  tags: [
    { nome: "stipendio", tipo: "entrata" },
    { nome: "bollette", tipo: "uscita" },
    { nome: "condominio", tipo: "uscita" },
    { nome: "affitto", tipo: "uscita" },
    { nome: "documenti", tipo: "neutro" }
  ],
  anniAttivi: ['2026', '2025', '2024']
};

/**
 * Palette di colori usata a rotazione nei grafici (grafico a torta, andamento tag)
 * quando serve un colore diverso per ogni serie/categoria mostrata.
 * In App.jsx il primo colore viene sostituito dinamicamente con config.coloreTema,
 * cosi' il grafico principale segue sempre il tema scelto dall'utente.
 */
export const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];