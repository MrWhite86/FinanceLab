// SettingsView: 6 tab orizzontali, ciascuna con le card indipendenti che agiscono su "config"
// (passato da App.jsx, che lo salva in localStorage ad ogni modifica):
// 1. Generale - Parametri Iniziali (saldo/data di partenza) + Operazioni Pianificate.
// 2. Grafica - modalità chiara/scura, colore accento, Lingua/Carattere (non ancora funzionanti).
// 3. Account - Gestione Profilo, Backup Locale, Backup Cloud (frequenza/rotazione, non il percorso).
// 4. Gestione Dati - Percorsi (Archivio, Cattura, Backup Cloud) + Manutenzione Archivio (export/import).
// 5. Automazione - Tag di Sistema, Riconoscimento OCR, Tag di Spesa (categorie scontrini).
// 6. Info - logo/versione, Privacy, Licenza d'Uso, Aggiornamenti.
// I testi descrittivi grigi fissi sono stati sostituiti da InfoTip (icona "i" al passaggio del
// mouse/focus), per non affollare le card di paragrafi che l'utente legge una volta sola.
import { useState } from 'react';
import { CloudUpload, Database, Download, FileText, FolderSync, HardDriveDownload, Inbox, Info, Lock, Moon, Palette, Pencil, Plus, RefreshCw, Save, SlidersHorizontal, Sun, Trash2, Unlock, Upload, UserCircle, Workflow, X } from 'lucide-react';
import InfoTip from './InfoTip';
import { ACCENT_PRESETS } from '../constants';
import logoArkiv from '../assets/logo-arkiv-orizzontale.png';
import pkgJson from '../../package.json';

const TABS = [
  { id: 'generale', label: 'Generale', icon: SlidersHorizontal },
  { id: 'grafica', label: 'Grafica', icon: Palette },
  { id: 'account', label: 'Account', icon: UserCircle },
  { id: 'dati', label: 'Gestione Dati', icon: Database },
  { id: 'automazione', label: 'Automazione', icon: Workflow },
  { id: 'info', label: 'Info', icon: Info },
];

