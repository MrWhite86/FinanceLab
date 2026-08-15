import { useState } from 'react';
import { CloudUpload, Download, FolderSync, HardDriveDownload, Lock, Save, ScanText, Trash2, Unlock, Upload, X } from 'lucide-react';

/**
 * SettingsView: sezioni indipendenti, tutte agiscono sull'oggetto "config" passato da
 * App.jsx (che lo salva in localStorage ad ogni modifica, vedi App.jsx):
 * 1. Parametri Base - saldo/data di partenza per il calcolo del saldo, colore tema.
 * 2. Percorso di Lavoro - cartella principale (solo admin puo' cambiarla) + import/export manuale.
 * 3. Cartella di Cattura - vedi Importa.jsx.
 * 4. Backup Locale / Backup Cloud - backup automatico periodico (frequenza + rotazione
 *    indipendenti per le due destinazioni, vedi eseguiBackup in App.jsx).
 * 5. Estrazione Automatica (OCR) - parole chiave usate da src/ocr/interpretaBolletta.js per
 *    riconoscere importo/scadenza nei documenti (vedi anche onEstraiDatiOcr in App.jsx).
 * 6. Gestione Profilo - cambio username/password (la vera logica è in App.jsx: handleUpdateProfile).
 * 7. Gestione Tag - crea/elimina tag e ne cambia il "tipo" (entrata/uscita/neutro), che è
 *    poi ciò che useFinance.js usa per decidere se un movimento aumenta o riduce il saldo.
 */
