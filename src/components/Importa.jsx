import { useState } from 'react';
import { Check, FileImage, FileText, FolderSync, Inbox, ListPlus, Loader2, RefreshCw, ScanText, Search, Tag, X } from 'lucide-react';
import { mimeTypeDaNomeFile } from '../fileUtils';

/**
 * ImportaView: pannello "Documenti da Importare". Elenca i file trovati nella cartella di
 * cattura (fileDaImportare, calcolato da App.jsx) e per ciascuno offre due strade:
 * - collegarlo a un record già esistente (di qualunque anno);
 * - crearne uno nuovo, con un mini-form che ricalca il form principale di Dashboard.jsx.
 * Non mostra/legge il contenuto dei file (nessuna anteprima qui): serve solo a smistarli.
 */
export default function ImportaView({ fileDaImportare, percorsoCattura, spese, config, styles, isMobile, onRiscansiona, onAllegaEsistente, onCreaRecord, onIgnoraFile, onLeggiFileCattura, onEstraiDatiOcr, onImparaOcrFornitore, showToast }) {
  /** Nome del file il cui pannello di gestione è aperto, o null se nessuno. */
  const [fileAttivo, setFileAttivo] = useState(null);
  /** 'allega' | 'crea' | null: quale delle due modalità è aperta per fileAttivo. */
  const [modalita, setModalita] = useState(null);

  const [ricercaEsistente, setRicercaEsistente] = useState('');
  const annoDefault = config.anniAttivi?.[0] || new Date().getFullYear().toString();
  const [nuovoRecord, setNuovoRecord] = useState({ anno: annoDefault, importo: '', data: `${annoDefault}-01-01`, nota: '', tags: [] });
  const [fornitore, setFornitore] = useState('');
  const [estraendoOcr, setEstraendoOcr] = useState(false);
  /** Candidati importo/data trovati dall'ultima estrazione OCR, o null se non ancora eseguita. */
  const [risultatoOcr, setRisultatoOcr] = useState(null);

  const apriPannello = (nomeFile, mod) => {
    setFileAttivo(nomeFile);
    setModalita(mod);
    setRicercaEsistente('');
    setFornitore('');
    setRisultatoOcr(null);
    setNuovoRecord({ anno: annoDefault, importo: '', data: `${annoDefault}-01-01`, nota: nomeFile.replace(/\.[^.]+$/, ''), tags: [] });
  };
  const chiudiPannello = () => { setFileAttivo(null); setModalita(null); };

  /** Legge il file, esegue l'OCR e mostra i candidati trovati: non riempie mai i campi da solo. */
  const estraiDatiAutomaticamente = async () => {
    setEstraendoOcr(true);
    setRisultatoOcr(null);
    try {
      const bytes = await onLeggiFileCattura(fileAttivo);
      if (!bytes) return;
      const risultato = await onEstraiDatiOcr(bytes, mimeTypeDaNomeFile(fileAttivo), fornitore);
      setRisultatoOcr(risultato);
      if (risultato.candidatiImporto.length === 0 && risultato.candidatiData.length === 0) {
        showToast("Nessun importo o data riconosciuto nel documento.");
      }
    } catch {
      showToast("Errore durante l'estrazione automatica.");
    } finally {
      setEstraendoOcr(false);
    }
  };

  const scegliCandidatoImporto = (candidato) => {
    setNuovoRecord(prev => ({ ...prev, importo: String(candidato.valore) }));
    onImparaOcrFornitore(fornitore, 'paroleChiaveImporto', candidato);
  };
  const scegliCandidatoData = (candidato) => {
    if (candidato.valore >= `${nuovoRecord.anno}-01-01` && candidato.valore <= `${nuovoRecord.anno}-12-31`) {
      setNuovoRecord(prev => ({ ...prev, data: candidato.valore }));
    } else {
      setNuovoRecord(prev => ({ ...prev, anno: candidato.valore.substring(0, 4), data: candidato.valore }));
    }
    onImparaOcrFornitore(fornitore, 'paroleChiaveData', candidato);
  };

  const risultatiRicerca = ricercaEsistente.trim().length === 0 ? [] : spese
    .filter(s => !s.contenitoreId && (s.nota || '').toLowerCase().includes(ricercaEsistente.trim().toLowerCase()))
    .slice(0, 6);

  const confermaCreaRecord = () => {
    if (!nuovoRecord.nota.trim()) return showToast("Il campo Nome è obbligatorio");
    if (!/^\d{4}$/.test(nuovoRecord.anno)) return showToast("Anno non valido");
    if (!(Number.isFinite(Number(nuovoRecord.importo)) && Number(nuovoRecord.importo) > 0)) return showToast("Inserisci un importo valido");
    if (nuovoRecord.tags.length === 0) return showToast("Seleziona almeno un tag");

    onCreaRecord(fileAttivo, nuovoRecord.anno, { importo: Number(nuovoRecord.importo), data: nuovoRecord.data, nota: nuovoRecord.nota, tags: nuovoRecord.tags });
    chiudiPannello();
  };

  const toggleTagNuovoRecord = (nome) => {
    setNuovoRecord(prev => ({ ...prev, tags: prev.tags.includes(nome) ? prev.tags.filter(t => t !== nome) : [...prev.tags, nome] }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '15px' }}>
          <div>
            <h2 style={{ fontWeight: '800', fontSize: '26px', margin: 0 }}>Documenti da Importare</h2>
            <span style={{ fontSize: '12px', color: '#737373' }}>
              {percorsoCattura ? `Cartella di cattura: ${percorsoCattura}` : 'Nessuna cartella di cattura configurata (Impostazioni → Cartella di Cattura)'}
            </span>
          </div>
          <button onClick={onRiscansiona} style={{ ...styles.btn('#525252'), width: 'auto' }}><RefreshCw size={16}/> Aggiorna</button>
        </div>
      </div>

      {!percorsoCattura ? (
        <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px', color: '#a3a3a3' }}>
          <FolderSync size={40} style={{ marginBottom: '12px' }} />
          <span style={{ fontSize: '14px', fontWeight: '600', textAlign: 'center' }}>
            Configura una cartella di cattura nelle Impostazioni per iniziare a importare documenti dal telefono.
          </span>
        </div>
      ) : fileDaImportare.length === 0 ? (
        <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px', color: '#a3a3a3' }}>
          <Inbox size={40} style={{ marginBottom: '12px' }} />
          <span style={{ fontSize: '14px', fontWeight: '600' }}>Nessun documento in attesa. Tutto importato!</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {fileDaImportare.map(nomeFile => {
            const mimeType = mimeTypeDaNomeFile(nomeFile);
            const isImmagine = mimeType.startsWith('image/');
            const supportaOcr = isImmagine || mimeType === 'application/pdf';
            const pannelloAperto = fileAttivo === nomeFile ? modalita : null;

            return (
              <div key={nomeFile} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    {isImmagine ? <FileImage size={18} color="#a3a3a3" /> : <FileText size={18} color="#a3a3a3" />}
                    <span style={{ fontWeight: '700', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeFile}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => apriPannello(nomeFile, 'allega')} style={{ ...styles.btn(pannelloAperto === 'allega' ? config.coloreTema : '#f5f5f5'), color: pannelloAperto === 'allega' ? '#fff' : '#525252', width: 'auto', fontSize: '12px', padding: '8px 12px' }}>
                      <Search size={14}/> Allega a esistente
                    </button>
                    <button onClick={() => apriPannello(nomeFile, 'crea')} style={{ ...styles.btn(pannelloAperto === 'crea' ? config.coloreTema : '#f5f5f5'), color: pannelloAperto === 'crea' ? '#fff' : '#525252', width: 'auto', fontSize: '12px', padding: '8px 12px' }}>
                      <ListPlus size={14}/> Crea nuovo record
                    </button>
                    <X size={16} color="#d4d4d4" style={{ cursor: 'pointer' }} title="Ignora questo file (non lo importa, ma non ricompare più)" onClick={() => onIgnoraFile(nomeFile)} />
                  </div>
                </div>

                {pannelloAperto === 'allega' && (
                  <div style={{ marginTop: '15px', padding: '15px', background: '#fafafa', borderRadius: '12px', border: '1px dashed #d4d4d4' }}>
                    <div style={{ position: 'relative', marginBottom: '10px' }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '13px', color: '#a3a3a3' }} />
                      <input
                        type="text"
                        autoFocus
                        value={ricercaEsistente}
                        onChange={e => setRicercaEsistente(e.target.value)}
                        placeholder="Cerca il record a cui collegare questo file..."
                        style={{ ...styles.input, paddingLeft: '38px' }}
                      />
                    </div>
                    {ricercaEsistente.trim() && (
                      risultatiRicerca.length === 0 ? (
                        <span style={{ fontSize: '12px', color: '#a3a3a3' }}>Nessun record trovato.</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {risultatiRicerca.map(mov => (
                            <div key={mov.id} onClick={() => { onAllegaEsistente(nomeFile, mov); chiudiPannello(); }}
                                 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e5e5', cursor: 'pointer' }}>
                              <span style={{ fontSize: '13px', fontWeight: '600' }}>{mov.nota} <span style={{ color: '#a3a3a3', fontWeight: '500' }}>({mov.data?.substring(0,4)})</span></span>
                              <span style={{ fontSize: '13px', fontWeight: '800' }}>€ {Number(mov.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                )}

                {pannelloAperto === 'crea' && (
                  <div style={{ marginTop: '15px', padding: '15px', background: '#fafafa', borderRadius: '12px', border: '1px dashed #d4d4d4' }}>
                    {supportaOcr && (
                      <div style={{ marginBottom: '15px', padding: '12px', background: '#fff', borderRadius: '10px', border: '1px solid #e5e5e5' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto', gap: '10px', alignItems: 'end', marginBottom: risultatoOcr ? '12px' : 0 }}>
                          <div>
                            <label style={styles.label}>FORNITORE (opzionale, migliora i suggerimenti nel tempo)</label>
                            <input type="text" value={fornitore} onChange={e => setFornitore(e.target.value)} style={styles.input} placeholder="es. Enel, TIM..." />
                          </div>
                          <button onClick={estraiDatiAutomaticamente} disabled={estraendoOcr} style={{ ...styles.btn('#4f46e5'), width: 'auto', opacity: estraendoOcr ? 0.6 : 1, cursor: estraendoOcr ? 'default' : 'pointer' }}>
                            {estraendoOcr ? <Loader2 size={16} className="lucide-spin" /> : <ScanText size={16} />}
                            {estraendoOcr ? 'Analisi in corso...' : 'Estrai dati automaticamente'}
                          </button>
                        </div>

                        {risultatoOcr && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {risultatoOcr.candidatiImporto.length > 0 && (
                              <div>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#a3a3a3' }}>IMPORTI TROVATI (clicca quello giusto):</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                  {risultatoOcr.candidatiImporto.slice(0, 5).map((c, i) => (
                                    <span key={i} title={c.contesto} onClick={() => scegliCandidatoImporto(c)}
                                          style={{ padding: '4px 10px', background: '#eef2ff', color: '#4f46e5', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                      € {c.valore.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {risultatoOcr.candidatiData.length > 0 && (
                              <div>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#a3a3a3' }}>DATE TROVATE (clicca quella giusta):</span>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                  {risultatoOcr.candidatiData.slice(0, 5).map((c, i) => (
                                    <span key={i} title={c.contesto} onClick={() => scegliCandidatoData(c)}
                                          style={{ padding: '4px 10px', background: '#eef2ff', color: '#4f46e5', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                      {c.valore.split('-').reverse().join('/')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '90px 120px 150px 1fr', gap: '12px', marginBottom: '15px' }}>
                      <div>
                        <label style={styles.label}>ANNO</label>
                        <select value={nuovoRecord.anno} onChange={e => setNuovoRecord({ ...nuovoRecord, anno: e.target.value, data: `${e.target.value}-01-01` })} style={styles.input}>
                          {config.anniAttivi?.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={styles.label}>IMPORTO (€)</label>
                        <input type="number" value={nuovoRecord.importo} onChange={e => setNuovoRecord({ ...nuovoRecord, importo: e.target.value })} style={styles.input} />
                      </div>
                      <div>
                        <label style={styles.label}>DATA</label>
                        <input type="date" min={`${nuovoRecord.anno}-01-01`} max={`${nuovoRecord.anno}-12-31`} value={nuovoRecord.data} onChange={e => setNuovoRecord({ ...nuovoRecord, data: e.target.value })} style={styles.input} />
                      </div>
                      <div>
                        <label style={styles.label}>NOME</label>
                        <input type="text" value={nuovoRecord.nota} onChange={e => setNuovoRecord({ ...nuovoRecord, nota: e.target.value })} style={styles.input} placeholder="Descrizione del record..." />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                      <span style={styles.label}>SELEZIONA TAG:</span>
                      {['entrata', 'uscita', 'neutro'].map(tipo => (
                        <div key={tipo} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', fontWeight: '700', color: '#a3a3a3', width: '55px' }}>{tipo.toUpperCase()}</span>
                          {config?.tags?.filter(t => t.tipo === tipo).map(t => (
                            <div key={t.nome} onClick={() => toggleTagNuovoRecord(t.nome)}
                                 style={{
                                   padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
                                   background: nuovoRecord.tags.includes(t.nome) ? (tipo === 'entrata' ? '#10b981' : tipo === 'uscita' ? '#ef4444' : '#737373') : '#fff',
                                   color: nuovoRecord.tags.includes(t.nome) ? '#fff' : '#737373', border: '1px solid #e5e5e5',
                                   display: 'flex', alignItems: 'center', gap: '4px'
                                 }}>
                              <Tag size={10} style={{ opacity: 0.4 }} />
                              {t.nome.toUpperCase()}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>

                    <button onClick={confermaCreaRecord} style={{ ...styles.btn(config.coloreTema), width: 'auto' }}>
                      <Check size={16}/> Crea Record
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
