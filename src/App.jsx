/**
 * Arkiv - Componente Root
 *
 * È il "centro di controllo" dell'app: tiene in memoria tutto lo stato condiviso
 * (utente loggato, configurazione, elenco movimenti) e lo passa in giù ai componenti
 * figli come props. I figli (Login/Sidebar/Search/Settings/Dashboard) non parlano
 * mai direttamente tra loro né toccano localStorage: passano sempre da qui.
 *
 * Responsabilità principali:
 * 1. Autenticazione: mostra LoginView finché non c'è un currentUser.
 * 2. Persistenza: carica/salva config e movimenti in localStorage, una chiave per utente.
 * 3. Navigazione: decide quale vista mostrare (Impostazioni/Ricerca/Dashboard di un anno)
 *    in base ad activeTab.
 * 4. Calcolo finanziario: delega tutta la logica di calcolo all'hook useFinance.
 */

import { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { Toast, Modal, AnteprimaModal } from './components/UI';
import LoginView from './components/Login';
import SearchView from './components/Search';
import SettingsView from './components/Settings';
import ImportaView from './components/Importa';
import { useFinance } from './useFinance';
import { INITIAL_CONFIG, COLORS } from './constants';
import { parseImportedData } from './importUtils';
import { mimeTypeDaNomeFile, bytesToBase64 } from './fileUtils';
import { nomeCartellaBackup, cartelleDaRimuovere, backupDaEseguireAllAvvio } from './backupUtils';
import { scuraColore } from './colorUtils';
import { interpretaScontrino, CATEGORIE_DEFAULT } from './ocr/interpretaScontrino';
import { occorrenzeMancanti } from './operazioniPianificateUtils';
// I moduli OCR (tesseract.js/pdfjs-dist, pesanti) si caricano solo quando servono davvero (import
// dinamico dentro estraiDatiOcr/impareOcrFornitore), non ad ogni avvio dell'app: stesso principio
// già usato per Dashboard.jsx (lazy) con recharts, per non appesantire il caricamento iniziale
// di chi non usa mai "Documenti da Importare".

// Dashboard include recharts (libreria di grafici pesante): caricata solo quando serve davvero,
// non al primo avvio dell'app (login/impostazioni/ricerca non ne hanno bisogno).
const DashboardView = lazy(() => import('./components/Dashboard'));

export default function App() {
  // --- STATO DELL'APPLICAZIONE ---
  /**
   * Utente correntemente loggato. Se null, mostra la LoginView.
   * @type {string|null}
   */
  const [currentUser, setCurrentUser] = useState(null);

  // Notifica in basso a destra (stringa semplice, oppure {text, onUndo} per un'azione ANNULLA) e finestra di dialogo modale (conferma/prompt), condivise da tutta l'app.
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState({ show: false, type: 'confirm', title: '', msg: '', onConfirm: null, inputValue: '' });
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  /** Per ogni operazione pianificata attiva, calcola i movimenti da creare per ciascuna occorrenza
   * mancata (vedi occorrenzeMancanti in operazioniPianificateUtils.js) e la nuova "ultimaEsecuzione"
   * di ciascuna (non un timestamp globale, cosi' ognuna segue il proprio calendario indipendentemente
   * dalle altre). Funzione pura sui dati passati (non legge config/spese dallo stato del componente):
   * va chiamata sui dati appena caricati da localStorage nell'effetto di login qui sotto, non in un
   * effetto separato - vedi il commento lì per il perché. */
  const materializzaOperazioniPianificate = (operazioniPianificate) => {
    const oggiISO = new Date().toISOString().slice(0, 10);
    const nuoviMovimenti = [];
    const operazioniAggiornate = (operazioniPianificate || []).map(op => {
      const occorrenze = occorrenzeMancanti(op, oggiISO);
      if (occorrenze.length === 0) return op;
      occorrenze.forEach(dataOccorrenza => {
        const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now() + Math.random();
        nuoviMovimenti.push({ id, importo: Number(op.importo), tags: op.tags, data: dataOccorrenza, nota: op.nome });
      });
      return { ...op, ultimaEsecuzione: occorrenze[occorrenze.length - 1] };
    });
    return { nuoviMovimenti, operazioniAggiornate };
  };

  // Campi del form "Gestione Profilo" in Settings.jsx (nome utente/password da aggiornare).
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  // Tab attiva nella Sidebar: 'impostazioni', 'ricerca', oppure un anno (es. '2026') per aprire quel registro.
  const [activeTab, setActiveTab] = useState('impostazioni');
  const [searchTerm, setSearchTerm] = useState('');

  // Larghezza finestra, usata solo per decidere il layout mobile (menu a hamburger) sotto i 1024px.
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 1024;

  /** Configurazione dell'utente (tag, saldo iniziale, tema...): parte dai default, viene sostituita dai dati salvati appena si fa login (vedi effect sotto). */
  const [config, setConfig] = useState(() => {
    return INITIAL_CONFIG; // Default to initial config
  });
  /** Tutti i movimenti dell'utente loggato, di tutti gli anni (Dashboard.jsx filtra quelli dell'anno aperto). */
  const [spese, setSpese] = useState([]);

  /** Utente per cui la config REALE (letta da localStorage, non i default) è già stata caricata in
   * questa sessione — vedi il commento nell'effetto di caricamento qui sotto e nel controllo backup
   * "ad ogni avvio" più in basso, che lo usa per evitare di scattare troppo presto. Deve essere
   * stato React (non un ref): un ref mutato dentro l'effetto di caricamento sarebbe visibile
   * SINCRONAMENTE anche agli altri effetti dello stesso giro di commit (quello in cui currentUser è
   * appena cambiato), mentre "config" lì è ancora il valore precedente perché setConfig si applica
   * solo al render successivo — un ref "sblocca" il controllo un istante troppo presto. Uno stato,
   * invece, si applica in batch insieme a setConfig/setSpese (stesso effetto, stesso giro), quindi
   * diventa visibile agli altri effetti esattamente nello stesso render in cui anche "config" è già
   * aggiornato: è quello che si vuole davvero. */
  const [configCaricatoPer, setConfigCaricatoPer] = useState(null);

  // Caricamento dati specifico per utente al login: sincronizza lo stato React con localStorage
  // (sistema esterno) ogni volta che cambia l'utente loggato, in un componente che non si rimonta.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (currentUser) {
      const savedConfig = localStorage.getItem(`finance_lab_config_${currentUser}`);
      const savedData = localStorage.getItem(`finance_lab_data_${currentUser}`);
      
      let currentConfig = { ...INITIAL_CONFIG }; // Start with default config
      if (savedConfig) { // If there's a saved config, parse and merge
        let parsed = JSON.parse(savedConfig);
        
        // MIGRAZIONE: Trasforma 'categorie' in 'tags' se necessario
        if (parsed.categorie && !parsed.tags) {
          parsed.tags = parsed.categorie;
          delete parsed.categorie;
        }

        currentConfig = { ...currentConfig, ...parsed }; // Merge saved with initial
        // Force global root path if admin
        const globalRoot = localStorage.getItem('finance_lab_global_root');
        if (globalRoot) currentConfig.percorsoSalvataggio = globalRoot;
      }

      let speseCaricate = [];
      if (savedData) {
        // MIGRAZIONE: Converte il campo 'categoria' (stringa) nel nuovo array 'tags'
        speseCaricate = JSON.parse(savedData).map(s => {
          if (s.categoria && (!s.tags || s.tags.length === 0)) {
            return { ...s, tags: [s.categoria], categoria: undefined };
          }
          return s;
        });
      }

      // Operazioni Pianificate: la materializzazione delle occorrenze mancate va fatta QUI, nello
      // stesso effetto di caricamento, sui dati appena letti da localStorage - non in un secondo
      // effetto separato gated su [currentUser, spese] (come backupAvvioEseguitoRef qui sotto).
      // Un secondo effetto scatterebbe anche in QUESTO stesso giro di commit (currentUser è già
      // cambiato), quando "config"/"spese" nel suo closure sono ancora i valori di default del
      // render precedente (setConfig/setSpese non hanno ancora effetto sullo stesso giro di
      // effetti): marcherebbe l'utente come "già controllato" prima ancora di aver letto la sua
      // config reale, senza mai materializzare nulla. Calcolando qui, sui valori locali appena
      // letti, il problema non si pone.
      const { nuoviMovimenti, operazioniAggiornate } = materializzaOperazioniPianificate(currentConfig.operazioniPianificate);
      currentConfig.operazioniPianificate = operazioniAggiornate;
      if (nuoviMovimenti.length > 0) {
        speseCaricate = [...speseCaricate, ...nuoviMovimenti];
        showToast(`${nuoviMovimenti.length} movimento/i creato/i da operazioni pianificate.`);
      }

      setConfig(currentConfig);
      setSpese(speseCaricate);
      // Segnala (in batch con setConfig/setSpese qui sopra, vedi il commento sulla dichiarazione di
      // questo stato) che per questo utente la config REALE è ora disponibile: il controllo backup
      // "ad ogni avvio"/"giornaliero" qui sotto lo aspetta prima di leggere config.backupLocale.
      setConfigCaricatoPer(currentUser);

      // Inizializza i campi di modifica profilo con il nome utente corrente
      setNewUsername(currentUser);
      setNewPassword(''); // La password non viene pre-compilata per sicurezza
    } else {
      // Clear profile fields if no user is logged in
      setNewUsername('');
      setNewPassword('');
    }
  }, [currentUser]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // --- PERSISTENZA DATI ---
  // Salva config e movimenti in localStorage ad ogni modifica (autosave), sotto chiavi
  // specifiche dell'utente loggato. Nessun debounce: per i volumi di dati di un'app
  // personale il costo di scrivere ad ogni cambiamento è trascurabile.
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`finance_lab_config_${currentUser}`, JSON.stringify(config));
      localStorage.setItem(`finance_lab_data_${currentUser}`, JSON.stringify(spese));
      
      // Se l'utente è admin, salva il percorso come root globale per tutti
      if (currentUser === 'admin') {
        localStorage.setItem('finance_lab_global_root', config.percorsoSalvataggio);
      }
    }
  }, [config, spese, currentUser]);

  /** true solo dentro l'app desktop Tauri (mai in un browser normale): usato per nascondere/disabilitare funzioni che richiedono il filesystem, come il backup su cartella. */
  const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI__;

  // --- HOOK FINANZA (LOGICA ESTRATTA) ---
  // Tutto il "numero-crunching" (saldo, grafici, ricerca) vive in useFinance.js: qui si
  // passano solo i dati grezzi e si ricevono i risultati già pronti da mostrare.
  const {
    listaAnni, movimentiAnno, saldoAttuale, speseFiltrateRicerca, topTags,
    datiPatrimonioMese, datiTorta
  } = useFinance(spese, config, activeTab, searchTerm);

  /** Palette dei grafici: il primo colore segue sempre il tema scelto dall'utente, gli altri sono quelli fissi di COLORS. */
  const chartColors = useMemo(() => [config.coloreTema, ...COLORS.slice(1)], [config.coloreTema]);

  // --- GESTORI EVENTI ---
  /** Apre il prompt "Nuovo Registro" e, se l'anno inserito è valido (4 cifre) e non già presente, lo aggiunge e ci passa sopra. */
  const aggiungiAnno = () => {
    setModal({
      show: true, type: 'prompt', title: 'Nuovo Registro', msg: 'Inserisci l\'anno da creare:', 
      inputValue: new Date().getFullYear() + 1,
      onConfirm: (val) => {
        if (val && /^\d{4}$/.test(val)) {
          if (!config.anniAttivi.includes(val)) {
            setConfig(prev => ({ ...prev, anniAttivi: [...(prev.anniAttivi || []), val] }));
          }
          setActiveTab(val);
        } else showToast("Anno non valido.");
        setModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  /** Rimuove un registro annuale dalla Sidebar, ma solo se non contiene movimenti (altrimenti si perderebbero dati senza preavviso). */
  const rimuoviAnno = (anno) => {
    if (spese.some(m => m.data.startsWith(anno))) return showToast("L'anno contiene dati. Svuotalo prima.");
    setModal({
      show: true, type: 'confirm', title: 'Elimina Anno', msg: `Vuoi davvero rimuovere il ${anno}?`,
      onConfirm: () => {
        setConfig(prev => ({ ...prev, anniAttivi: prev.anniAttivi.filter(a => a !== anno) }));
        if (activeTab === anno) setActiveTab('impostazioni');
        setModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  /** Handler del file picker "Importa" in Settings.jsx: legge il file scelto e delega il parsing/validazione a importUtils.js. */
  const importaJSON = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { config: cfg, spese: speseMigrate, skippedCount } = parseImportedData(ev.target.result);
        if (cfg) setConfig(cfg);
        if (speseMigrate) setSpese(speseMigrate);
        showToast(skippedCount > 0 ? `Dati importati (${skippedCount} record scartati: data o importo non validi).` : "Dati importati!");
      } catch { showToast("File corrotto."); }
    };
    reader.readAsText(e.target.files[0]);
  };

  // --- BACKUP AUTOMATICO (locale e cloud, indipendenti: vedi backupLocale/backupCloud in constants.js) ---
  /** Copia ricorsivamente tutto il contenuto di "sorgente" dentro "destinazione" (crea le sottocartelle mancanti). Se "sorgente" non esiste ancora (nessun allegato mai caricato), non fa nulla. */
  const copiaCartellaRicorsiva = async (sorgente, destinazione) => {
    const { readDir, copyFile, createDir } = window.__TAURI__.fs;
    const { join } = window.__TAURI__.path;
    await createDir(destinazione, { recursive: true });
    let voci;
    try { voci = await readDir(sorgente, { recursive: true }); } catch { return; }
    const copiaLista = async (lista, segmenti) => {
      for (const voce of lista) {
        const segmentiVoce = [...segmenti, voce.name];
        if (voce.children) {
          await createDir(await join(destinazione, ...segmentiVoce), { recursive: true });
          await copiaLista(voce.children, segmentiVoce);
        } else {
          await copyFile(voce.path, await join(destinazione, ...segmentiVoce));
        }
      }
    };
    await copiaLista(voci, []);
  };

  /**
   * Crea uno snapshot di backup COMPLETO e autosufficiente (archivio.json con config+spese, più una
   * copia di tutti gli allegati) dentro "<radice>/<utente>/backup_completo/<timestamp>/", cosi'
   * caricando quella cartella su un altro PC (con Importa) si recupera tutto. Applica poi la
   * rotazione: mantiene solo le "numeroBackup" copie più recenti per quella destinazione, eliminando
   * le più vecchie. destinazione: 'locale' (usa percorsoSalvataggio) oppure 'cloud' (usa backupCloud.percorso).
   * Annidato per utente perché percorsoSalvataggio è condiviso da tutti i profili sullo stesso Mac
   * (vedi globalRoot): senza questo, due utenti diversi si sovrascriverebbero a vicenda i backup.
   */
  const eseguiBackup = async (destinazione) => {
    if (!isTauri()) { showToast("Solo versione Desktop."); return; }
    const radice = destinazione === 'locale' ? config.percorsoSalvataggio : config.backupCloud?.percorso;
    if (!radice) { showToast("Nessun percorso di backup configurato."); return; }
    try {
      const { writeTextFile, readDir, removeDir, createDir } = window.__TAURI__.fs;
      const { join } = window.__TAURI__.path;

      const cartellaBackupCompleto = await join(radice, currentUser, 'backup_completo');
      const cartellaSnapshot = await join(cartellaBackupCompleto, nomeCartellaBackup());
      await createDir(cartellaSnapshot, { recursive: true });
      await writeTextFile(await join(cartellaSnapshot, 'archivio.json'), JSON.stringify({ config, spese }));
      await copiaCartellaRicorsiva(await join(config.percorsoSalvataggio, currentUser, 'backup'), await join(cartellaSnapshot, 'backup'));

      // Rotazione: mantiene solo le copie più recenti configurate per questa destinazione
      const numeroDaTenere = (destinazione === 'locale' ? config.backupLocale?.numeroBackup : config.backupCloud?.numeroBackup) || 1;
      let nomiEsistenti = [];
      try { nomiEsistenti = (await readDir(cartellaBackupCompleto)).map(e => e.name); } catch { /* primo backup in assoluto per questa destinazione */ }
      for (const nome of cartelleDaRimuovere(nomiEsistenti, numeroDaTenere)) {
        await removeDir(await join(cartellaBackupCompleto, nome), { recursive: true });
      }

      const chiaveConfig = destinazione === 'locale' ? 'backupLocale' : 'backupCloud';
      setConfig(prev => ({ ...prev, [chiaveConfig]: { ...prev[chiaveConfig], ultimoBackup: new Date().toISOString() } }));
      showToast(`Backup ${destinazione === 'locale' ? 'locale' : 'cloud'} completato!`);
    } catch {
      showToast(`Errore durante il backup ${destinazione === 'locale' ? 'locale' : 'cloud'}.`);
    }
  };

  /** Apre il selettore cartelle nativo per scegliere/cambiare backupCloud.percorso (Impostazioni). */
  const selezionaCartellaBackupCloud = async () => {
    if (!isTauri()) { showToast("Solo versione Desktop."); return; }
    try {
      const { open } = window.__TAURI__.dialog;
      const scelta = await open({ directory: true });
      if (!scelta) return;
      setConfig(prev => ({ ...prev, backupCloud: { ...prev.backupCloud, percorso: scelta } }));
    } catch {
      showToast("Errore durante la selezione della cartella.");
    }
  };

  // Controllo "ad ogni avvio"/"giornaliero": una sola volta per sessione di login (non ad ogni
  // modifica delle impostazioni). Aspetta che configCaricatoPer confermi che "config" riflette già i
  // dati salvati (non i default iniziali) prima di leggere config.backupLocale — vedi il commento
  // sulla dichiarazione di configCaricatoPer per il perché è uno stato e non un ref.
  const backupAvvioEseguitoRef = useRef(new Set());
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!currentUser || configCaricatoPer !== currentUser || backupAvvioEseguitoRef.current.has(currentUser)) return;
    backupAvvioEseguitoRef.current.add(currentUser);
    if (backupDaEseguireAllAvvio(config.backupLocale?.frequenza, config.backupLocale?.ultimoBackup)) {
      eseguiBackup('locale');
    }
    if (config.backupCloud?.attivo && backupDaEseguireAllAvvio(config.backupCloud?.frequenza, config.backupCloud?.ultimoBackup)) {
      eseguiBackup('cloud');
    }
  }, [currentUser, spese, configCaricatoPer]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  // "Ad ogni modifica": backup automatico "debounced" ~2s dopo l'ultima modifica ai MOVIMENTI
  // (non ad ogni modifica di config, altrimenti l'aggiornamento di backupLocale.ultimoBackup fatto
  // da eseguiBackup stesso ritriggererebbe questo effetto all'infinito).
  const debounceBackupRef = useRef({ locale: null, cloud: null });
  useEffect(() => {
    if (!currentUser) return;
    const timer = debounceBackupRef.current;
    if (config.backupLocale?.frequenza === 'modifica') {
      clearTimeout(timer.locale);
      timer.locale = setTimeout(() => eseguiBackup('locale'), 2000);
    }
    if (config.backupCloud?.attivo && config.backupCloud?.frequenza === 'modifica') {
      clearTimeout(timer.cloud);
      timer.cloud = setTimeout(() => eseguiBackup('cloud'), 2000);
    }
    return () => {
      clearTimeout(timer.locale);
      clearTimeout(timer.cloud);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spese]);

  /** Apre il selettore cartelle nativo per scegliere/cambiare percorsoCattura (Impostazioni), cosi' l'utente non deve digitare a mano un percorso lungo (es. dentro iCloud Drive). */
  const selezionaCartellaCattura = async () => {
    if (!isTauri()) {
      showToast("Solo versione Desktop.");
      return;
    }
    try {
      const { open } = window.__TAURI__.dialog;
      const scelta = await open({ directory: true });
      if (!scelta) return; // utente ha annullato
      setConfig(prev => ({ ...prev, percorsoCattura: scelta }));
    } catch {
      showToast("Errore durante la selezione della cartella.");
    }
  };

  /** Salva le modifiche del form "Gestione Profilo": rinomina l'utente (migrando i suoi dati salvati) e/o aggiorna l'hash della password. */
  const handleUpdateProfile = async () => {
    const users = JSON.parse(localStorage.getItem('finance_lab_users') || '{}');
    let updatedUsers = { ...users };
    let successMessages = [];

    // --- Validazione Input ---
    if (!newUsername.trim()) {
      showToast("Username vuoto.");
      return;
    }
    if (newPassword.length > 0 && !newPassword.trim()) {
      showToast("Password non valida.");
      return;
    }

    // --- Gestione Cambio Nome Utente ---
    let usernameChanged = false;
    if (newUsername !== currentUser) {
      if (updatedUsers[newUsername]) {
        showToast("Username occupato.");
        return;
      }
      
      // Migra i dati associati al vecchio utente al nuovo utente
      const oldConfig = localStorage.getItem(`finance_lab_config_${currentUser}`);
      const oldSpese = localStorage.getItem(`finance_lab_data_${currentUser}`);

      if (oldConfig) localStorage.setItem(`finance_lab_config_${newUsername}`, oldConfig);
      if (oldSpese) localStorage.setItem(`finance_lab_data_${newUsername}`, oldSpese);

      localStorage.removeItem(`finance_lab_config_${currentUser}`);
      localStorage.removeItem(`finance_lab_data_${currentUser}`);

      // Aggiorna l'oggetto utenti
      updatedUsers[newUsername] = updatedUsers[currentUser];
      delete updatedUsers[currentUser];
      
      setCurrentUser(newUsername); // Aggiorna l'utente corrente
      usernameChanged = true;
      successMessages.push("Nome utente aggiornato.");
    }

    // --- Gestione Cambio Password tramite Hash SHA-256 ---
    if (newPassword.length > 0) {
      const encoder = new TextEncoder();
      const data = encoder.encode(newPassword);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const newHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      updatedUsers[newUsername || currentUser] = newHash;
      successMessages.push("Password aggiornata.");
    } else if (!usernameChanged) {
      showToast("Nessuna modifica.");
      return;
    }

    localStorage.setItem('finance_lab_users', JSON.stringify(updatedUsers));
    setNewPassword(''); // Pulisce il campo password dopo l'aggiornamento
    showToast(successMessages.join(' ') || "Profilo aggiornato!");
  };

  /** Cancellazione movimento con supporto all'azione ANNULLA (Undo) */
  const handleRemoveSpesaWithUndo = (id) => {
    const spesaDaRimuovere = spese.find(s => String(s.id) === String(id));
    if (!spesaDaRimuovere) return;

    setSpese(prev => prev.filter(s => String(s.id) !== String(id)));

    setToast({
      text: "Movimento eliminato.",
      onUndo: () => {
        setSpese(prev => [...prev, spesaDaRimuovere]);
        showToast("Movimento ripristinato!");
      }
    });
  };

  /** Applica un aggiornamento parziale a un movimento esistente (usato per tag, allegati...). Condiviso tra Search e Dashboard. */
  const updateSpesa = (id, updated) => setSpese(prev => prev.map(s => String(s.id) === String(id) ? { ...s, ...updated } : s));

  /**
   * Allega uno o più file a un movimento esistente: apre il selettore file nativo del sistema
   * operativo (serve Tauri, non è possibile ottenere il percorso reale di un file scelto
   * tramite <input type="file"> del browser per motivi di sicurezza), ne fa una COPIA dentro
   * percorsoSalvataggio/<utente>/backup/<anno del movimento>/, e aggiunge i nomi dei file all'elenco
   * allegati del movimento (senza duplicati). Il file originale scelto dall'utente non viene
   * toccato/spostato, solo copiato. Cliccare più volte accumula altri allegati, non sostituisce
   * quelli già presenti; supporta anche il vecchio campo singolare "allegato" delle versioni precedenti.
   */
  const allegaFile = async (movimento) => {
    if (!isTauri()) {
      showToast("Solo versione Desktop.");
      return;
    }
    try {
      const { open } = window.__TAURI__.dialog;
      const { copyFile, createDir } = window.__TAURI__.fs;
      const { join, basename } = window.__TAURI__.path;

      const selezionati = await open({ multiple: true });
      if (!selezionati) return; // utente ha annullato la selezione
      const percorsi = Array.isArray(selezionati) ? selezionati : [selezionati];
      if (percorsi.length === 0) return;

      const annoRecord = movimento.data.substring(0, 4);
      const cartellaAnno = await join(config.percorsoSalvataggio, currentUser, 'backup', annoRecord);
      await createDir(cartellaAnno, { recursive: true });

      const nuoviNomiFile = [];
      for (const sourcePath of percorsi) {
        const nomeFile = await basename(sourcePath);
        await copyFile(sourcePath, await join(cartellaAnno, nomeFile));
        nuoviNomiFile.push(nomeFile);
      }

      const allegatiEsistenti = movimento.allegati || (movimento.allegato ? [movimento.allegato] : []);
      const allegati = Array.from(new Set([...allegatiEsistenti, ...nuoviNomiFile]));
      updateSpesa(movimento.id, { allegati });
      showToast(nuoviNomiFile.length > 1 ? `${nuoviNomiFile.length} file allegati!` : "File allegato!");
    } catch {
      showToast("Errore durante l'allegato del file.");
    }
  };

  // --- CATTURA DOCUMENTI (cartella sincronizzata, es. iCloud Drive/Google Drive) ---
  /** Nomi dei file trovati in percorsoCattura non ancora collegati a un record (vedi Importa.jsx). */
  const [fileDaImportare, setFileDaImportare] = useState([]);

  /**
   * Rilegge percorsoCattura e aggiorna fileDaImportare, escludendo i file già segnati come
   * "gestiti" (config.fileCatturaGestiti) e i file nascosti (es. .DS_Store). Non distingue
   * sottocartelle da file (la cartella di cattura è pensata per uso semplice, foto/scansioni
   * salvate direttamente dentro, non per struttura annidata).
   */
  const scansionaCartellaCattura = async (configAttuale = config) => {
    if (!isTauri() || !configAttuale.percorsoCattura) {
      setFileDaImportare([]);
      return;
    }
    try {
      const { readDir } = window.__TAURI__.fs;
      const entries = await readDir(configAttuale.percorsoCattura);
      const gestiti = new Set(configAttuale.fileCatturaGestiti || []);
      const nomiFile = entries
        .map(e => e.name)
        .filter(nome => nome && !nome.startsWith('.') && !gestiti.has(nome));
      setFileDaImportare(nomiFile);
    } catch {
      setFileDaImportare([]);
    }
  };

  // Rileggi la cartella di cattura appena il percorso è disponibile (login/caricamento config)
  // o cambia nelle Impostazioni, cosi' il badge in Sidebar resta aggiornato senza azioni manuali.
  // Dipende solo da percorsoCattura (non da tutto "config"): altrimenti scansionerebbe la
  // cartella ad ogni singola modifica di configurazione, anche quelle che non c'entrano nulla.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (currentUser) scansionaCartellaCattura(config);
  }, [currentUser, config.percorsoCattura]);
  /* eslint-enable react-hooks/exhaustive-deps */
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Segna un file della cartella di cattura come "gestito", cosi' sparisce dalla lista senza toccare l'originale. */
  const segnaFileCatturaGestito = (nomeFile) => {
    setConfig(prev => ({ ...prev, fileCatturaGestiti: [...(prev.fileCatturaGestiti || []), nomeFile] }));
    setFileDaImportare(prev => prev.filter(n => n !== nomeFile));
  };

  /** Collega un file già presente nella cartella di cattura a un record esistente (stesso schema di copia di allegaFile, ma la sorgente è percorsoCattura invece del selettore file). */
  const allegaFileCatturaEsistente = async (nomeFile, movimento) => {
    if (!isTauri()) { showToast("Solo versione Desktop."); return; }
    try {
      const { copyFile, createDir } = window.__TAURI__.fs;
      const { join } = window.__TAURI__.path;

      const annoRecord = movimento.data.substring(0, 4);
      const cartellaAnno = await join(config.percorsoSalvataggio, currentUser, 'backup', annoRecord);
      await createDir(cartellaAnno, { recursive: true });
      await copyFile(await join(config.percorsoCattura, nomeFile), await join(cartellaAnno, nomeFile));

      const allegatiEsistenti = movimento.allegati || (movimento.allegato ? [movimento.allegato] : []);
      const allegati = Array.from(new Set([...allegatiEsistenti, nomeFile]));
      updateSpesa(movimento.id, { allegati });
      segnaFileCatturaGestito(nomeFile);
      showToast("File collegato al record!");
    } catch {
      showToast("Errore durante il collegamento del file.");
    }
  };

  /** Crea un nuovo record a partire da un file della cartella di cattura: copia il file in <utente>/backup/<anno>/ e aggiunge il movimento con quel file già allegato. */
  const creaRecordDaCattura = async (nomeFile, anno, campi) => {
    if (!isTauri()) { showToast("Solo versione Desktop."); return; }
    try {
      const { copyFile, createDir } = window.__TAURI__.fs;
      const { join } = window.__TAURI__.path;

      const cartellaAnno = await join(config.percorsoSalvataggio, currentUser, 'backup', anno);
      await createDir(cartellaAnno, { recursive: true });
      await copyFile(await join(config.percorsoCattura, nomeFile), await join(cartellaAnno, nomeFile));

      if (!config.anniAttivi.includes(anno)) {
        setConfig(prev => ({ ...prev, anniAttivi: [...(prev.anniAttivi || []), anno] }));
      }
      const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now() + Math.random();
      setSpese(prev => [...prev, { ...campi, id, importo: Number(campi.importo), allegati: [nomeFile] }]);
      segnaFileCatturaGestito(nomeFile);
      showToast("Nuovo record creato dal file!");
    } catch {
      showToast("Errore durante la creazione del record.");
    }
  };

  /**
   * Crea un record "scontrino" a partire da un file della cartella di cattura: una voce madre
   * con l'importo totale (a cui resta allegato il file) e una sottovoce per ciascuna riga
   * confermata dall'utente, taggata con la sua macro-categoria (vedi interpretaScontrino.js).
   * Le sottovoci non toccano mai il saldo da sole (stesso meccanismo di registraSottovoce in
   * Dashboard.jsx, contenitoreId): solo la voce madre viene sottratta, le sottovoci servono a
   * mostrare la ripartizione per categoria nella vista ANALISI. Le categorie non ancora presenti
   * in config.tags vengono aggiunte automaticamente (tipo "uscita"), cosi' la funzione resta
   * utilizzabile "a freddo" senza dover prima configurare i tag a mano nelle Impostazioni.
   */
  const creaRecordScontrino = async (nomeFile, anno, { data, nota, righe }) => {
    if (!isTauri()) { showToast("Solo versione Desktop."); return; }
    if (!righe || righe.length === 0) return showToast("Nessuna riga da registrare.");
    try {
      const { copyFile, createDir } = window.__TAURI__.fs;
      const { join } = window.__TAURI__.path;

      const cartellaAnno = await join(config.percorsoSalvataggio, currentUser, 'backup', anno);
      await createDir(cartellaAnno, { recursive: true });
      await copyFile(await join(config.percorsoCattura, nomeFile), await join(cartellaAnno, nomeFile));

      const categorieUsate = Array.from(new Set(righe.map(r => r.categoria).filter(Boolean)));
      setConfig(prev => {
        const nuoviAnni = prev.anniAttivi.includes(anno) ? prev.anniAttivi : [...prev.anniAttivi, anno];
        const tagEsistenti = new Set((prev.tags || []).map(t => t.nome));
        const nuoviTag = ['spesa', ...categorieUsate].filter(n => !tagEsistenti.has(n)).map(n => ({ nome: n, tipo: 'uscita' }));
        return { ...prev, anniAttivi: nuoviAnni, tags: nuoviTag.length > 0 ? [...prev.tags, ...nuoviTag] : prev.tags };
      });

      const nuovoId = () => (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now() + Math.random();
      const idMadre = nuovoId();
      const totale = righe.reduce((somma, r) => somma + Number(r.importo), 0);
      const madre = { id: idMadre, data, nota, importo: totale, tags: ['spesa'], allegati: [nomeFile] };
      const sottovoci = righe.map(r => ({
        id: nuovoId(), data, nota: r.descrizione, importo: Number(r.importo),
        tags: [r.categoria || 'spesa'], contenitoreId: idMadre,
      }));
      setSpese(prev => [...prev, madre, ...sottovoci]);
      segnaFileCatturaGestito(nomeFile);
      showToast(`Scontrino registrato: ${righe.length} voci create.`);
    } catch {
      showToast("Errore durante la creazione del record.");
    }
  };

  // --- ESTRAZIONE AUTOMATICA DATI (OCR offline, vedi src/ocr/) ---
  /**
   * Legge un file ancora nella cartella di cattura (non ancora copiato in backup/): serve per
   * poterlo analizzare con l'OCR PRIMA di decidere se/come creare il record, senza doverlo
   * prima allegare "alla cieca".
   */
  const leggiFileCattura = async (nomeFile) => {
    if (!isTauri()) { showToast("Solo versione Desktop."); return null; }
    try {
      const { readBinaryFile } = window.__TAURI__.fs;
      const { join } = window.__TAURI__.path;
      return await readBinaryFile(await join(config.percorsoCattura, nomeFile));
    } catch {
      showToast("Impossibile leggere il file per l'estrazione.");
      return null;
    }
  };

  /**
   * Estrae il testo grezzo OCR da un file (immagine, oppure PDF rasterizzato pagina per pagina
   * e concatenato: l'OCR sa leggere solo immagini, e il dato cercato non è sempre nella prima
   * pagina). Condiviso da estraiDatiOcr e estraiScontrino, che poi interpretano quel testo
   * ciascuno a modo proprio (un singolo importo/scadenza vs tante righe prodotto).
   */
  const estraiTestoDocumento = async (bytes, mimeType) => {
    const { estraiTestoDaImmagine } = await import('./ocr/motoreOcr');
    if (mimeType === 'application/pdf') {
      const { rasterizzaPaginePdf } = await import('./ocr/rasterizzaPdf');
      const immaginiPagine = await rasterizzaPaginePdf(bytes);
      const testiPagine = [];
      for (const immagine of immaginiPagine) {
        testiPagine.push(await estraiTestoDaImmagine(immagine, 'image/png'));
      }
      return testiPagine.join('\n');
    }
    return estraiTestoDaImmagine(bytes, mimeType);
  };

  /**
   * Esegue l'OCR su un file (byte) e propone i candidati per importo/data, dando priorità alle
   * parole chiave "imparate" per un fornitore specifico (se indicato) prima di quelle globali di
   * config.ocr. Nessun candidato viene applicato automaticamente: la scelta finale resta sempre
   * all'utente in Importa.jsx.
   */
  const estraiDatiOcr = async (bytes, mimeType, fornitore) => {
    const testo = await estraiTestoDocumento(bytes, mimeType);
    const { trovaImporti, trovaDate } = await import('./ocr/interpretaBolletta');
    const chiaveFornitore = (fornitore || '').trim().toLowerCase();
    const modello = chiaveFornitore ? config.ocr?.modelliFornitore?.[chiaveFornitore] : null;
    const paroleImporto = [...(modello?.paroleChiaveImporto || []), ...(config.ocr?.paroleChiaveImporto || [])];
    const paroleData = [...(modello?.paroleChiaveData || []), ...(config.ocr?.paroleChiaveData || [])];
    return {
      testo,
      candidatiImporto: trovaImporti(testo, paroleImporto),
      candidatiData: trovaDate(testo, paroleData),
    };
  };

  /**
   * Come estraiDatiOcr, ma per uno scontrino: qui il problema non è "un solo importo/scadenza
   * nel documento" ma "tante righe prodotto da isolare e classificare per macro-categoria" (vedi
   * src/ocr/interpretaScontrino.js). Restituisce anche il testo grezzo, per coerenza con
   * estraiDatiOcr anche se Importa.jsx non lo usa direttamente.
   */
  const estraiScontrino = async (bytes, mimeType) => {
    const testo = await estraiTestoDocumento(bytes, mimeType);
    return { testo, ...interpretaScontrino(testo, CATEGORIE_DEFAULT) };
  };

  /**
   * Quando l'utente conferma manualmente un candidato OCR per un fornitore, ricava dal suo
   * contesto una parola chiave e la antepone alla lista di quel fornitore (vedi ocr.modelliFornitore
   * in constants.js): le estrazioni successive per lo stesso fornitore la useranno per prima.
   */
  const impareOcrFornitore = async (fornitore, tipo, candidato) => {
    const chiaveFornitore = (fornitore || '').trim().toLowerCase();
    const { estraiParolaChiaveDaContesto } = await import('./ocr/interpretaBolletta');
    const parolaChiave = estraiParolaChiaveDaContesto(candidato.contesto, candidato.testoOriginale);
    if (!chiaveFornitore || !parolaChiave) return;
    setConfig(prev => {
      const modelloAttuale = prev.ocr?.modelliFornitore?.[chiaveFornitore] || { paroleChiaveImporto: [], paroleChiaveData: [] };
      const listaAttuale = modelloAttuale[tipo] || [];
      const nuovaLista = [parolaChiave, ...listaAttuale.filter(p => p !== parolaChiave)];
      return {
        ...prev,
        ocr: {
          ...prev.ocr,
          modelliFornitore: { ...prev.ocr?.modelliFornitore, [chiaveFornitore]: { ...modelloAttuale, [tipo]: nuovaLista } },
        },
      };
    });
  };

  /** File attualmente mostrato nella finestra di anteprima ({ nome, dataUri, tipo }), o null se chiusa. */
  const [anteprima, setAnteprima] = useState(null);

  /**
   * Legge un allegato già copiato in percorsoSalvataggio/<utente>/backup/<anno>/ e lo prepara per
   * AnteprimaModal: lo converte in una data URI (base64) cosi' la webview lo puo' mostrare
   * direttamente in un <img>/<iframe>, senza aprire un'app esterna.
   */
  const apriAnteprima = async (movimento, nomeFile) => {
    if (!isTauri()) {
      showToast("Solo versione Desktop.");
      return;
    }
    try {
      const { readBinaryFile } = window.__TAURI__.fs;
      const { join } = window.__TAURI__.path;
      const annoRecord = movimento.data.substring(0, 4);
      const percorso = await join(config.percorsoSalvataggio, currentUser, 'backup', annoRecord, nomeFile);
      const bytes = await readBinaryFile(percorso);
      const tipo = mimeTypeDaNomeFile(nomeFile);
      setAnteprima({ nome: nomeFile, dataUri: `data:${tipo};base64,${bytesToBase64(bytes)}`, tipo });
    } catch {
      showToast("Impossibile aprire l'anteprima: il file potrebbe essere stato spostato.");
    }
  };

  // Stili condivisi (l'app non usa CSS Modules/Tailwind: gli stili sono oggetti JS passati
  // via prop "styles" a tutti i componenti figli, cosi' l'aspetto resta coerente in tutta l'app).
  // Oltre alle chiavi "storiche" (card/input/label/btn/th), espone anche dei token di colore
  // semantici (bg/bgSottile/border/borderForte/testo) usati dai componenti al posto di hex
  // fissi, cosi' la modalità chiara/scura (config.temaScuro) si applica ovunque cambiando solo
  // questo oggetto, senza if sparsi in ogni componente.
  const s = useMemo(() => {
    const scuro = config.temaScuro;
    const cardBg = scuro ? '#262626' : '#ffffff';
    const testo = scuro ? '#fafafa' : '#171717';
    const border = scuro ? '#404040' : '#e5e5e5';
    return {
      scuro,
      bg: scuro ? '#171717' : '#fafafa',
      bgSottile: scuro ? '#1f1f1f' : '#fafafa', // pannelli secondari, aree tratteggiate, hover leggero
      bgSottile2: scuro ? '#262626' : '#f5f5f5', // un filo piu' presente (chip non selezionati, intestazioni tabella)
      border,
      borderForte: scuro ? '#525252' : '#d4d4d4',
      testo,
      testoMuto: '#737373', // grigio medio, gia' leggibile sia su sfondo chiaro che scuro
      card: { background: cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${border}`, marginBottom: '20px' },
      input: { padding: '12px 16px', borderRadius: '10px', border: `1px solid ${scuro ? '#525252' : '#d4d4d4'}`, background: scuro ? '#171717' : '#ffffff', color: scuro ? '#fafafa' : '#171717', width: '100%', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
      label: { fontSize: '11px', fontWeight: '700', color: '#a3a3a3', marginBottom: '6px', display: 'block' },
      // Sfondo = superficie su cui il bottone poggia (non piu' un riempimento pieno col colore
      // passato): "bg" resta il nome del parametro per non toccare i 20+ punti di chiamata
      // esistenti, ma ora serve solo per il bordo/testo in hover (--btn-accento, vedi index.css
      // e la classe "arkiv-btn" applicata da ogni chiamante). Nessun bottone (nemmeno quelli
      // "primari" come Accedi) ha un trattamento diverso: uniformità totale, per scelta esplicita.
      // fontSize esplicito: i browser danno ai <button> una dimensione di default (13.3333px) che
      // NON viene ereditata dal contesto, a differenza di <label>/<div> (usati altrove per bottoni
      // "a scheda" come Importa in Impostazioni, vedi Settings.jsx): senza fissarla qui, un bottone
      // fatto con <label> risulta visibilmente più grande di uno fatto con <button> a parità di
      // padding, perché eredita invece la dimensione ambiente (di solito 16px, il default del body).
      btn: (bg) => ({ padding: '12px 16px', background: cardBg, color: testo, border: `1px solid ${border}`, borderRadius: '10px', fontSize: '13.3333px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', '--btn-accento': bg }),
      th: (w, align='left') => ({ width: w, textAlign: align, padding: '15px 20px', color: '#a3a3a3', fontSize: '11px', fontWeight: '700', borderBottom: `2px solid ${scuro ? '#404040' : '#f5f5f5'}` }),
    };
  }, [config.temaScuro]);

  // Il body non passa da React (index.css lo imposta staticamente per il primo render): appena
  // sappiamo se la modalità è chiara o scura lo aggiorniamo qui, cosi' anche gli elementi che non
  // impostano un colore esplicito (ereditano da body, es. la maggior parte di h2/h3/span dell'app)
  // seguono automaticamente il tema senza doverli toccare uno per uno.
  useEffect(() => {
    // html (non solo body) va aggiornato anche lui: body ha height:100% fisso in index.css, quindi
    // su una pagina più alta di un viewport l'area che eccede mostrerebbe lo sfondo di html se
    // restasse quello statico di index.css, creando una fascia visibilmente "sbagliata" in fondo.
    document.documentElement.style.backgroundColor = s.bg;
    document.body.style.backgroundColor = s.bg;
    document.body.style.color = s.testo;
  }, [s.bg, s.testo]);

  /** Variante scura del colore tema, per le superfici sempre scure (barra laterale, login): cosi' seguono la personalizzazione dell'utente invece di restare un grigio fisso scollegato. */
  const coloreScuro = useMemo(() => scuraColore(config.coloreTema, 0.85), [config.coloreTema]);

  // Senza utente loggato: solo la schermata di login, a schermo intero.
  // Con utente loggato: layout con Sidebar fissa + area principale, dove viene mostrata
  // UNA sola vista alla volta in base ad activeTab (Ricerca / Impostazioni / Dashboard di un anno).
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: s.bg, fontFamily: 'Inter, sans-serif', position: 'relative' }}>
      {!currentUser ? (
        <LoginView onLogin={setCurrentUser} themeColor={config.coloreTema} coloreScuro={coloreScuro} styles={s} />
      ) : (
        <>
          {/* Overlay scuro dietro al menu mobile aperto: cliccandolo si chiude */}
          {isMobile && isMenuOpen && <div onClick={() => setIsMenuOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 90, backdropFilter: 'blur(2px)' }} />}

          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} anni={listaAnni} onAddAnno={aggiungiAnno} onRemoveAnno={rimuoviAnno} onLogout={() => setCurrentUser(null)} currentUser={currentUser} coloreScuro={coloreScuro} chiaro={!config.temaScuro} isMobile={isMobile} isOpen={isMenuOpen} setIsOpen={setIsMenuOpen} conteggioDaImportare={fileDaImportare.length} />

          <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '20px' : '30px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                <button onClick={() => setIsMenuOpen(true)} style={{ background: s.card.background, border: `1px solid ${s.border}`, cursor: 'pointer', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                  <Menu size={24} color={s.testo} />
                </button>
                <h1 style={{ fontSize: '18px', fontWeight: '900', color: s.testo, margin: 0 }}>Arkiv</h1>
              </div>
            )}

            {/* Card sempre visibile in cima, qualunque sia la vista attiva sotto */}
            <div style={{ ...s.card, background: `linear-gradient(135deg, ${config.coloreTema}, ${coloreScuro})`, border: 'none', color: '#fff' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', opacity: 0.8 }}>LIQUIDITÀ ATTUALE</span>
              <h2 style={{ fontSize: '42px', fontWeight: '900', margin: '10px 0' }}>€ {saldoAttuale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</h2>
            </div>

            {activeTab === 'ricerca' && (
              <SearchView
                searchTerm={searchTerm} setSearchTerm={setSearchTerm} speseFiltrate={speseFiltrateRicerca} config={config} styles={s}
                onUpdateSpesa={updateSpesa} onApriAnteprima={apriAnteprima} showToast={showToast} // topTags/currentUser rimossi, non più utilizzati in Search.jsx
              />
            )}

            {activeTab === 'importa' && (
              <ImportaView
                fileDaImportare={fileDaImportare} percorsoCattura={config.percorsoCattura} spese={spese} config={config} styles={s} isMobile={isMobile}
                onRiscansiona={() => scansionaCartellaCattura(config)}
                onAllegaEsistente={allegaFileCatturaEsistente}
                onCreaRecord={creaRecordDaCattura}
                onCreaRecordScontrino={creaRecordScontrino}
                onIgnoraFile={segnaFileCatturaGestito}
                onLeggiFileCattura={leggiFileCattura}
                onEstraiDatiOcr={estraiDatiOcr}
                onEstraiScontrino={estraiScontrino}
                onImparaOcrFornitore={impareOcrFornitore}
                categorieScontrino={config.categorieSpesa}
                showToast={showToast}
              />
            )}

            {activeTab === 'impostazioni' && (
              <SettingsView
                config={config} spese={spese} setConfig={setConfig} user={{ username: currentUser }}
                updateProfile={handleUpdateProfile} importaJSON={importaJSON} onSelezionaCartellaCattura={selezionaCartellaCattura}
                onSelezionaCartellaBackupCloud={selezionaCartellaBackupCloud} onEseguiBackup={eseguiBackup} styles={s} isMobile={isMobile}
                newUsername={newUsername} setNewUsername={setNewUsername} newPassword={newPassword} setNewPassword={setNewPassword} showToast={showToast}
              />
            )}

            {/* activeTab è un anno (es. "2026"): apre il registro di quell'anno.
                key={activeTab} forza il rimontaggio di DashboardView al cambio anno, cosi'
                tutto il suo stato interno (form, filtri grafico...) riparte pulito. */}
            {/^\d{4}$/.test(activeTab) && (
              <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#737373' }}>Caricamento registro...</div>}>
                <DashboardView
                  key={activeTab}
                  anno={activeTab} speseAnno={movimentiAnno} config={config} styles={s} colors={chartColors} topTags={topTags} showToast={showToast} isMobile={isMobile}
                  datiGrafici={{ patrimonio: datiPatrimonioMese, torta: datiTorta }}
                  onAddSpesa={(newMov) => {
                    const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now() + Math.random();
                    setSpese(prev => [...prev, { ...newMov, id, importo: Number(newMov.importo) }]);
                    showToast("Movimento registrato!");
                  }}
                  onUpdateSpesa={updateSpesa}
                  onRemoveSpesa={handleRemoveSpesaWithUndo}
                  onAllegaFile={allegaFile}
                  onApriAnteprima={apriAnteprima}
                />
              </Suspense>
            )}
          </main>
        </>
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <Modal {...modal} themeColor={config.coloreTema} styles={s} setInputValue={(val) => setModal(prev => ({...prev, inputValue: val}))} onCancel={() => setModal(prev => ({...prev, show: false}))} />
      <AnteprimaModal file={anteprima} onClose={() => setAnteprima(null)} styles={s} />
    </div>
  );
}