export default function SettingsView({ config, spese, setConfig, user, updateProfile, importaJSON, onSelezionaCartellaCattura, onSelezionaCartellaBackupCloud, onEseguiBackup, styles, isMobile, newUsername, setNewUsername, newPassword, setNewPassword }) {
  const isAdmin = user.username === 'admin';
  const [nuovoTag, setNuovaTag] = useState('');
  const [nuovaParolaImporto, setNuovaParolaImporto] = useState('');
  const [nuovaParolaData, setNuovaParolaData] = useState('');
  /** Il percorso di backup è di sola lettura finché l'admin non lo sblocca esplicitamente col lucchetto, per evitare modifiche accidentali. */
  const [bloccaPercorso, setBloccaPercorso] = useState(true);

  /** Applica un aggiornamento parziale a backupLocale o backupCloud senza perdere gli altri campi. */
  const aggiornaBackup = (chiave, campi) => setConfig({ ...config, [chiave]: { ...config[chiave], ...campi } });

  const formatUltimoBackup = (iso) => iso ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : 'Mai eseguito';

  /** Aggiunge/rimuove una parola chiave OCR (campo 'paroleChiaveImporto' o 'paroleChiaveData' dentro config.ocr). */
  const aggiungiParolaChiaveOcr = (campo, parola) => {
    if (!parola.trim() || config.ocr[campo].includes(parola.trim().toLowerCase())) return;
    setConfig({ ...config, ocr: { ...config.ocr, [campo]: [...config.ocr[campo], parola.trim().toLowerCase()] } });
  };
  const rimuoviParolaChiaveOcr = (campo, parola) => {
    setConfig({ ...config, ocr: { ...config.ocr, [campo]: config.ocr[campo].filter(p => p !== parola) } });
  };

  /** Click sul pallino colorato di un tag: fa scorrere il suo tipo tra entrata -> uscita -> neutro -> (di nuovo entrata). */
  const toggleTipoCategoria = (nome) => {
    const tipi = ['entrata', 'uscita', 'neutro'];
    const nuoviTags = config.tags.map(c => {
      if (c.nome === nome) {
        const indexAttuale = tipi.indexOf(c.tipo || 'uscita');
        const prossimoIndex = (indexAttuale + 1) % tipi.length;
        return { ...c, tipo: tipi[prossimoIndex] };
      }
      return c;
    });
    setConfig({ ...config, tags: nuoviTags });
  };

  const dotStyle = (tipo) => ({
    width: '28px', height: '28px', borderRadius: '50%', border: 'none', color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '14px',
    background: tipo === 'entrata' ? '#10b981' : tipo === 'uscita' ? '#ef4444' : '#94a3b8'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={styles.card}>
        <h3>Parametri Base</h3>
        {/* Su mobile 3 colonne fisse schiacciano troppo saldo/data/colore: si impila su una colonna */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '15px' }}>
          <div>
            <label style={styles.label}>SALDO INIZIALE (€)</label>
            <input type="number" value={config.saldoStatoZero} onChange={e => setConfig({ ...config, saldoStatoZero: Number(e.target.value) })} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>DATA DI PARTENZA</label>
            <input type="date" value={config.dataStatoZero} onChange={e => setConfig({ ...config, dataStatoZero: e.target.value })} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>COLORE TEMA</label>
            <input type="color" value={config.coloreTema} onChange={e => setConfig({ ...config, coloreTema: e.target.value })} style={{ ...styles.input, padding: '4px', height: '46px', cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3>Percorso di Lavoro</h3>
        <div style={{ marginBottom: '15px' }}>
          <label style={styles.label}>{isAdmin ? "ROOT DI SISTEMA (FinanceLab_main)" : "ARCHIVIO PERSONALE"}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="text" value={isAdmin ? config.percorsoSalvataggio : `${config.percorsoSalvataggio}/${user.username}`} onChange={e => isAdmin && setConfig({ ...config, percorsoSalvataggio: e.target.value })} style={{ ...styles.input, background: (!isAdmin || bloccaPercorso) ? '#f1f5f9' : '#fff', color: (!isAdmin || bloccaPercorso) ? '#94a3b8' : '#000', flex: 1 }} disabled={!isAdmin || bloccaPercorso} />
            {isAdmin && (
              <button onClick={() => setBloccaPercorso(!bloccaPercorso)} style={{background:'transparent', border:'none', cursor:'pointer', color: bloccaPercorso ? '#94a3b8' : config.coloreTema, fontWeight:700}}>
                {bloccaPercorso ? <Lock size={18}/> : <Unlock size={18}/>}
              </button>
            )}
          </div>
        </div>

        <h3>Manutenzione Archivio</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Esporta: genera al volo un file JSON scaricabile con config + tutti i movimenti, nello stesso formato atteso da importaJSON/parseImportedData */}
          <button onClick={() => {const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({config, spese})])); a.download="backup.json"; a.click();}} style={{...styles.btn('#10b981'), flex:1, justifyContent:'center'}}><Download size={18}/> Esporta</button>
          <label style={{...styles.btn('#475569'), cursor:'pointer', flex:1, justifyContent:'center'}}><Upload size={18}/> Importa <input type="file" style={{display:'none'}} onChange={importaJSON}/></label>
        </div>
      </div>

      <div style={styles.card}>
        <h3>Backup Locale</h3>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: 0, marginBottom: '15px' }}>
          Salva periodicamente una copia completa e autosufficiente (archivio + tutti gli allegati) dentro
          &ldquo;{config.percorsoSalvataggio}/{user.username}/backup_completo/&rdquo; — una sottocartella separata per ogni
          profilo, senza mescolare i dati tra utenti. Basta caricare quella cartella su un altro PC per recuperare tutto.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={styles.label}>FREQUENZA</label>
            <select value={config.backupLocale?.frequenza || 'nessuno'} onChange={e => aggiornaBackup('backupLocale', { frequenza: e.target.value })} style={styles.input}>
              <option value="nessuno">Nessuno</option>
              <option value="avvio">Ad ogni avvio</option>
              <option value="giornaliero">Giornaliero</option>
              <option value="modifica">Ad ogni modifica</option>
            </select>
          </div>
          <div>
            <label style={styles.label}>BACKUP DA CONSERVARE</label>
            <select value={config.backupLocale?.numeroBackup || 1} onChange={e => aggiornaBackup('backupLocale', { numeroBackup: Number(e.target.value) })} style={styles.input}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>Ultimo backup: {formatUltimoBackup(config.backupLocale?.ultimoBackup)}</span>
          <button onClick={() => onEseguiBackup('locale')} style={{ ...styles.btn('#f59e0b'), width: 'auto' }}><HardDriveDownload size={18}/> Esegui Backup Ora</button>
        </div>
      </div>

      <div style={styles.card}>
        <h3>Backup Cloud</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', cursor: 'pointer' }} onClick={() => aggiornaBackup('backupCloud', { attivo: !config.backupCloud?.attivo })}>
          <input type="checkbox" checked={!!config.backupCloud?.attivo} onChange={() => {}} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>Mantieni anche una copia su una cartella sincronizzata (iCloud Drive, Google Drive, iDrive...)</span>
        </div>

        {config.backupCloud?.attivo && (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label style={styles.label}>CARTELLA DI BACKUP CLOUD</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="text" value={config.backupCloud?.percorso || ''} readOnly placeholder="Nessuna cartella selezionata" style={{ ...styles.input, background: '#f1f5f9', color: '#94a3b8', flex: 1 }} />
                <button onClick={onSelezionaCartellaBackupCloud} style={{ ...styles.btn('#4f46e5'), width: 'auto' }}><FolderSync size={18}/> Scegli Cartella</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={styles.label}>FREQUENZA</label>
                <select value={config.backupCloud?.frequenza || 'nessuno'} onChange={e => aggiornaBackup('backupCloud', { frequenza: e.target.value })} style={styles.input}>
                  <option value="nessuno">Nessuno</option>
                  <option value="avvio">Ad ogni avvio</option>
                  <option value="giornaliero">Giornaliero</option>
                  <option value="modifica">Ad ogni modifica</option>
                </select>
              </div>
              <div>
                <label style={styles.label}>BACKUP DA CONSERVARE</label>
                <select value={config.backupCloud?.numeroBackup || 1} onChange={e => aggiornaBackup('backupCloud', { numeroBackup: Number(e.target.value) })} style={styles.input}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>Ultimo backup: {formatUltimoBackup(config.backupCloud?.ultimoBackup)}</span>
              <button onClick={() => onEseguiBackup('cloud')} style={{ ...styles.btn('#4f46e5'), width: 'auto' }}><CloudUpload size={18}/> Esegui Backup Ora</button>
            </div>
          </>
        )}
      </div>

      <div style={styles.card}>
        <h3>Cartella di Cattura</h3>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: 0, marginBottom: '15px' }}>
          Punta a una cartella sincronizzata col telefono (es. iCloud Drive o Google Drive): le foto/scansioni
          salvate lì dal telefono compariranno nella sezione &ldquo;Documenti da Importare&rdquo;, pronte da collegare a un record.
        </p>
        <label style={styles.label}>PERCORSO CARTELLA DI CATTURA</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="text" value={config.percorsoCattura || ''} readOnly placeholder="Nessuna cartella selezionata" style={{ ...styles.input, background: '#f1f5f9', color: '#94a3b8', flex: 1 }} />
          <button onClick={onSelezionaCartellaCattura} style={{ ...styles.btn('#4f46e5'), width: 'auto' }}><FolderSync size={18}/> Scegli Cartella</button>
        </div>
      </div>

      <div style={styles.card}>
        <h3><ScanText size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Estrazione Automatica (OCR)</h3>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: 0, marginBottom: '15px' }}>
          Parole chiave usate per riconoscere l&rsquo;importo e la scadenza nei documenti analizzati con
          &ldquo;Estrai dati automaticamente&rdquo; (Documenti da Importare). Le prime della lista contano di più:
          l&rsquo;app le riordina da sola quando confermi un candidato per un fornitore specifico.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={styles.label}>PAROLE CHIAVE IMPORTO</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input type="text" value={nuovaParolaImporto} onChange={e => setNuovaParolaImporto(e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter') { aggiungiParolaChiaveOcr('paroleChiaveImporto', nuovaParolaImporto); setNuovaParolaImporto(''); } }}
                     style={styles.input} placeholder="es. totale bolletta" />
              <button onClick={() => { aggiungiParolaChiaveOcr('paroleChiaveImporto', nuovaParolaImporto); setNuovaParolaImporto(''); }} style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>Aggiungi</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {config.ocr?.paroleChiaveImporto?.map(parola => (
                <span key={parola} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                  {parola}
                  <X size={12} style={{ cursor: 'pointer' }} onClick={() => rimuoviParolaChiaveOcr('paroleChiaveImporto', parola)} />
                </span>
              ))}
            </div>
          </div>
          <div>
            <label style={styles.label}>PAROLE CHIAVE SCADENZA</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input type="text" value={nuovaParolaData} onChange={e => setNuovaParolaData(e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter') { aggiungiParolaChiaveOcr('paroleChiaveData', nuovaParolaData); setNuovaParolaData(''); } }}
                     style={styles.input} placeholder="es. scade il" />
              <button onClick={() => { aggiungiParolaChiaveOcr('paroleChiaveData', nuovaParolaData); setNuovaParolaData(''); }} style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>Aggiungi</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {config.ocr?.paroleChiaveData?.map(parola => (
                <span key={parola} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                  {parola}
                  <X size={12} style={{ cursor: 'pointer' }} onClick={() => rimuoviParolaChiaveOcr('paroleChiaveData', parola)} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3>Gestione Profilo</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={styles.label}>NOME UTENTE</label>
            <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value.toLowerCase())} style={styles.input} />
          </div>
          <div>
            <label style={styles.label}>NUOVA PASSWORD</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Lascia vuoto per non cambiare" style={styles.input} />
          </div>
        </div>
        <button onClick={updateProfile} style={{ ...styles.btn(config.coloreTema), width: 'auto', marginTop: '20px' }}>
          <Save size={18}/> Salva Modifiche Profilo
        </button>
      </div>

      <div style={styles.card}>
        <h3>Gestione Tag</h3>
        {/* Un nuovo tag nasce sempre di tipo "uscita" di default; il tipo si cambia dopo cliccando il suo pallino colorato */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input type="text" value={nuovoTag} onChange={e=>setNuovaTag(e.target.value)} style={styles.input} placeholder="Aggiungi tag..."/>
          <button onClick={()=>{if(nuovoTag){setConfig({...config, tags:[...config.tags, {nome:nuovoTag.toLowerCase(), tipo:'uscita'}]}); setNuovaTag('')}}} style={{...styles.btn(config.coloreTema), width:'auto'}}>Crea Tag</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {config?.tags?.map(c => (
            <div key={c.nome} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: '800', fontSize: '11px', color: '#1e293b' }}>{c.nome.toUpperCase()}</span>
              <button onClick={() => toggleTipoCategoria(c.nome)} style={dotStyle(c.tipo)}>
                {c.tipo === 'entrata' ? '+' : c.tipo === 'uscita' ? '-' : 'o'}
              </button>
              <Trash2 size={14} color="#cbd5e1" cursor="pointer" onClick={()=>{
                setConfig({...config, tags: config.tags.filter(x=>x.nome!==c.nome)});
              }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}