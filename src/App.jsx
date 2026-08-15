/**
 * FinanceLab - Componente Root (v0.1.29)
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

import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
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
      setConfig(currentConfig);

      if (savedData) {
        let parsedSpese = JSON.parse(savedData);
        // MIGRAZIONE: Converte il campo 'categoria' (stringa) nel nuovo array 'tags'
        parsedSpese = parsedSpese.map(s => {
          if (s.categoria && (!s.tags || s.tags.length === 0)) {
            return { ...s, tags: [s.categoria], categoria: undefined };
          }
          return s;
        });
        setSpese(parsedSpese);
      } else setSpese([]);

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

  /** Crea una sottocartella di backup vuota (Root/Utente/Anno/backup_<timestamp>) tramite le API filesystem di Tauri. Funziona solo nella versione desktop. */
  const backupCartella = async () => {
    if (!isTauri()) {
      showToast("Solo versione Desktop.");
      return;
    }
    try {
      // Uso API globale (withGlobalTauri: true) per evitare errori di import
      const { createDir } = window.__TAURI__.fs;
      const { join } = window.__TAURI__.path;
      const ts = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
      // Struttura: Root / Utente / Anno / backup_ts
      const annoRif = /^\d{4}$/.test(activeTab) ? activeTab : new Date().getFullYear().toString();
      const fullPath = await join(config.percorsoSalvataggio, currentUser, annoRif, `backup_${ts}`);
      await createDir(fullPath, { recursive: true });
      showToast("Backup completato!");
    } catch {
      showToast("Errore permessi backup.");
    }
  };

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
   * percorsoSalvataggio/backup/<anno del movimento>/, e aggiunge i nomi dei file all'elenco
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
      const cartellaAnno = await join(config.percorsoSalvataggio, 'backup', annoRecord);
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
      const cartellaAnno = await join(config.percorsoSalvataggio, 'backup', annoRecord);
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

  /** Crea un nuovo record a partire da un file della cartella di cattura: copia il file in backup/<anno>/ e aggiunge il movimento con quel file già allegato. */
  const creaRecordDaCattura = async (nomeFile, anno, campi) => {
    if (!isTauri()) { showToast("Solo versione Desktop."); return; }
    try {
      const { copyFile, createDir } = window.__TAURI__.fs;
      const { join } = window.__TAURI__.path;

      const cartellaAnno = await join(config.percorsoSalvataggio, 'backup', anno);
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

  /** File attualmente mostrato nella finestra di anteprima ({ nome, dataUri, tipo }), o null se chiusa. */
  const [anteprima, setAnteprima] = useState(null);

  /**
   * Legge un allegato già copiato in percorsoSalvataggio/backup/<anno>/ e lo prepara per
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
      const percorso = await join(config.percorsoSalvataggio, 'backup', annoRecord, nomeFile);
      const bytes = await readBinaryFile(percorso);
      const tipo = mimeTypeDaNomeFile(nomeFile);
      setAnteprima({ nome: nomeFile, dataUri: `data:${tipo};base64,${bytesToBase64(bytes)}`, tipo });
    } catch {
      showToast("Impossibile aprire l'anteprima: il file potrebbe essere stato spostato.");
    }
  };

  // Stili condivisi (l'app non usa CSS Modules/Tailwind: gli stili sono oggetti JS passati
  // via prop "styles" a tutti i componenti figli, cosi' l'aspetto resta coerente in tutta l'app).
  const s = useMemo(() => ({
    card: { background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', marginBottom: '20px' },
    input: { padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', width: '100%', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
    label: { fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', display: 'block' },
    btn: (bg) => ({ padding: '12px 16px', background: bg, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }),
    th: (w, align='left') => ({ width: w, textAlign: align, padding: '15px 20px', color: '#64748b', fontSize: '11px', fontWeight: '800', borderBottom: '2px solid #f1f5f9' }),
  }), []);

  // Senza utente loggato: solo la schermata di login, a schermo intero.
  // Con utente loggato: layout con Sidebar fissa + area principale, dove viene mostrata
  // UNA sola vista alla volta in base ad activeTab (Ricerca / Impostazioni / Dashboard di un anno).
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif', position: 'relative' }}>
      {!currentUser ? (
        <LoginView onLogin={setCurrentUser} themeColor={config.coloreTema} styles={s} />
      ) : (
        <>
          {/* Overlay scuro dietro al menu mobile aperto: cliccandolo si chiude */}
          {isMobile && isMenuOpen && <div onClick={() => setIsMenuOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 90, backdropFilter: 'blur(2px)' }} />}

          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} anni={listaAnni} onAddAnno={aggiungiAnno} onRemoveAnno={rimuoviAnno} onLogout={() => setCurrentUser(null)} currentUser={currentUser} themeColor={config.coloreTema} isMobile={isMobile} isOpen={isMenuOpen} setIsOpen={setIsMenuOpen} conteggioDaImportare={fileDaImportare.length} />

          <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '20px' : '30px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                <button onClick={() => setIsMenuOpen(true)} style={{ background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '10px', borderRadius: '12px', display: 'flex' }}> 
                  <Menu size={24} color="#1e293b" />
                </button>
                <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b', margin: 0 }}>FinanceLab</h1>
              </div>
            )}

            {/* Card sempre visibile in cima, qualunque sia la vista attiva sotto */}
            <div style={{ ...s.card, background: `linear-gradient(135deg, ${config.coloreTema}, #1e1b4b)`, border: 'none', color: '#fff' }}>
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
                onIgnoraFile={segnaFileCatturaGestito}
                showToast={showToast}
              />
            )}

            {activeTab === 'impostazioni' && (
              <SettingsView
                config={config} spese={spese} setConfig={setConfig} user={{ username: currentUser }}
                updateProfile={handleUpdateProfile} importaJSON={importaJSON} backupCartella={backupCartella} onSelezionaCartellaCattura={selezionaCartellaCattura} styles={s} isMobile={isMobile}
                newUsername={newUsername} setNewUsername={setNewUsername} newPassword={newPassword} setNewPassword={setNewPassword}
              />
            )}

            {/* activeTab è un anno (es. "2026"): apre il registro di quell'anno.
                key={activeTab} forza il rimontaggio di DashboardView al cambio anno, cosi'
                tutto il suo stato interno (form, filtri grafico...) riparte pulito. */}
            {/^\d{4}$/.test(activeTab) && (
              <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Caricamento registro...</div>}>
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
      <Modal {...modal} themeColor={config.coloreTema} setInputValue={(val) => setModal(prev => ({...prev, inputValue: val}))} onCancel={() => setModal(prev => ({...prev, show: false}))} />
      <AnteprimaModal file={anteprima} onClose={() => setAnteprima(null)} />
    </div>
  );
}