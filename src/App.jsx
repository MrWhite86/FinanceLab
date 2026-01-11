/* FinanceLab - Versione Integrale 0.11
   Focus: Categorie Neutre (Documentali) + Toggle a 3 Vie + Fix UI
*/

import React, { useState, useEffect, useMemo } from 'react';
import * as Lucide from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend 
} from 'recharts';

export default function App() {
  const [activeTab, setActiveTab] = useState('impostazioni');
  const [viewMode, setViewMode] = useState('dati');

  const initialConfig = {
    saldoStatoZero: 10000,
    dataStatoZero: '2024-01-01',
    coloreTema: '#4f46e5',
    percorsoSalvataggio: '/Users/marcellobianco/Documents/FinanceLab',
    categorie: [
      { nome: "stipendio", tipo: "entrata" },
      { nome: "affitto", tipo: "uscita" },
      { nome: "documenti", tipo: "neutro" }
    ],
    anniAttivi: ['2026', '2025', '2024']
  };

  const [config, setConfig] = useState(() => {
    try {
      const salvata = localStorage.getItem('finance_lab_config');
      return salvata ? { ...initialConfig, ...JSON.parse(salvata) } : initialConfig;
    } catch (e) { return initialConfig; }
  });

  const [spese, setSpese] = useState(() => {
    try {
      const salvate = localStorage.getItem('finance_lab_data');
      return salvate ? JSON.parse(salvate) : [];
    } catch (e) { return []; }
  });

  const [nuovaSpesa, setNuovaSpesa] = useState({ importo: '', categoria: '', data: '', nota: '', allegato: null });
  const [nuovaCat, setNuovaCat] = useState('');
  const [catSelezionateAnalisi, setCatSelezionateAnalisi] = useState([]);
  const [bloccaPercorso, setBloccaPercorso] = useState(true);

  useEffect(() => {
    localStorage.setItem('finance_lab_config', JSON.stringify(config));
    localStorage.setItem('finance_lab_data', JSON.stringify(spese));
  }, [config, spese]);

  // Adatta automaticamente il percorso se ci spostiamo su Windows o un altro PC
  useEffect(() => {
    const rilevaPercorsoOS = async () => {
      // Se il percorso è ancora quello "hardcoded" del Mac, lo aggiorniamo
      if (config.percorsoSalvataggio.includes('/Users/marcellobianco')) {
        try {
          const { documentDir, join } = await import('@tauri-apps/api/path');
          const docPath = await documentDir();
          const nuovoPercorso = await join(docPath, 'FinanceLab');
          setConfig(prev => ({ ...prev, percorsoSalvataggio: nuovoPercorso }));
        } catch (e) { console.warn("Impossibile rilevare percorso documenti:", e); }
      }
    };
    rilevaPercorsoOS();
  }, []);

  const listaAnni = useMemo(() => {
    const anniDaiDati = Array.isArray(spese) ? spese.map(s => s?.data?.substring(0, 4)).filter(Boolean) : [];
    const anniConfig = Array.isArray(config?.anniAttivi) ? config.anniAttivi : [];
    return Array.from(new Set([...anniConfig, ...anniDaiDati])).sort((a, b) => b - a);
  }, [spese, config]);

  const aggiungiAnno = () => {
    const nuovoAnno = prompt("Inserisci l'anno (es. 2027):");
    if (nuovoAnno && /^\d{4}$/.test(nuovoAnno)) {
      if (!config.anniAttivi.includes(nuovoAnno)) {
        setConfig(prev => ({ ...prev, anniAttivi: [...(prev.anniAttivi || []), nuovoAnno] }));
      }
      setActiveTab(nuovoAnno);
    }
  };

  const rimuoviAnno = (anno) => {
    if (spese.some(m => m.data.startsWith(anno))) {
      alert("L'anno contiene dati. Svitalo prima di rimuoverlo.");
      return;
    }
    if (window.confirm(`Rimuovere l'anno ${anno}?`)) {
      setConfig(prev => ({ ...prev, anniAttivi: prev.anniAttivi.filter(a => a !== anno) }));
      if (activeTab === anno) setActiveTab('impostazioni');
    }
  };

  const movimentiAnno = useMemo(() => (spese || []).filter(m => m?.data?.startsWith(activeTab)), [spese, activeTab]);

  const saldoAttuale = useMemo(() => {
    let base = Number(config?.saldoStatoZero || 0);
    (spese || []).forEach(m => {
      if (m?.data >= config?.dataStatoZero) {
        const c = config?.categorie?.find(cat => cat.nome === m.categoria);
        if (c?.tipo === 'entrata') base += Number(m.importo);
        if (c?.tipo === 'uscita') base -= Number(m.importo);
        // I neutri vengono ignorati
      }
    });
    return base;
  }, [spese, config]);

  const datiPatrimonioMese = useMemo(() => {
    const mesi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    let tot = Number(config?.saldoStatoZero || 0);
    (spese || []).filter(m => m?.data < `${activeTab}-01-01` && m?.data >= config?.dataStatoZero).forEach(m => {
      const c = config?.categorie?.find(cat => cat.nome === m.categoria);
      if (c?.tipo === 'entrata') tot += Number(m.importo);
      if (c?.tipo === 'uscita') tot -= Number(m.importo);
    });

    return mesi.map((m, i) => {
      const mStr = (i + 1).toString().padStart(2, '0');
      movimentiAnno.filter(mov => mov?.data?.substring(5,7) === mStr).forEach(mov => {
        const c = config?.categorie?.find(cat => cat.nome === mov.categoria);
        if (c?.tipo === 'entrata') tot += Number(mov.importo);
        if (c?.tipo === 'uscita') tot -= Number(mov.importo);
      });
      return { name: m, Valore: tot };
    });
  }, [movimentiAnno, config, activeTab, spese]);

  const datiAnalisiEtichette = useMemo(() => {
    const mesi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    return mesi.map((m, i) => {
      const mStr = (i + 1).toString().padStart(2, '0');
      const obj = { name: m };
      catSelezionateAnalisi.forEach(cat => {
        const somma = movimentiAnno
          .filter(mov => mov?.data?.substring(5,7) === mStr && mov.categoria === cat)
          .reduce((acc, curr) => acc + Number(curr.importo), 0);
        obj[cat] = somma;
      });
      return obj;
    });
  }, [movimentiAnno, catSelezionateAnalisi]);

  const toggleTipoCategoria = (nome) => {
    const tipi = ['entrata', 'uscita', 'neutro'];
    const nuoveCat = config.categorie.map(c => {
      if (c.nome === nome) {
        const indexAttuale = tipi.indexOf(c.tipo || 'uscita');
        const prossimoIndex = (indexAttuale + 1) % tipi.length;
        return { ...c, tipo: tipi[prossimoIndex] };
      }
      return c;
    });
    setConfig({ ...config, categorie: nuoveCat });
  };

  const importaJSON = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        if (json.config) setConfig(json.config);
        if (json.spese) setSpese(json.spese);
        alert("Importazione riuscita!");
      } catch (err) { alert("File corrotto."); }
    };
    reader.readAsText(e.target.files[0]);
  };

  const backupCartella = async () => {
    try {
      // Import dinamico: funziona solo se @tauri-apps/api è installato e siamo in ambiente Tauri
      const { createDir } = await import('@tauri-apps/api/fs');
      const ts = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
      await createDir(`${config.percorsoSalvataggio}/backup_${ts}`, { recursive: true });
      alert(`Cartella di backup creata: backup_${ts}`);
    } catch (e) { 
      console.warn("Backup non disponibile o errore permessi:", e);
      alert("Funzionalità di backup disponibile solo in ambiente Desktop (Tauri) o permessi non sufficienti.");
    }
  };

  const s = {
    card: { background: '#ffffffff', borderRadius: '16px', padding: '25px', border: '1px solid #e2e8f0', marginBottom: '24px' },
    input: { padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', width: '80%', fontSize: '14px', outline: 'none' },
    label: { fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '6px', display: 'block' },
    btn: (bg, active=false) => ({ padding: '12px 16px', background: active ? config.coloreTema : bg, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }),
    th: (w, align='left') => ({ width: w, textAlign: align, padding: '15px 20px', color: '#64748b', fontSize: '11px', fontWeight: '800', borderBottom: '2px solid #f1f5f9' }),
    dot: (tipo) => ({
      width: '28px', height: '28px', borderRadius: '50%', border: 'none', color: '#fff', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '14px',
      background: tipo === 'entrata' ? '#10b981' : tipo === 'uscita' ? '#ef4444' : '#94a3b8'
    })
  };

  const COLORS = [config.coloreTema, '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
      
      {/* SIDEBAR */}
      <aside style={{ width: '280px', backgroundColor: '#0f172a', color: '#fff', position: 'fixed', height: '100vh', padding: '40px 20px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px', padding: '0 10px' }}>
          <Lucide.LayoutDashboard color={config.coloreTema} size={28} />
          <h1 style={{ fontSize: '18px', fontWeight: '900' }}>FinanceLab</h1>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={() => setActiveTab('impostazioni')} style={{ ...s.btn('transparent', activeTab === 'impostazioni'), width: '100%' }}><Lucide.Settings size={18}/> Impostazioni</button>
          <div style={{ padding: '25px 10px 10px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#475569', fontWeight: '800' }}>REGISTRI</span>
            <Lucide.PlusCircle size={18} color={config.coloreTema} cursor="pointer" onClick={aggiungiAnno}/>
          </div>
          {listaAnni.map(anno => (
            <div key={anno} style={{ display: 'flex', alignItems: 'center' }}>
              <button onClick={() => {setActiveTab(anno); setViewMode('dati');}} style={{ ...s.btn('transparent', activeTab === anno), width: '100%', fontSize: '13px' }}><Lucide.Calendar size={16}/> {anno}</button>
              <Lucide.Trash2 size={14} color="#334155" style={{cursor:'pointer', marginLeft:'-30px', marginRight:'15px'}} onClick={() => rimuoviAnno(anno)}/>
            </div>
          ))}
        </nav>
      </aside>

      <main style={{ marginLeft: '280px', width: 'calc(100% - 280px)', padding: '40px' }}>
        
        {/* SALDO COMPLESSIVO */}
        <div style={{ ...s.card, background: `linear-gradient(135deg, ${config.coloreTema}, #1e1b4b)`, border: 'none', color: '#fff' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', opacity: 0.8 }}>LIQUIDITÀ ATTUALE (ESCLUSI NEUTRI)</span>
          <h2 style={{ fontSize: '42px', fontWeight: '900', margin: '10px 0' }}>€ {saldoAttuale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</h2>
        </div>

        {activeTab === 'impostazioni' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={s.card}>
                <h3>Manutenzione Archivio</h3>
                <div style={{ marginBottom: '15px' }}>
                  <label style={s.label}>Percorso Salvataggio</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input type="text" value={config.percorsoSalvataggio} onChange={e => setConfig({ ...config, percorsoSalvataggio: e.target.value })} style={{ ...s.input, background: bloccaPercorso ? '#f1f5f9' : '#fff', color: bloccaPercorso ? '#94a3b8' : '#000', flex: 1 }} disabled={bloccaPercorso} />
                    <button onClick={() => setBloccaPercorso(!bloccaPercorso)} style={{background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color: bloccaPercorso ? '#94a3b8' : config.coloreTema, fontWeight:700, padding:0, whiteSpace: 'nowrap'}}>
                      {bloccaPercorso ? <Lucide.Lock size={18}/> : <Lucide.Unlock size={18}/>}
                      {bloccaPercorso ? 'Sblocca' : 'Blocca'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => {const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({config, spese})])); a.download="backup.json"; a.click();}} style={{...s.btn('#10b981'), flex:1, justifyContent:'center'}}><Lucide.Download size={18}/> Esporta</button>
                  <label style={{...s.btn('#475569'), cursor:'pointer', flex:1, justifyContent:'center'}}><Lucide.Upload size={18}/> Importa <input type="file" style={{display:'none'}} onChange={importaJSON}/></label>
                  <button onClick={backupCartella} style={{...s.btn('#f59e0b'), flex:1, justifyContent:'center'}}><Lucide.FolderArchive size={18}/> Backup Cartella</button>
                </div>
              </div>
              <div style={s.card}>
                <h3>Parametri Base</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div><label style={s.label}>Data Zero</label><input type="date" value={config.dataStatoZero} onChange={e=>setConfig({...config, dataStatoZero:e.target.value})} style={s.input}/></div>
                  <div><label style={s.label}>Capitale Iniziale</label><input type="number" value={config.saldoStatoZero} onChange={e=>setConfig({...config, saldoStatoZero:e.target.value})} style={s.input}/></div>
                  <div><label style={s.label}>Colore Tema</label><input type="color" value={config.coloreTema} onChange={e=>setConfig({...config, coloreTema:e.target.value})} style={{...s.input, height: '45px', padding: '4px', cursor: 'pointer'}}/></div>
                </div>
              </div>
            </div>

            <div style={s.card}>
              <h3>Configurazione Etichette e Flussi</h3>
              <p style={{fontSize: '13px', color: '#64748b', marginBottom: '20px'}}>Clicca sul cerchio per cambiare modalità: <b style={{color:'#10b981'}}>+ Entrata</b>, <b style={{color:'#ef4444'}}>- Uscita</b>, <b style={{color:'#94a3b8'}}>o Neutro (Documentale)</b></p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input type="text" value={nuovaCat} onChange={e=>setNuovaCat(e.target.value)} style={s.input} placeholder="Aggiungi categoria..."/>
                <button onClick={()=>{if(nuovaCat){setConfig({...config, categorie:[...config.categorie, {nome:nuovaCat.toLowerCase(), tipo:'uscita'}]}); setNuovaCat('')}}} style={{...s.btn(config.coloreTema), width:'auto'}}>Aggiungi</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {config?.categorie?.map(c => (
                  <div key={c.nome} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: '800', fontSize: '11px', color: '#1e293b' }}>{c.nome.toUpperCase()}</span>
                    <button 
                      onClick={() => toggleTipoCategoria(c.nome)} 
                      style={s.dot(c.tipo)}
                      title={`Tipo attuale: ${c.tipo}`}
                    >
                      {c.tipo === 'entrata' ? '+' : c.tipo === 'uscita' ? '-' : 'o'}
                    </button>
                    <Lucide.Trash2 size={14} color="#cbd5e1" cursor="pointer" onClick={()=>setConfig({...config, categorie: config.categorie.filter(x=>x.nome!==c.nome)})}/>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
              <h2 style={{ fontWeight: '900', fontSize: '26px' }}>Gestione {activeTab}</h2>
              <div style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
                <button onClick={() => setViewMode('dati')} style={{ padding: '8px 24px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', background: viewMode === 'dati' ? '#fff' : 'transparent', color: viewMode === 'dati' ? config.coloreTema : '#64748b' }}>DATI</button>
                <button onClick={() => setViewMode('grafici')} style={{ padding: '8px 24px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', background: viewMode === 'grafici' ? '#fff' : 'transparent', color: viewMode === 'grafici' ? config.coloreTema : '#64748b' }}>ANALISI</button>
              </div>
            </div>

            {viewMode === 'grafici' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                <div style={{ ...s.card, height: '400px' }}>
                  <h4 style={s.label}>Patrimonio Netto Mensile</h4>
                  <ResponsiveContainer width="100%" height="90%">
                    <AreaChart data={datiPatrimonioMese}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                      <XAxis dataKey="name" axisLine={false} tickLine={false}/>
                      <YAxis axisLine={false} tickLine={false}/>
                      <Tooltip />
                      <Area type="monotone" dataKey="Valore" stroke={config.coloreTema} fill={config.coloreTema} fillOpacity={0.08} strokeWidth={4} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={s.card}>
                  <h4 style={s.label}>Confronto Voci Selezionate</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                    {config?.categorie?.map((c, idx) => (
                      <button key={c.nome} onClick={() => setCatSelezionateAnalisi(prev => prev.includes(c.nome) ? prev.filter(x=>x!==c.nome) : [...prev, c.nome])}
                        style={{ padding: '8px 14px', borderRadius: '20px', border: 'none', fontSize: '10px', fontWeight: '800', cursor: 'pointer', background: catSelezionateAnalisi.includes(c.nome) ? COLORS[idx % COLORS.length] : '#f1f5f9', color: catSelezionateAnalisi.includes(c.nome) ? '#fff' : '#64748b' }}>
                        {c.nome.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div style={{ height: '350px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={datiAnalisiEtichette}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip/><Legend/>
                        {catSelezionateAnalisi.map((cat, idx) => (<Line key={cat} type="monotone" dataKey={cat} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={{r:4}}/>))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={s.card}>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 150px 180px 1fr 40px 120px', gap: '15px', alignItems: 'end' }}>
                    <div><label style={s.label}>Importo (€)</label><input type="number" value={nuovaSpesa.importo} onChange={e=>setNuovaSpesa({...nuovaSpesa, importo:e.target.value})} style={s.input}/></div>
                    <div><label style={s.label}>Data</label><input type="date" min={`${activeTab}-01-01`} max={`${activeTab}-12-31`} value={nuovaSpesa.data} onChange={e=>setNuovaSpesa({...nuovaSpesa, data:e.target.value})} style={s.input}/></div>
                    <div><label style={s.label}>Etichetta</label>
                      <select value={nuovaSpesa.categoria} onChange={e=>setNuovaSpesa({...nuovaSpesa, categoria:e.target.value})} style={s.input}>
                        <option value="">Scegli...</option>
                        {config?.categorie?.map(c=><option key={c.nome} value={c.nome}>{c.nome.toUpperCase()} ({c.tipo})</option>)}
                      </select>
                    </div>
                    <div><label style={s.label}>Nota</label><input type="text" value={nuovaSpesa.nota} onChange={e=>setNuovaSpesa({...nuovaSpesa, nota:e.target.value})} style={s.input}/></div>
                    <label style={{textAlign:'center', cursor:'pointer'}}><Lucide.Paperclip size={24} color={nuovaSpesa.allegato?config.coloreTema:'#cbd5e1'}/><input type="file" style={{display:'none'}} onChange={e=>setNuovaSpesa({...nuovaSpesa, allegato:e.target.files[0]?.name})}/></label>
                    <button onClick={()=>{
                      if(!nuovaSpesa.importo || !nuovaSpesa.categoria) return;
                      setSpese([...spese, {...nuovaSpesa, id:Date.now(), importo: Number(nuovaSpesa.importo)}]);
                      setNuovaSpesa({importo:'', categoria:'', data:`${activeTab}-01-01`, nota:'', allegato:null});
                    }} style={{...s.btn(config.coloreTema), width:'auto'}}>REGISTRA</button>
                  </div>
                </div>

                <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc' }}>
                      <tr><th style={s.th('15%')}>Data</th><th style={s.th('20%')}>Categoria</th><th style={s.th('45%')}>Dettagli</th><th style={s.th('20%', 'right')}>Importo</th></tr>
                    </thead>
                    <tbody>
                      {movimentiAnno.sort((a,b)=>b.data.localeCompare(a.data)).map(mov => {
                        const info = config?.categorie?.find(c=>c.nome===mov.categoria);
                        return (
                          <tr key={mov.id} style={{ borderBottom: '1px solid #f1f5f9', background: info?.tipo === 'neutro' ? '#fcfcfc' : 'white' }}>
                            <td style={{ padding: '16px 20px', fontSize:'13px' }}>{new Intl.DateTimeFormat('it-IT').format(new Date(mov.data))}</td>
                            <td style={{ padding: '16px 20px' }}>
                              <span style={{ padding: '4px 10px', borderRadius: '6px', background: info?.tipo === 'neutro' ? '#e2e8f0' : '#f1f5f9', fontSize: '10px', fontWeight: '800' }}>{mov.categoria?.toUpperCase()}</span>
                            </td>
                            <td style={{ padding: '16px 20px', fontSize:'14px' }}>
                              <div style={{fontWeight:600}}>{mov.nota}</div>
                              {mov.allegato && <div style={{fontSize:'10px', color:'#94a3b8'}}><Lucide.FileText size={10}/> {config.percorsoSalvataggio}/{activeTab}/{mov.categoria}/{mov.allegato}</div>}
                            </td>
                            <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '900', color: info?.tipo==='entrata'?'#10b981': info?.tipo==='uscita' ? '#1e293b' : '#94a3b8' }}>
                              {info?.tipo === 'neutro' ? 'FILE' : `€ ${Number(mov.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}