const MESI_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export default function SettingsView({ config, spese, setConfig, user, updateProfile, importaJSON, onSelezionaCartellaCattura, onSelezionaCartellaBackupCloud, onEseguiBackup, styles, isMobile, newUsername, setNewUsername, newPassword, setNewPassword, showToast }) {
  const isAdmin = user.username === 'admin';
  const [tabAttiva, setTabAttiva] = useState('generale');
  const [nuovoTag, setNuovaTag] = useState('');
  const [nuovaCategoriaSpesa, setNuovaCategoriaSpesa] = useState('');
  const [nuovaParolaImporto, setNuovaParolaImporto] = useState('');
  const [nuovaParolaData, setNuovaParolaData] = useState('');
  /** Il percorso di backup è di sola lettura finché l'admin non lo sblocca esplicitamente col lucchetto, per evitare modifiche accidentali. */
  const [bloccaPercorso, setBloccaPercorso] = useState(true);
  /** Rivela l'input color nativo solo su richiesta: evitare un secondo controllo colore sempre visibile accanto agli 8 preset. */
  const [mostraColorePersonalizzato, setMostraColorePersonalizzato] = useState(false);

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

  /** Aggiunge/rimuove una categoria di spesa (usata per classificare le righe degli scontrini, vedi Importa.jsx): stringhe semplici, senza il "tipo" entrata/uscita/neutro dei tag. */
  const aggiungiCategoriaSpesa = () => {
    const nome = nuovaCategoriaSpesa.trim().toLowerCase();
    if (!nome || (config.categorieSpesa || []).includes(nome)) return;
    setConfig({ ...config, categorieSpesa: [...(config.categorieSpesa || []), nome] });
    setNuovaCategoriaSpesa('');
  };
  const rimuoviCategoriaSpesa = (nome) => setConfig({ ...config, categorieSpesa: (config.categorieSpesa || []).filter(c => c !== nome) });

  // --- OPERAZIONI PIANIFICATE ---
  const [formOperazioneAperto, setFormOperazioneAperto] = useState(false);
  /** id dell'operazione in fase di modifica (il form si riapre precompilato), o null se se ne sta creando una nuova. */
  const [operazioneInModifica, setOperazioneInModifica] = useState(null);
  const [nuovaOperazione, setNuovaOperazione] = useState({ nome: '', importo: '', tags: [], tipoPeriodicita: 'mensile', giorno: '', mese: '1' });

  const apriFormOperazione = () => {
    setFormOperazioneAperto(true);
    setOperazioneInModifica(null);
    setNuovaOperazione({ nome: '', importo: '', tags: [], tipoPeriodicita: 'mensile', giorno: '', mese: '1' });
  };
  const iniziaModificaOperazione = (op) => {
    setFormOperazioneAperto(true);
    setOperazioneInModifica(op.id);
    setNuovaOperazione({ nome: op.nome, importo: String(op.importo), tags: op.tags || [], tipoPeriodicita: op.tipoPeriodicita, giorno: String(op.giorno), mese: String(op.mese || 1) });
  };
  const chiudiFormOperazione = () => {
    setFormOperazioneAperto(false);
    setOperazioneInModifica(null);
    setNuovaOperazione({ nome: '', importo: '', tags: [], tipoPeriodicita: 'mensile', giorno: '', mese: '1' });
  };
  const toggleTagOperazione = (nome) => {
    setNuovaOperazione(prev => ({ ...prev, tags: prev.tags.includes(nome) ? prev.tags.filter(t => t !== nome) : [...prev.tags, nome] }));
  };

  /** Salva la nuova operazione (o applica le modifiche a quella in corso di modifica). "ultimaEsecuzione"
   * di una nuova operazione parte da oggi: la materializzazione (App.jsx) recupera solo le occorrenze
   * mancate DOPO la creazione, non retroattivamente da sempre. */
  const salvaOperazione = () => {
    if (!nuovaOperazione.nome.trim()) return showToast("Il campo Nome è obbligatorio");
    if (!(Number.isFinite(Number(nuovaOperazione.importo)) && Number(nuovaOperazione.importo) > 0)) return showToast("Inserisci un importo valido");
    if (nuovaOperazione.tags.length === 0) return showToast("Seleziona almeno un tag");
    const giorno = Number(nuovaOperazione.giorno);
    if (!(Number.isInteger(giorno) && giorno >= 1 && giorno <= 31)) return showToast("Inserisci un giorno valido (1-31)");
    const mese = nuovaOperazione.tipoPeriodicita === 'annuale' ? Number(nuovaOperazione.mese) : undefined;

    if (operazioneInModifica) {
      setConfig({
        ...config,
        operazioniPianificate: config.operazioniPianificate.map(op => op.id === operazioneInModifica
          ? { ...op, nome: nuovaOperazione.nome, importo: Number(nuovaOperazione.importo), tags: nuovaOperazione.tags, tipoPeriodicita: nuovaOperazione.tipoPeriodicita, giorno, mese }
          : op),
      });
      showToast("Operazione pianificata aggiornata!");
    } else {
      const nuova = {
        id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now() + Math.random(),
        nome: nuovaOperazione.nome, importo: Number(nuovaOperazione.importo), tags: nuovaOperazione.tags,
        tipoPeriodicita: nuovaOperazione.tipoPeriodicita, giorno, mese,
        ultimaEsecuzione: new Date().toISOString().slice(0, 10), attiva: true,
      };
      setConfig({ ...config, operazioniPianificate: [...(config.operazioniPianificate || []), nuova] });
      showToast("Operazione pianificata creata!");
    }
    chiudiFormOperazione();
  };

  const rimuoviOperazione = (id) => setConfig({ ...config, operazioniPianificate: (config.operazioniPianificate || []).filter(op => op.id !== id) });

  /** Stesso identico criterio di useFinance.js (entrata batte uscita se un'operazione ha tag misti): solo visivo, non salvato come campo a parte. */
  const segnoOperazione = (tagsOperazione) => {
    const tagInfos = (tagsOperazione || []).map(tn => config.tags?.find(t => t.nome === tn)).filter(Boolean);
    if (tagInfos.some(t => t.tipo === 'entrata')) return 'entrata';
    if (tagInfos.some(t => t.tipo === 'uscita')) return 'uscita';
    return 'neutro';
  };
  const formatPeriodoOperazione = (op) => op.tipoPeriodicita === 'annuale'
    ? `Ogni anno, ${op.giorno} ${MESI_IT[op.mese - 1]}`
    : `Ogni mese, il ${op.giorno}`;

  const dotStyle = (tipo) => ({
    width: '28px', height: '28px', borderRadius: '50%', border: 'none', color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '14px',
    background: tipo === 'entrata' ? '#10b981' : tipo === 'uscita' ? '#ef4444' : '#a3a3a3'
  });

  // index.css azzera il margine di default di ogni heading (reset universale "* { margin: 0 }"),
  // quindi senza questo stile i titoli delle card (es. "Backup Locale") si troverebbero incollati
  // al campo subito sotto (es. "FREQUENZA"): ogni <h3> di questo file lo usa per lo stesso respiro.
  const titoloCard = { margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' };
  const badgeProssimamente = { fontSize: '8.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: styles.testoMuto, background: styles.bgSottile2, border: `1px solid ${styles.border}`, borderRadius: '999px', padding: '2px 7px', marginLeft: '8px', verticalAlign: 'middle' };
  const graficaEtichetta = { fontSize: '9.5px', fontWeight: '700', color: styles.testoMuto, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '10px' };
  const sottoBloccoTitolo = { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: styles.testoMuto, marginBottom: '8px' };

  /** Riga icona+etichetta+valore+azione, riusata in "Percorsi", "Manutenzione Archivio" e "Info": una funzione (non un componente) cosi' non causa un rimontaggio dell'albero DOM ad ogni render di SettingsView. */
  const renderRigaPercorso = ({ icon: Icon, iconAmbra, label, info, valore, azione, disabilitato, ultimo }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0', borderBottom: ultimo ? 'none' : `1px solid ${styles.border}`, opacity: disabilitato ? 0.42 : 1 }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: iconAmbra ? '#f5940b1a' : styles.bgSottile2, color: iconAmbra ? '#b45309' : config.coloreTema }}>
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <label style={{ ...styles.label, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>{label}{info && <InfoTip testo={info} styles={styles} />}</label>
        {typeof valore === 'string' ? <span style={{ fontSize: '12.5px', color: styles.testo }}>{valore}</span> : valore}
      </div>
      {azione && <div style={{ flexShrink: 0, pointerEvents: disabilitato ? 'none' : 'auto' }}>{azione}</div>}
    </div>
  );

  /** Card-anteprima cliccabile per la modalità chiara/scura: mostra davvero come cambia l'aspetto (mini mockup con due "righe" + barra accento), non solo un'icona sole/luna astratta. */
  const renderModoCard = (scuro, etichetta, Icona) => {
    const selezionato = config.temaScuro === scuro;
    return (
      <button type="button" onClick={() => setConfig({ ...config, temaScuro: scuro })}
        style={{ width: '130px', borderRadius: '10px', border: `2px solid ${selezionato ? config.coloreTema : styles.border}`, cursor: 'pointer', overflow: 'hidden', background: styles.card.background, padding: 0, transition: 'border-color .12s ease' }}>
        <div style={{ height: '64px', padding: '10px', background: scuro ? '#0d0d0f' : '#e9e9e7' }}>
          <div style={{ height: '100%', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '5px', background: scuro ? '#262626' : '#ffffff', boxShadow: scuro ? 'none' : '0 1px 3px rgba(0,0,0,0.1)' }}>
            <span style={{ display: 'block', height: '5px', borderRadius: '3px', width: '70%', background: scuro ? '#46464a' : '#dcdcda' }} />
            <span style={{ display: 'block', height: '5px', borderRadius: '3px', width: '45%', background: scuro ? '#46464a' : '#dcdcda' }} />
            <span style={{ display: 'block', width: '24px', height: '5px', borderRadius: '3px', marginTop: '3px', background: config.coloreTema }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 0', fontSize: '11.5px', fontWeight: '700', color: selezionato ? config.coloreTema : styles.testoMuto, borderTop: `1px solid ${styles.border}` }}>
          <Icona size={14} /> {etichetta}
        </div>
      </button>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', background: styles.bgSottile2, padding: '4px', borderRadius: '12px', marginBottom: '24px', width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTabAttiva(id)} style={{ padding: '8px 16px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px', background: tabAttiva === id ? styles.card.background : 'transparent', color: tabAttiva === id ? config.coloreTema : styles.testoMuto }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ===== GENERALE ===== */}
        {tabAttiva === 'generale' && (
          <>
            <div style={styles.card}>
              <h3 style={titoloCard}>
                Parametri Iniziali
                <InfoTip styles={styles} testo="Il punto di partenza da cui Arkiv calcola la Liquidità Attuale: il saldo che avevi nella data indicata, prima di qualunque movimento registrato." />
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={styles.label}>SALDO INIZIALE (€)</label>
                  <input type="number" value={config.saldoStatoZero} onChange={e => setConfig({ ...config, saldoStatoZero: Number(e.target.value) })} style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>DATA DI PARTENZA</label>
                  <input type="date" value={config.dataStatoZero} onChange={e => setConfig({ ...config, dataStatoZero: e.target.value })} style={styles.input} />
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={titoloCard}>
                Operazioni Pianificate
                <InfoTip styles={styles} testo="Crea automaticamente un movimento a ogni scadenza — utile per stipendio, affitto, rate e altre voci ricorrenti." />
              </h3>

              {(config.operazioniPianificate || []).length === 0 && !formOperazioneAperto && (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: styles.testoMuto, fontSize: '12px', fontWeight: '600' }}>
                  Nessuna operazione pianificata ancora.
                </div>
              )}

              {(config.operazioniPianificate || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {config.operazioniPianificate.map(op => {
                    const segno = segnoOperazione(op.tags);
                    const colore = segno === 'entrata' ? '#10b981' : segno === 'uscita' ? '#ef4444' : '#a3a3a3';
                    return (
                      <div key={op.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr 1.2fr auto', gap: '10px', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${styles.border}`, fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', color: styles.testo }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colore, flexShrink: 0 }} />
                          {op.nome}
                        </div>
                        <div style={{ fontWeight: '800', fontVariantNumeric: 'tabular-nums', color: colore }}>
                          {segno === 'entrata' ? '+ ' : segno === 'uscita' ? '− ' : ''}€ {Number(op.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ color: styles.testoMuto }}>{formatPeriodoOperazione(op)}</div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                          <Pencil size={14} color={styles.testoMuto} cursor="pointer" onClick={() => iniziaModificaOperazione(op)} />
                          <Trash2 size={14} color={styles.testoMuto} cursor="pointer" onClick={() => rimuoviOperazione(op.id)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {formOperazioneAperto && (
                <div style={{ marginTop: '14px', padding: '16px', background: styles.bgSottile, borderRadius: '12px', border: `1px dashed ${styles.borderForte}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: config.coloreTema }}>
                      {operazioneInModifica ? `Stai modificando: ${nuovaOperazione.nome || '...'}` : 'Nuova operazione pianificata'}
                    </span>
                    <button onClick={chiudiFormOperazione} style={{ background: 'transparent', border: 'none', color: config.coloreTema, fontSize: '11px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>ANNULLA</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={styles.label}>NOME</label>
                      <input type="text" value={nuovaOperazione.nome} onChange={e => setNuovaOperazione({ ...nuovaOperazione, nome: e.target.value })} style={styles.input} placeholder="es. Stipendio" />
                    </div>
                    <div>
                      <label style={styles.label}>IMPORTO (€)</label>
                      <input type="number" value={nuovaOperazione.importo} onChange={e => setNuovaOperazione({ ...nuovaOperazione, importo: e.target.value })} style={styles.input} />
                    </div>
                    <div>
                      <label style={styles.label}>PERIODICITÀ</label>
                      <select value={nuovaOperazione.tipoPeriodicita} onChange={e => setNuovaOperazione({ ...nuovaOperazione, tipoPeriodicita: e.target.value })} style={styles.input}>
                        <option value="mensile">Mensile</option>
                        <option value="annuale">Annuale</option>
                      </select>
                    </div>
                    <div>
                      <label style={styles.label}>GIORNO</label>
                      <input type="number" min="1" max="31" value={nuovaOperazione.giorno} onChange={e => setNuovaOperazione({ ...nuovaOperazione, giorno: e.target.value })} style={styles.input} />
                    </div>
                  </div>
                  {nuovaOperazione.tipoPeriodicita === 'annuale' && (
                    <div style={{ marginBottom: '12px', maxWidth: '220px' }}>
                      <label style={styles.label}>MESE</label>
                      <select value={nuovaOperazione.mese} onChange={e => setNuovaOperazione({ ...nuovaOperazione, mese: e.target.value })} style={styles.input}>
                        {MESI_IT.map((m, i) => <option key={m} value={i + 1}>{m[0].toUpperCase() + m.slice(1)}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ marginBottom: '16px' }}>
                    <span style={styles.label}>TAG:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {config?.tags?.map(t => (
                        <div key={t.nome} onClick={() => toggleTagOperazione(t.nome)}
                          style={{
                            padding: '4px 10px', borderRadius: '8px', border: `1px solid ${styles.border}`, fontSize: '10px', fontWeight: '700', cursor: 'pointer',
                            background: nuovaOperazione.tags.includes(t.nome) ? (t.tipo === 'entrata' ? '#10b981' : t.tipo === 'uscita' ? '#ef4444' : '#737373') : styles.card.background,
                            color: nuovaOperazione.tags.includes(t.nome) ? '#fff' : styles.testoMuto,
                          }}>
                          {t.nome.toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={salvaOperazione} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>{operazioneInModifica ? 'Salva Modifiche' : 'Crea Operazione'}</button>
                  </div>
                </div>
              )}

              {!formOperazioneAperto && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                  <button onClick={apriFormOperazione} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>
                    <Plus size={14} /> Nuova Operazione Pianificata
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===== GRAFICA ===== */}
        {tabAttiva === 'grafica' && (
          <div style={styles.card}>
            <h3 style={titoloCard}>Aspetto</h3>
            <div style={{ marginBottom: '22px' }}>
              <span style={graficaEtichetta}>Modalità</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                {renderModoCard(false, 'Chiaro', Sun)}
                {renderModoCard(true, 'Scuro', Moon)}
              </div>
            </div>
            <div style={{ marginBottom: '22px' }}>
              <span style={graficaEtichetta}>Colore Accento</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {ACCENT_PRESETS.map(colore => {
                  const selezionato = config.coloreTema === colore;
                  return (
                    <button key={colore} type="button" title={colore} onClick={() => setConfig({ ...config, coloreTema: colore })}
                      style={{ width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', border: 'none', background: colore, boxShadow: selezionato ? `0 0 0 2px ${styles.card.background}, 0 0 0 4px ${colore}` : `0 0 0 2px ${styles.card.background}` }} />
                  );
                })}
                <button type="button" title="Colore personalizzato" onClick={() => setMostraColorePersonalizzato(v => !v)}
                  style={{ width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', border: `1px dashed ${styles.borderForte}`, background: styles.bgSottile2, color: styles.testoMuto, fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                {mostraColorePersonalizzato && (
                  <input type="color" value={config.coloreTema} onChange={e => setConfig({ ...config, coloreTema: e.target.value })}
                    style={{ width: '34px', height: '34px', padding: '2px', borderRadius: '50%', border: `1px solid ${styles.border}`, cursor: 'pointer', background: 'transparent' }} />
                )}
              </div>
            </div>
            <div style={{ marginBottom: '22px' }}>
              <span style={graficaEtichetta}>Lingua<span style={badgeProssimamente}>Prossimamente</span></span>
              <select disabled style={{ ...styles.input, maxWidth: '260px', opacity: 0.55, cursor: 'not-allowed' }}>
                <option>Italiano</option>
              </select>
            </div>
            <div>
              <span style={graficaEtichetta}>Carattere<span style={badgeProssimamente}>Prossimamente</span></span>
              <select disabled style={{ ...styles.input, maxWidth: '260px', opacity: 0.55, cursor: 'not-allowed' }}>
                <option>Inter (predefinito)</option>
              </select>
            </div>
          </div>
        )}

        {/* ===== ACCOUNT ===== */}
        {tabAttiva === 'account' && (
          <>
            <div style={styles.card}>
              <h3 style={titoloCard}>
                Gestione Profilo
                <InfoTip styles={styles} testo="Protegge il profilo dagli altri membri della famiglia che usano lo stesso computer, non da un attacco esterno: Arkiv non ha un server, quindi non c'è nulla a cui un estraneo possa accedere da remoto." />
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
                <div>
                  <label style={styles.label}>NOME UTENTE</label>
                  <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value.toLowerCase())} style={styles.input} />
                </div>
                <div>
                  <label style={styles.label}>NUOVA PASSWORD</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Lascia vuoto per non cambiare" style={styles.input} />
                </div>
                <button onClick={updateProfile} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>
                  <Save size={18}/> Salva
                </button>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={titoloCard}>
                Backup Locale
                <InfoTip styles={styles} testo="Salva periodicamente una copia completa (archivio + allegati) in una sottocartella separata per profilo, dentro la cartella Archivio." />
              </h3>
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
                <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: '700' }}>Ultimo backup: {formatUltimoBackup(config.backupLocale?.ultimoBackup)}</span>
                <button onClick={() => onEseguiBackup('locale')} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}><HardDriveDownload size={18}/> Esegui Backup Ora</button>
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={titoloCard}>
                Backup Cloud
                <InfoTip styles={styles} testo="Come il backup locale, ma nella cartella cloud scelta in Gestione Dati (iCloud Drive, Google Drive, iDrive...): utile per avere una copia anche fuori da questo computer." />
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', cursor: 'pointer' }} onClick={() => aggiornaBackup('backupCloud', { attivo: !config.backupCloud?.attivo })}>
                <input type="checkbox" checked={!!config.backupCloud?.attivo} onChange={() => {}} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                <span style={{ fontSize: '13px', fontWeight: '700', color: styles.testo }}>Attiva copia su cartella sincronizzata (iCloud Drive, Google Drive, iDrive...)</span>
              </div>

              {config.backupCloud?.attivo && (
                <>
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
                    <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: '700' }}>Ultimo backup: {formatUltimoBackup(config.backupCloud?.ultimoBackup)}</span>
                    <button onClick={() => onEseguiBackup('cloud')} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}><CloudUpload size={18}/> Esegui Backup Ora</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ===== GESTIONE DATI ===== */}
        {tabAttiva === 'dati' && (
          <>
            <div style={styles.card}>
              <h3 style={titoloCard}>Percorsi</h3>
              {renderRigaPercorso({
                icon: Database,
                label: isAdmin ? 'ARCHIVIO (ROOT DI SISTEMA)' : 'ARCHIVIO PERSONALE',
                info: "La cartella principale dove Arkiv salva tutti i registri e gli allegati. Modificabile solo dall'account admin, e solo a sistema sbloccato (icona lucchetto): cambiarla a cuor leggero rischia di far “perdere di vista” i dati già archiviati nella cartella precedente.",
                valore: (
                  <input type="text" value={isAdmin ? config.percorsoSalvataggio : `${config.percorsoSalvataggio}/${user.username}`}
                    onChange={e => isAdmin && setConfig({ ...config, percorsoSalvataggio: e.target.value })}
                    readOnly={!isAdmin || bloccaPercorso}
                    style={{ fontSize: '12.5px', color: (!isAdmin || bloccaPercorso) ? styles.testoMuto : styles.testo, background: 'transparent', border: 'none', outline: 'none', width: '100%', padding: 0 }} />
                ),
                azione: isAdmin && (
                  <button onClick={() => setBloccaPercorso(!bloccaPercorso)} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto', padding: '8px' }}>
                    {bloccaPercorso ? <Lock size={16}/> : <Unlock size={16}/>}
                  </button>
                ),
              })}
              {renderRigaPercorso({
                icon: Inbox,
                label: 'CARTELLA DI CATTURA',
                info: 'Le foto/scansioni salvate qui dal telefono compaiono in "Documenti da Importare".',
                valore: config.percorsoCattura || <span style={{ color: styles.testoMuto }}>Nessuna cartella selezionata</span>,
                azione: <button onClick={onSelezionaCartellaCattura} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}><FolderSync size={16}/> Scegli</button>,
              })}
              {renderRigaPercorso({
                icon: CloudUpload,
                label: 'CARTELLA DI BACKUP CLOUD',
                info: 'Selezionabile solo se il backup cloud è attivo (Account → Backup Cloud).',
                valore: config.backupCloud?.percorso || <span style={{ color: styles.testoMuto }}>Nessuna cartella selezionata</span>,
                azione: <button onClick={onSelezionaCartellaBackupCloud} disabled={!config.backupCloud?.attivo} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}><FolderSync size={16}/> Scegli</button>,
                disabilitato: !config.backupCloud?.attivo,
                ultimo: true,
              })}
            </div>

            <div style={styles.card}>
              <h3 style={titoloCard}>Manutenzione Archivio</h3>
              {renderRigaPercorso({
                icon: Download,
                label: 'ESPORTA DATI',
                info: 'Scarica un file JSON con impostazioni e movimenti. Non include gli allegati: per un backup completo (con i documenti) usa Backup Locale o Cloud, in Account.',
                valore: 'Non ancora esportato',
                azione: (
                  <button onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ config, spese })])); a.download = 'backup.json'; a.click(); }}
                    className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>Esporta</button>
                ),
              })}
              {renderRigaPercorso({
                icon: Upload,
                iconAmbra: true,
                label: 'IMPORTA DATI',
                info: 'Sovrascrive impostazioni e movimenti correnti con quelli del file scelto. Operazione irreversibile: assicurati di avere un backup recente prima di procedere.',
                valore: 'Non ancora importato',
                azione: (
                  <label className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto', cursor: 'pointer' }}>
                    Importa
                    <input type="file" style={{ display: 'none' }} onChange={importaJSON} />
                  </label>
                ),
                ultimo: true,
              })}
            </div>
          </>
        )}

        {/* ===== AUTOMAZIONE ===== */}
        {tabAttiva === 'automazione' && (
          <>
            <div style={{ marginBottom: '22px' }}>
              <span style={sottoBloccoTitolo}>
                Tag di Sistema
                <InfoTip styles={styles} testo="Le categorie generali dei movimenti (entrata / uscita / neutro), usate ovunque nell'app." />
              </span>
              <div style={styles.card}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <input type="text" value={nuovoTag} onChange={e => setNuovaTag(e.target.value)} style={styles.input} placeholder="Aggiungi tag..." />
                  <button onClick={() => { if (nuovoTag) { setConfig({ ...config, tags: [...config.tags, { nome: nuovoTag.toLowerCase(), tipo: 'uscita' }] }); setNuovaTag(''); } }} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>Crea Tag</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {config?.tags?.map(c => (
                    <div key={c.nome} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', background: styles.bgSottile, borderRadius: '14px', border: `1px solid ${styles.border}` }}>
                      <span style={{ fontWeight: '700', fontSize: '11px', color: styles.testo }}>{c.nome.toUpperCase()}</span>
                      <button onClick={() => toggleTipoCategoria(c.nome)} style={dotStyle(c.tipo)}>
                        {c.tipo === 'entrata' ? '+' : c.tipo === 'uscita' ? '-' : 'o'}
                      </button>
                      <Trash2 size={14} color={styles.borderForte} cursor="pointer" onClick={() => { setConfig({ ...config, tags: config.tags.filter(x => x.nome !== c.nome) }); }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
              <span style={sottoBloccoTitolo}>
                Riconoscimento OCR
                <InfoTip styles={styles} testo="Parole chiave usate per riconoscere importo e scadenza nei documenti analizzati automaticamente." />
              </span>
              <div style={styles.card}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={styles.label}>PAROLE CHIAVE IMPORTO</label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input type="text" value={nuovaParolaImporto} onChange={e => setNuovaParolaImporto(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { aggiungiParolaChiaveOcr('paroleChiaveImporto', nuovaParolaImporto); setNuovaParolaImporto(''); } }}
                        style={styles.input} placeholder="es. totale bolletta" />
                      <button onClick={() => { aggiungiParolaChiaveOcr('paroleChiaveImporto', nuovaParolaImporto); setNuovaParolaImporto(''); }} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>Aggiungi</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {config.ocr?.paroleChiaveImporto?.map(parola => (
                        <span key={parola} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: styles.bgSottile, border: `1px solid ${styles.border}`, borderRadius: '8px', fontSize: '11px', fontWeight: '700', color: styles.testoMuto }}>
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
                      <button onClick={() => { aggiungiParolaChiaveOcr('paroleChiaveData', nuovaParolaData); setNuovaParolaData(''); }} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>Aggiungi</button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {config.ocr?.paroleChiaveData?.map(parola => (
                        <span key={parola} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: styles.bgSottile, border: `1px solid ${styles.border}`, borderRadius: '8px', fontSize: '11px', fontWeight: '700', color: styles.testoMuto }}>
                          {parola}
                          <X size={12} style={{ cursor: 'pointer' }} onClick={() => rimuoviParolaChiaveOcr('paroleChiaveData', parola)} />
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <span style={sottoBloccoTitolo}>
                Tag di Spesa
                <InfoTip styles={styles} testo="Le macro-categorie usate per classificare le righe degli scontrini (pane, latticini, carne...)." />
              </span>
              <div style={styles.card}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <input type="text" value={nuovaCategoriaSpesa} onChange={e => setNuovaCategoriaSpesa(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') aggiungiCategoriaSpesa(); }}
                    style={styles.input} placeholder="Aggiungi categoria..." />
                  <button onClick={aggiungiCategoriaSpesa} className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>Crea Categoria</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(config.categorieSpesa || []).map(cat => (
                    <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: styles.bgSottile, borderRadius: '10px', border: `1px solid ${styles.border}`, fontSize: '11px', fontWeight: '700', color: styles.testo }}>
                      {cat.toUpperCase()}
                      <X size={12} style={{ cursor: 'pointer', color: styles.testoMuto }} onClick={() => rimuoviCategoriaSpesa(cat)} />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===== INFO ===== */}
        {tabAttiva === 'info' && (
          <>
            <div style={{ ...styles.card, textAlign: 'center', padding: '34px 24px' }}>
              <img src={logoArkiv} alt="Arkiv" style={{ height: '46px', width: 'auto', marginBottom: '14px' }} />
              <div><span style={{ fontSize: '11.5px', color: styles.testoMuto, fontVariantNumeric: 'tabular-nums' }}>Versione {pkgJson.version}</span></div>
            </div>

            <div style={styles.card}>
              <h3 style={titoloCard}>Informazioni</h3>
              {renderRigaPercorso({
                icon: Lock,
                label: 'PRIVACY',
                info: 'Arkiv non ha un server: nessun dato lascia questo computer. Backup e cattura restano nelle cartelle che scegli tu.',
                valore: 'Applicazione locale, nessun dato inviato online',
              })}
              {renderRigaPercorso({
                icon: FileText,
                label: "LICENZA D'USO",
                valore: 'Uso personale',
                azione: (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button disabled className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>Consulta</button>
                    <span style={badgeProssimamente}>Prossimamente</span>
                  </div>
                ),
              })}
              {renderRigaPercorso({
                icon: RefreshCw,
                label: 'AGGIORNAMENTI',
                valore: 'Ultimo controllo: mai eseguito',
                azione: (
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button disabled className="arkiv-btn" style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>Controlla</button>
                    <span style={badgeProssimamente}>Prossimamente</span>
                  </div>
                ),
                ultimo: true,
              })}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
