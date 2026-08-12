/**
 * FinanceLab - Componente Root (v0.1.29)
 * Gestisce l'autenticazione, la persistenza dei dati e la navigazione principale.
*/

import React, { useState, useEffect, useMemo } from 'react';
import * as Lucide from 'lucide-react';
import Sidebar from './components/Sidebar';
import { Toast, Modal } from './components/UI';
import LoginView from './components/Login';
import SearchView from './components/Search';
import SettingsView from './components/Settings';
import DashboardView from './components/Dashboard';
import { useFinance } from './useFinance';
import { INITIAL_CONFIG, COLORS } from './constants';
import { parseImportedData } from './importUtils';

export default function App() {
  // --- STATO DELL'APPLICAZIONE ---
  /** 
   * Utente correntemente loggato. Se null, mostra la LoginView.
   * @type {string|null} 
   */
  const [currentUser, setCurrentUser] = useState(null);
  
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState({ show: false, type: 'confirm', title: '', msg: '', onConfirm: null, inputValue: '' });
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [activeTab, setActiveTab] = useState('impostazioni');
  const [viewMode, setViewMode] = useState('dati');
  const [searchTerm, setSearchTerm] = useState('');

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 1024;

  /** Inizializza la configurazione e i dati caricandoli dal localStorage per l'utente specifico */
  const [config, setConfig] = useState(() => {
    return INITIAL_CONFIG; // Default to initial config
  });
  const [spese, setSpese] = useState([]);

  // Caricamento dati specifico per utente al login
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

  // --- PERSISTENZA DATI ---
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

  const isTauri = () => typeof window !== 'undefined' && !!window.__TAURI__; // Moved here as it's used in backupCartella

  // --- HOOK FINANZA (LOGICA ESTRATTA) ---
  const {
    listaAnni, movimentiAnno, saldoAttuale, speseFiltrateRicerca, topTags,
    datiPatrimonioMese, datiTorta
  } = useFinance(spese, config, activeTab, searchTerm);

  const chartColors = useMemo(() => [config.coloreTema, ...COLORS.slice(1)], [config.coloreTema]);

  // --- GESTORI EVENTI ---
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

  const importaJSON = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { config: cfg, spese: speseMigrate } = parseImportedData(ev.target.result);
        if (cfg) setConfig(cfg);
        if (speseMigrate) setSpese(speseMigrate);
        showToast("Dati importati!");
      } catch (err) { showToast("File corrotto."); }
    };
    reader.readAsText(e.target.files[0]);
  };

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
    } catch (e) { 
      showToast("Errore permessi backup.");
    }
  };

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

  const s = useMemo(() => ({
    card: { background: '#ffffff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0', marginBottom: '20px' },
    input: { padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', width: '100%', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
    label: { fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', display: 'block' },
    btn: (bg) => ({ padding: '12px 16px', background: bg, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }),
    th: (w, align='left') => ({ width: w, textAlign: align, padding: '15px 20px', color: '#64748b', fontSize: '11px', fontWeight: '800', borderBottom: '2px solid #f1f5f9' }),
  }), []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif', position: 'relative' }}>      
      {!currentUser ? (
        <LoginView onLogin={setCurrentUser} themeColor={config.coloreTema} styles={s} />
      ) : (
        <>
          {isMobile && isMenuOpen && <div onClick={() => setIsMenuOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 90, backdropFilter: 'blur(2px)' }} />}

          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} anni={listaAnni} onAddAnno={aggiungiAnno} onRemoveAnno={rimuoviAnno} onLogout={() => setCurrentUser(null)} currentUser={currentUser} themeColor={config.coloreTema} isMobile={isMobile} isOpen={isMenuOpen} setIsOpen={setIsMenuOpen} />

          <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '20px' : '30px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                <button onClick={() => setIsMenuOpen(true)} style={{ background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '10px', borderRadius: '12px', display: 'flex' }}> 
                  <Lucide.Menu size={24} color="#1e293b" />
                </button>
                <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b', margin: 0 }}>FinanceLab</h1>
              </div>
            )}

            <div style={{ ...s.card, background: `linear-gradient(135deg, ${config.coloreTema}, #1e1b4b)`, border: 'none', color: '#fff' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', opacity: 0.8 }}>LIQUIDITÀ ATTUALE</span>
              <h2 style={{ fontSize: '42px', fontWeight: '900', margin: '10px 0' }}>€ {saldoAttuale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</h2>
            </div>

            {activeTab === 'ricerca' && (
              <SearchView 
                searchTerm={searchTerm} setSearchTerm={setSearchTerm} speseFiltrate={speseFiltrateRicerca} config={config} styles={s} currentUser={currentUser} 
                onUpdateSpesa={(id, updated) => setSpese(prev => prev.map(s => String(s.id) === String(id) ? { ...s, ...updated } : s))} showToast={showToast} // topTags rimosso, non più utilizzato in Search.jsx
              />
            )}
            
            {activeTab === 'impostazioni' && (
              <SettingsView
                config={config} setConfig={setConfig} user={{ username: currentUser }}
                updateProfile={handleUpdateProfile} importaJSON={importaJSON} backupCartella={backupCartella} styles={s}
                newUsername={newUsername} setNewUsername={setNewUsername} newPassword={newPassword} setNewPassword={setNewPassword}
              />
            )}

            {/^\d{4}$/.test(activeTab) && (
              <DashboardView
                anno={activeTab} speseAnno={movimentiAnno} config={config} styles={s} colors={chartColors} currentUser={currentUser} topTags={topTags} showToast={showToast}
                datiGrafici={{ patrimonio: datiPatrimonioMese, torta: datiTorta }}
                onAddSpesa={(newMov) => {
                  const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now() + Math.random();
                  setSpese(prev => [...prev, { ...newMov, id, importo: Number(newMov.importo) }]);
                  showToast("Movimento registrato!");
                }}
                onUpdateSpesa={(id, updated) => setSpese(prev => prev.map(s => String(s.id) === String(id) ? { ...s, ...updated } : s))}
                onRemoveSpesa={handleRemoveSpesaWithUndo}
              />
            )}
          </main>
        </>
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <Modal {...modal} themeColor={config.coloreTema} setInputValue={(val) => setModal(prev => ({...prev, inputValue: val}))} onCancel={() => setModal(prev => ({...prev, show: false}))} />
    </div>
  );
}