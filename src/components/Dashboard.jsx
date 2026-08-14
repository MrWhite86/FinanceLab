// DashboardView è il componente più corposo dell'app: gestisce tutto quello che riguarda
// UN singolo registro annuale (quello selezionato nella Sidebar). Ha due modalità (viewMode),
// selezionabili con i pulsanti "DATI"/"ANALISI" in alto:
//   - 'dati': form per registrare un nuovo movimento + tabella di tutti i movimenti dell'anno,
//     con le sottovoci annidate sotto la rispettiva voce madre (vedi renderRiga più sotto).
//   - 'grafici': tre grafici (andamento tag personalizzato, patrimonio mensile, torta uscite)
//     con i dati già pronti da useFinance.js/App.jsx, passati tramite la prop datiGrafici.
// È caricato "lazy" da App.jsx (solo quando serve, non al primo avvio) perché importa
// recharts, una libreria di grafici pesante.
import { useState, useMemo, Fragment } from 'react';
import { BarChart2, BarChart3, Check, FileText, Paperclip, PieChart as PieChartIcon, Plus, Tag, Trash2, TrendingUp, X } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';

/** Tooltip Personalizzato Dark Glassmorphism per Grafici: sostituisce quello di default di recharts, usato da tutti e 3 i grafici a linee/barre. */
const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        padding: '14px 18px',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
        border: '1px solid #334155',
        fontSize: '13px',
        minWidth: '180px'
      }}>
        <div style={{ fontWeight: '800', marginBottom: '8px', color: '#94a3b8', borderBottom: '1px solid #334155', paddingBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Mese di {label}
        </div>
        {payload.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', margin: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, display: 'inline-block' }} />
              <span style={{ fontWeight: '600', color: '#f8fafc' }}>{item.name}</span>
            </div>
            <span style={{ fontWeight: '800', color: '#fff' }}>
              € {Number(item.value).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        {payload.length > 1 && (
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', fontWeight: '900', color: '#60a5fa', fontSize: '12px' }}>
            <span>TOTALE MESE</span>
            <span>€ {total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

/** Formattatore compatto per i numeri sull'asse Y */
const formatYAxis = (num) => {
  if (Math.abs(num) >= 1000000) return `€ ${(num / 1000000).toFixed(1)}M`;
  if (Math.abs(num) >= 1000) return `€ ${(num / 1000).toFixed(0)}k`;
  return `€ ${num}`;
};

/** Formattatore percentuali per le fette del PieChart */
const renderCustomPieLabel = ({ name, percent }) => {
  if (!percent || percent < 0.04) return null; // Non mostra etichette per fette < 4%
  return `${name} ${(percent * 100).toFixed(0)}%`;
};

/**
 * DashboardView: Gestisce il registro di un anno specifico.
 * Include il form di registrazione, i grafici di analisi personalizzata per tag e la tabella dei movimenti.
 */
export default function DashboardView({ anno, speseAnno, config, styles, colors, datiGrafici, onAddSpesa, onUpdateSpesa, onRemoveSpesa, onAllegaFile, topTags, showToast, isMobile }) {
  /** 'dati' (tabella + form) oppure 'grafici' (analisi): decide cosa mostrare sotto l'header. */
  const [viewMode, setViewMode] = useState('dati');

  /** Stato locale del form "nuovo movimento" in cima alla tabella. */
  const [nuovaSpesa, setNuovaSpesa] = useState({ importo: '', tags: [], data: `${anno}-01-01`, nota: '', allegato: null, valoreSecondario: '', etichettaSecondaria: '' });
  /** Mostra/nasconde i campi per il valore secondario (es. lordo), escluso da saldo e grafici */
  const [showValoreSecondario, setShowValoreSecondario] = useState(false);
  // Selezione multipla in tabella (checkbox) + tag scelti dalla libreria, per applicarli in blocco
  // alle righe selezionate (bottone "APPLICA ORA"). animatedRowId dà un breve lampeggio alla riga
  // appena modificata, cosi' l'utente vede subito quale movimento e' stato aggiornato.
  const [selectedLibraryTags, setSelectedLibraryTags] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [animatedRowId, setAnimatedRowId] = useState(null);

  /** Modalità di visualizzazione grafico (Linee vs Barre) */
  const [chartType, setChartType] = useState('line'); // 'line' | 'bar'

  /** Tutti i nomi di tag disponibili nelle impostazioni */
  const allAvailableTagNames = useMemo(() => (config?.tags || []).map(t => t.nome), [config.tags]);

  /** Righe di primo livello (le sottovoci non vengono mostrate come righe indipendenti, ma annidate sotto la madre) */
  const topLevelSpese = useMemo(() => (speseAnno || []).filter(m => !m.contenitoreId), [speseAnno]);

  /** Per ogni voce madre, le sottovoci collegate (usate per il rendering annidato e il totale categorizzato) */
  const figliPerGenitore = useMemo(() => {
    const map = {};
    (speseAnno || []).forEach(m => {
      if (m.contenitoreId) {
        if (!map[m.contenitoreId]) map[m.contenitoreId] = [];
        map[m.contenitoreId].push(m);
      }
    });
    return map;
  }, [speseAnno]);

  // --- SOTTOVOCI (pulsante "+" su una riga: es. un prelievo suddiviso in più spese) ---
  /** id della voce madre il cui form inline "aggiungi sottovoce" è aperto; null se nessuna riga è espansa. Una sola alla volta. */
  const [rigaApertaPerSottovoce, setRigaApertaPerSottovoce] = useState(null);
  /** Stato del mini-form inline per la nuova sottovoce (vedi renderRiga/tabella più sotto). */
  const [nuovaSottovoce, setNuovaSottovoce] = useState({ importo: '', data: '', nota: '', tags: [] });

  /** Click sul "+" di una riga: apre (o chiude, se già aperto) il form inline sotto quella riga, precompilando la data con quella della voce madre. */
  const apriFormSottovoce = (mov) => {
    if (rigaApertaPerSottovoce === mov.id) { setRigaApertaPerSottovoce(null); return; }
    setRigaApertaPerSottovoce(mov.id);
    setNuovaSottovoce({ importo: '', data: mov.data, nota: '', tags: [] });
  };

  /** Seleziona/deseleziona un tag nel mini-form della sottovoce (a differenza del form principale, qui il tag è facoltativo). */
  const toggleSottovoceTag = (tagName) => {
    setNuovaSottovoce(prev => ({
      ...prev,
      tags: prev.tags.includes(tagName) ? prev.tags.filter(t => t !== tagName) : [...prev.tags, tagName]
    }));
  };

  /**
   * Salva la sottovoce collegandola alla voce madre tramite contenitoreId.
   * Importante: contenitoreId è ciò che dice a useFinance.js di NON contare questo importo
   * nel saldo (già contato una volta sulla voce madre) - vedi commenti in useFinance.js.
   */
  const registraSottovoce = (parentId) => {
    if (!nuovaSottovoce.nota.trim()) return showToast("Il campo Nome è obbligatorio");
    if (nuovaSottovoce.data < `${anno}-01-01` || nuovaSottovoce.data > `${anno}-12-31`) return showToast(`La data deve essere compresa nel ${anno}`);
    if (!(Number.isFinite(Number(nuovaSottovoce.importo)) && Number(nuovaSottovoce.importo) > 0)) return showToast("Inserisci un importo valido");

    onAddSpesa({ ...nuovaSottovoce, importo: Number(nuovaSottovoce.importo), contenitoreId: parentId });
    setRigaApertaPerSottovoce(null);
    setNuovaSottovoce({ importo: '', data: '', nota: '', tags: [] });
  };

  /** Tag scelti dall'utente per l'analisi grafica dell'andamento (grafico "Andamento Tag Personalizzati"); parte da topTags (i tag più usati, calcolati da useFinance.js) come suggerimento iniziale. */
  const [selectedTagsForAnalysis, setSelectedTagsForAnalysis] = useState(() => {
    if (topTags && topTags.length > 0) return topTags.slice(0, 3);
    return allAvailableTagNames.slice(0, 3);
  });

  /** Aggiunge/rimuove un tag dall'analisi cliccando il suo badge colorato. */
  const toggleAnalysisTag = (tagName) => {
    setSelectedTagsForAnalysis(prev => 
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  /** Seleziona solo tag di un tipo specifico (uscita, entrata, ecc.) */
  const selectTagsByType = (tipo) => {
    const matching = (config?.tags || []).filter(t => t.tipo === tipo).map(t => t.nome);
    setSelectedTagsForAnalysis(matching);
  };

  /** Calcolo dei dati mensili (Gen-Dic) per i soli tag selezionati dall'utente */
  const datiAndamentoTag = useMemo(() => {
    const mesi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    return mesi.map((m, i) => {
      const mStr = (i + 1).toString().padStart(2, '0');
      const obj = { name: m };
      selectedTagsForAnalysis.forEach(cat => {
        const somma = (speseAnno || [])
          .filter(mov => mov?.data?.substring(5, 7) === mStr && (mov.tags || []).includes(cat))
          .reduce((acc, curr) => acc + Number(curr.importo), 0);
        obj[cat] = somma;
      });
      return obj;
    });
  }, [speseAnno, selectedTagsForAnalysis]);

  /** KPI riassuntivi (Totale annuo e Media mensile) per ciascun tag selezionato */
  const riassuntoTagSelezionati = useMemo(() => {
    return selectedTagsForAnalysis.map(cat => {
      const tagInfo = config.tags?.find(t => t.nome === cat);
      const totale = (speseAnno || [])
        .filter(mov => (mov.tags || []).includes(cat))
        .reduce((acc, curr) => acc + Number(curr.importo), 0);
      const mediaMensile = totale / 12;
      return { nome: cat, tipo: tagInfo?.tipo || 'uscita', totale, mediaMensile };
    });
  }, [speseAnno, selectedTagsForAnalysis, config.tags]);

  /** Calcolo totale uscite anno per il centro del PieChart */
  const totaleUsciteAnno = useMemo(() => {
    return (datiGrafici?.torta?.uscite || []).reduce((acc, item) => acc + (item.value || 0), 0);
  }, [datiGrafici?.torta?.uscite]);

  /**
   * Click su un tag nella sezione "SELEZIONA TAG" del form principale: fa doppio lavoro,
   * lo aggiunge/rimuove sia dal nuovo movimento in costruzione (nuovaSpesa.tags) sia dalla
   * "libreria" di tag da applicare in blocco alle righe selezionate (selectedLibraryTags) -
   * due funzioni diverse che condividono la stessa interazione per semplicità di interfaccia.
   */
  const toggleTag = (tagName) => {
    setSelectedLibraryTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
    setNuovaSpesa(prev => ({
      ...prev,
      tags: prev.tags.includes(tagName) ? prev.tags.filter(t => t !== tagName) : [...prev.tags, tagName]
    }));
  };

  /** Applica tutti i tag selezionati dalla libreria a tutte le righe selezionate con le checkbox (bottone "APPLICA ORA"). */
  const applyTagsToSelected = () => {
    if (selectedLibraryTags.length === 0 || selectedRows.length === 0) return;
    
    selectedRows.forEach(rowId => {
      const spesa = speseAnno.find(s => String(s.id) === String(rowId));
      if (spesa) {
        const currentTags = spesa.tags || [];
        const newTags = selectedLibraryTags.filter(t => !currentTags.includes(t));
        if (newTags.length > 0) {
          onUpdateSpesa(rowId, { tags: [...currentTags, ...newTags] });
          setAnimatedRowId(rowId);
        }
      }
    });
    
    showToast(`${selectedLibraryTags.length} tag applicati a ${selectedRows.length} record.`);
    setSelectedRows([]);
    setSelectedLibraryTags([]);
    setTimeout(() => setAnimatedRowId(null), 600);
  };

  /** Converte una data ISO (2026-03-15, formato usato internamente per poterle ordinare/confrontare come stringhe) nel formato italiano gg/mm/aaaa per la tabella. */
  const formatDataIT = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h2 style={{ fontWeight: '900', fontSize: '26px' }}>Gestione {anno}</h2>
        <div style={{ display: 'flex', background: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
          <button onClick={() => setViewMode('dati')} style={{ padding: '8px 24px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', background: viewMode === 'dati' ? '#fff' : 'transparent', color: viewMode === 'dati' ? config.coloreTema : '#64748b' }}>DATI</button>
          <button onClick={() => setViewMode('grafici')} style={{ padding: '8px 24px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', background: viewMode === 'grafici' ? '#fff' : 'transparent', color: viewMode === 'grafici' ? config.coloreTema : '#64748b' }}>ANALISI</button>
        </div>
      </div>

      {/* ===== VISTA "ANALISI" (grafici) ===== */}
      {viewMode === 'grafici' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          {/* Card: Selettore Tag e Grafico di Andamento Personalizzato */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>Andamento Tag Personalizzati</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Seleziona i tag per tracciarne e confrontarne l&rsquo;evoluzione mensile</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Switch Tipo Grafico (Linee vs Barre) */}
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <button 
                    onClick={() => setChartType('line')}
                    style={{ padding: '5px 12px', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', background: chartType === 'line' ? '#fff' : 'transparent', color: chartType === 'line' ? config.coloreTema : '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <TrendingUp size={14} /> Linee
                  </button>
                  <button 
                    onClick={() => setChartType('bar')}
                    style={{ padding: '5px 12px', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', background: chartType === 'bar' ? '#fff' : 'transparent', color: chartType === 'bar' ? config.coloreTema : '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <BarChart3 size={14} /> Barre
                  </button>
                </div>

                {/* Filtri Rapidi Tag */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    onClick={() => selectTagsByType('uscita')}
                    style={{ padding: '5px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '10px', fontWeight: '800', cursor: 'pointer', color: '#ef4444' }}
                  >
                    Solo Uscite
                  </button>
                  <button 
                    onClick={() => selectTagsByType('entrata')}
                    style={{ padding: '5px 10px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '8px', fontSize: '10px', fontWeight: '800', cursor: 'pointer', color: '#10b981' }}
                  >
                    Solo Entrate
                  </button>
                  <button 
                    onClick={() => setSelectedTagsForAnalysis(allAvailableTagNames)}
                    style={{ padding: '5px 10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '10px', fontWeight: '800', cursor: 'pointer', color: '#475569' }}
                  >
                    Tutti
                  </button>
                  <button 
                    onClick={() => setSelectedTagsForAnalysis([])}
                    style={{ padding: '5px 10px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '10px', fontWeight: '800', cursor: 'pointer', color: '#475569' }}
                  >
                    Nessuno
                  </button>
                </div>
              </div>
            </div>

            {/* Badge Interattivi dei Tag Raggruppati per Tipo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
              {['uscita', 'entrata', 'neutro'].map(tipo => {
                const tagsByTipo = config?.tags?.filter(t => t.tipo === tipo) || [];
                if (tagsByTipo.length === 0) return null;

                return (
                  <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '9px', fontWeight: '900', color: tipo === 'entrata' ? '#10b981' : tipo === 'uscita' ? '#ef4444' : '#64748b', width: '65px', textTransform: 'uppercase' }}>
                      {tipo}
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                      {tagsByTipo.map(t => {
                        const isSelected = selectedTagsForAnalysis.includes(t.nome);
                        const colorIndex = selectedTagsForAnalysis.indexOf(t.nome);
                        const strokeColor = colorIndex !== -1 ? colors[colorIndex % colors.length] : (tipo === 'entrata' ? '#10b981' : tipo === 'uscita' ? '#ef4444' : '#64748b');

                        return (
                          <div
                            key={t.nome}
                            onClick={() => toggleAnalysisTag(t.nome)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s',
                              background: isSelected ? strokeColor : '#ffffff',
                              color: isSelected ? '#ffffff' : '#64748b',
                              border: `2px solid ${isSelected ? strokeColor : '#e2e8f0'}`,
                              boxShadow: isSelected ? `0 2px 8px ${strokeColor}40` : 'none',
                              transform: isSelected ? 'scale(1.03)' : 'scale(1)'
                            }}
                          >
                            <Tag size={12} style={{ opacity: isSelected ? 0.9 : 0.4 }} />
                            {t.nome.toUpperCase()}
                            {isSelected && <Check size={12} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Grafico (Linee o Barre) o Messaggio Stato Vuoto */}
            {selectedTagsForAnalysis.length === 0 ? (
              <div style={{ padding: '50px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                <BarChart2 size={40} color="#94a3b8" style={{ marginBottom: '12px' }} />
                <p style={{ margin: 0, fontWeight: '800', fontSize: '15px', color: '#1e293b' }}>Nessun tag selezionato</p>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Seleziona uno o più tag in alto per visualizzare l&rsquo;andamento nel grafico.</span>
              </div>
            ) : (
              <>
                <div style={{ height: '360px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'line' ? (
                      <LineChart data={datiAndamentoTag} margin={{ top: 15, right: 25, left: 15, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} fontWeight={600} />
                        <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickFormatter={formatYAxis} width={60} />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', fontWeight: '700' }} />
                        {selectedTagsForAnalysis.map((tag, idx) => (
                          <Line
                            key={tag}
                            type="monotone"
                            dataKey={tag}
                            name={tag.toUpperCase()}
                            stroke={colors[idx % colors.length]}
                            strokeWidth={3}
                            dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                            activeDot={{ r: 7 }}
                          />
                        ))}
                      </LineChart>
                    ) : (
                      <BarChart data={datiAndamentoTag} margin={{ top: 15, right: 25, left: 15, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} fontWeight={600} />
                        <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickFormatter={formatYAxis} width={60} />
                        <Tooltip content={<CustomChartTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '12px', fontWeight: '700' }} />
                        {selectedTagsForAnalysis.map((tag, idx) => (
                          <Bar
                            key={tag}
                            dataKey={tag}
                            name={tag.toUpperCase()}
                            fill={colors[idx % colors.length]}
                            radius={[6, 6, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Micro KPI per i Tag Selezionati */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '14px', marginTop: '25px' }}>
                  {riassuntoTagSelezionati.map((item, idx) => (
                    <div 
                      key={item.nome}
                      style={{ 
                        padding: '14px 18px', 
                        background: '#f8fafc', 
                        borderRadius: '12px', 
                        borderLeft: `5px solid ${colors[idx % colors.length]}`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b' }}>{item.nome.toUpperCase()}</span>
                        <span style={{ fontSize: '9px', fontWeight: '900', padding: '2px 6px', borderRadius: '4px', background: item.tipo === 'entrata' ? '#d1fae5' : item.tipo === 'uscita' ? '#fee2e2' : '#e2e8f0', color: item.tipo === 'entrata' ? '#10b981' : item.tipo === 'uscita' ? '#ef4444' : '#64748b' }}>
                          {item.tipo.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', margin: '6px 0' }}>
                        € {item.totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </div>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                        Media: € {item.mediaMensile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}/mese
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Griglia a 2 Colonne: Patrimonio Netto + Ripartizione Uscite */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Card Patrimonio Netto */}
            <div style={{ ...styles.card, height: '400px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: 0, fontWeight: '800', fontSize: '16px', color: '#1e293b' }}>Patrimonio Netto Mensile</h4>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Evoluzione cumulativa della liquidità nel corso del {anno}</span>
              </div>
              <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={datiGrafici.patrimonio} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                    <XAxis dataKey="name" fontSize={11} stroke="#64748b" fontWeight={600} />
                    <YAxis fontSize={11} stroke="#64748b" fontWeight={600} tickFormatter={formatYAxis} width={60} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area type="monotone" dataKey="Valore" name="Patrimonio" stroke={config.coloreTema} fill={config.coloreTema} fillOpacity={0.15} strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Card Ripartizione Uscite */}
            <div style={{ ...styles.card, height: '400px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontWeight: '800', fontSize: '16px', color: '#1e293b' }}>Ripartizione Uscite per Tag</h4>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Suddivisione percentuale delle spese dell&rsquo;anno</span>
                </div>
                {totaleUsciteAnno > 0 && (
                  <span style={{ fontSize: '12px', fontWeight: '800', padding: '4px 10px', background: '#fee2e2', color: '#ef4444', borderRadius: '8px' }}>
                    Tot: € {totaleUsciteAnno.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                  </span>
                )}
              </div>

              {datiGrafici?.torta?.uscite?.length > 0 ? (
                <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={datiGrafici.torta.uscite}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={4}
                        dataKey="value"
                        label={renderCustomPieLabel}
                        labelLine={false}
                      >
                        {datiGrafici.torta.uscite.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke="#ffffff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`€ ${Number(value).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 'Importo Totale']} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: '700', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <PieChartIcon size={40} style={{ marginBottom: '10px' }} />
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Nessuna spesa registrata per il {anno}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ===== VISTA "DATI" (form nuovo movimento + tabella) ===== */
        <>
          <div style={styles.card}>
            {/* Riga principale del form: importo/data/nome + bottone REGISTRA, che valida tutto prima di chiamare onAddSpesa.
                Su mobile le colonne fisse (120/150/1fr/120px) sforerebbero la larghezza dello schermo: si impila su una colonna. */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '120px 150px 1fr 120px', gap: '15px', alignItems: 'end', marginBottom: '15px' }}>
              <div><label style={styles.label}>IMPORTO (€)</label><input type="number" value={nuovaSpesa.importo} onChange={e=>setNuovaSpesa({...nuovaSpesa, importo:e.target.value})} style={styles.input}/></div>
              <div><label style={styles.label}>DATA</label><input type="date" min={`${anno}-01-01`} max={`${anno}-12-31`} value={nuovaSpesa.data} onChange={e=>setNuovaSpesa({...nuovaSpesa, data:e.target.value})} style={styles.input}/></div>
              <div><label style={styles.label}>NOME</label><input type="text" value={nuovaSpesa.nota} onChange={e=>setNuovaSpesa({...nuovaSpesa, nota:e.target.value})} style={styles.input} placeholder="Descrizione del record..."/></div>
              <button onClick={() => {
                if (!nuovaSpesa.nota.trim()) return showToast("Il campo Nome è obbligatorio");
                if (nuovaSpesa.data < `${anno}-01-01` || nuovaSpesa.data > `${anno}-12-31`) return showToast(`La data deve essere compresa nel ${anno}`);
                if (!(Number.isFinite(Number(nuovaSpesa.importo)) && Number(nuovaSpesa.importo) > 0)) return showToast("Inserisci un importo valido");
                if (nuovaSpesa.tags.length === 0) return showToast("Seleziona almeno un tag");
                if (showValoreSecondario && nuovaSpesa.valoreSecondario !== '' && !(Number.isFinite(Number(nuovaSpesa.valoreSecondario)) && Number(nuovaSpesa.valoreSecondario) >= 0)) return showToast("Inserisci un valore secondario valido");

                const movimento = { ...nuovaSpesa };
                if (!showValoreSecondario || movimento.valoreSecondario === '') {
                  delete movimento.valoreSecondario;
                  delete movimento.etichettaSecondaria;
                } else {
                  movimento.valoreSecondario = Number(movimento.valoreSecondario);
                  if (!movimento.etichettaSecondaria.trim()) movimento.etichettaSecondaria = 'Secondario';
                }
                onAddSpesa(movimento);
                setNuovaSpesa({ importo: '', tags: [], data: `${anno}-01-01`, nota: '', allegato: null, valoreSecondario: '', etichettaSecondaria: '' });
                setShowValoreSecondario(false);
                setSelectedLibraryTags([]);
              }} style={{...styles.btn(config.coloreTema), width:'auto'}}>REGISTRA</button>
            </div>

            {!showValoreSecondario ? (
              <button
                onClick={() => setShowValoreSecondario(true)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, marginBottom: '15px' }}
              >
                <Plus size={12} /> AGGIUNGI VALORE SECONDARIO (es. lordo, non conta nel saldo)
              </button>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '150px 1fr 30px', gap: '15px', alignItems: 'end', marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <div>
                  <label style={styles.label}>VALORE SECONDARIO (€)</label>
                  <input type="number" value={nuovaSpesa.valoreSecondario} onChange={e => setNuovaSpesa({ ...nuovaSpesa, valoreSecondario: e.target.value })} style={styles.input} placeholder="0.00" />
                </div>
                <div>
                  <label style={styles.label}>ETICHETTA (es. Lordo)</label>
                  <input type="text" value={nuovaSpesa.etichettaSecondaria} onChange={e => setNuovaSpesa({ ...nuovaSpesa, etichettaSecondaria: e.target.value })} style={styles.input} placeholder="Lordo" />
                </div>
                <X
                  size={18}
                  color="#94a3b8"
                  style={{ cursor: 'pointer', marginBottom: '12px' }}
                  onClick={() => { setShowValoreSecondario(false); setNuovaSpesa({ ...nuovaSpesa, valoreSecondario: '', etichettaSecondaria: '' }); }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={styles.label}>SELEZIONA TAG:</span>
              {['entrata', 'uscita', 'neutro'].map(tipo => (
                <div key={tipo} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', fontWeight: '900', color: '#94a3b8', width: '60px' }}>{tipo.toUpperCase()}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {config?.tags?.filter(t => t.tipo === tipo).map(t => (
                      <div 
                        key={t.nome} 
                        onClick={() => toggleTag(t.nome)}
                        style={{ 
                          padding: '4px 10px', 
                          borderRadius: '8px', 
                          border: selectedLibraryTags.includes(t.nome) ? `2px solid ${config.coloreTema}` : '1px solid #e2e8f0', 
                          fontSize: '10px', 
                          fontWeight: '700', 
                          cursor: 'pointer', 
                          background: nuovaSpesa.tags.includes(t.nome) ? (tipo === 'entrata' ? '#10b981' : tipo === 'uscita' ? '#ef4444' : '#64748b') : '#fff', 
                          color: nuovaSpesa.tags.includes(t.nome) ? '#fff' : '#64748b',
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: selectedLibraryTags.includes(t.nome) ? `0 0 10px ${config.coloreTema}40` : 'none',
                          transform: selectedLibraryTags.includes(t.nome) ? 'scale(1.05)' : 'scale(1)'
                        }}
                      >
                        <Tag size={10} style={{ opacity: 0.4 }} />
                        {t.nome.toUpperCase()}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {selectedLibraryTags.length > 0 && selectedRows.length > 0 && (
              <div style={{ marginTop: '20px', padding: '15px', background: `${config.coloreTema}10`, borderRadius: '12px', border: `1px solid ${config.coloreTema}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: config.coloreTema }}>
                  Associa {selectedLibraryTags.length} tag a {selectedRows.length} record selezionati
                </span>
                <button onClick={applyTagsToSelected} style={styles.btn(config.coloreTema)}>APPLICA ORA</button>
              </div>
            )}
          </div>

          {/*
            Tabella dei movimenti dell'anno. Struttura a due livelli:
            - si itera solo su topLevelSpese (le voci madri, senza contenitoreId);
            - per ognuna, renderRiga() disegna la sua riga, poi quella di ogni sua sottovoce
              (rientrata, senza checkbox ne' pulsante "+"), poi eventualmente il mini-form
              inline per aggiungerne una nuova, se l'utente ha cliccato "+" su quella riga.
            Il checkbox "seleziona tutto" nell'header conta solo le righe di primo livello,
            coerentemente con le uniche checkbox realmente visibili in tabella.
          */}
          <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={styles.th('40px')}><input type="checkbox" checked={topLevelSpese.length > 0 && selectedRows.length === topLevelSpese.length} onChange={(e) => setSelectedRows(e.target.checked ? topLevelSpese.map(s => s.id) : [])} /></th>
                  <th style={styles.th('12%')}>Data</th>
                  <th style={styles.th('20%')}>Tag</th>
                  <th style={styles.th('38%')}>Dettagli</th>
                  <th style={styles.th('15%', 'right')}>Importo</th>
                  <th style={styles.th('110px')}></th>
                </tr>
              </thead>
              <tbody>
                {topLevelSpese.map(mov => {
                  const figli = figliPerGenitore[mov.id] || [];
                  const haFigli = figli.length > 0;
                  const categorizzato = figli.reduce((s, f) => s + Number(f.importo), 0);
                  const superaTotale = haFigli && categorizzato > Number(mov.importo);

                  /** Disegna UNA riga (madre o sottovoce): isFiglio nasconde checkbox/pulsante "+" e aggiunge il rientro visivo con "↳". */
                  const renderRiga = (riga, isFiglio) => {
                    const tagInfos = (riga.tags || []).map(tn => config.tags?.find(t => t.nome === tn)).filter(Boolean);
                    const isEntrata = tagInfos.some(t => t.tipo === 'entrata');
                    const isUscita = tagInfos.some(t => t.tipo === 'uscita');
                    const isNeutro = tagInfos.some(t => t.tipo === 'neutro');
                    const amountColor = isEntrata ? '#10b981' : (isUscita ? '#ef4444' : '#1e293b');

                    return (
                      <tr key={riga.id}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'all 0.2s',
                            backgroundColor: isNeutro ? '#fcfcfc' : 'transparent',
                            boxShadow: animatedRowId === riga.id ? `0 0 0 3px ${config.coloreTema}80` : 'none'
                          }}>
                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                          {!isFiglio && <input type="checkbox" checked={selectedRows.includes(riga.id)} onChange={() => setSelectedRows(prev => prev.includes(riga.id) ? prev.filter(id => id !== riga.id) : [...prev, riga.id])} />}
                        </td>
                        <td style={{ padding: '16px 20px', paddingLeft: isFiglio ? '40px' : '20px' }}>{formatDataIT(riga.data)}</td>
                        <td style={{ padding: '16px 20px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {riga.tags?.map(t => (
                            <span key={t}
                              onClick={() => onUpdateSpesa(riga.id, { tags: riga.tags.filter(tag => tag !== t) })}
                              title="Clicca per rimuovere questo tag"
                              style={{ padding: '4px 8px', background: '#f1f5f9', borderRadius: '6px', fontSize: '10px', fontWeight: '800', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}>
                              {t.toUpperCase()}
                              <X size={10} />
                            </span>
                          ))}
                          {isFiglio && (!riga.tags || riga.tags.length === 0) && (
                            <span style={{ fontSize: '10px', color: '#cbd5e1', fontStyle: 'italic' }}>Nessun tag</span>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{fontWeight: isFiglio ? 500 : 600, display: 'flex', alignItems: 'center', gap: '8px'}}>
                            {isFiglio && <span style={{ color: '#cbd5e1' }}>↳</span>}
                            {riga.nota}
                          </div>
                          {riga.allegato && <div style={{fontSize:'10px', color:'#94a3b8'}} title="Percorso reale del file copiato da allegaFile"><FileText size={10}/> {config.percorsoSalvataggio}/backup/{anno}/{riga.allegato}</div>}
                          {riga.valoreSecondario != null && (
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', marginTop: '2px' }} title="Valore informativo, non incluso in saldo e grafici">
                              {(riga.etichettaSecondaria || 'Secondario').toUpperCase()}: € {Number(riga.valoreSecondario).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                          {!isFiglio && haFigli && (
                            <div style={{ fontSize: '10px', fontWeight: '700', marginTop: '2px', color: superaTotale ? '#ef4444' : '#64748b' }}>
                              € {categorizzato.toLocaleString('it-IT', { minimumFractionDigits: 2 })} categorizzati su € {Number(riga.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                              {superaTotale && ' — supera il totale!'}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '900', color: amountColor }}>€ {Number(riga.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            {/* Allega file: copia il file scelto in percorsoSalvataggio/backup/<anno del record>/ (solo versione Desktop) */}
                            <Paperclip
                              size={16}
                              color={riga.allegato ? '#10b981' : '#94a3b8'}
                              style={{ cursor: 'pointer' }}
                              title={riga.allegato ? `Allegato: ${riga.allegato} (clicca per sostituirlo)` : 'Allega un file'}
                              onClick={() => onAllegaFile(riga)}
                            />
                            {!isFiglio && (
                              <Plus size={16} color={config.coloreTema} style={{ cursor: 'pointer' }} title="Aggiungi una sottovoce" onClick={() => apriFormSottovoce(riga)} />
                            )}
                            {/* Cancellazione bloccata su una voce madre finché ha sottovoci: eviterebbe riferimenti orfani (contenitoreId che punta a un id non più esistente) */}
                            <Trash2 size={16} color="#cbd5e1" style={{ cursor: 'pointer' }} onClick={() => {
                              if (!isFiglio && haFigli) return showToast("Questa voce ha sottovoci collegate: rimuovile prima di eliminarla.");
                              onRemoveSpesa(riga.id);
                            }} />
                          </div>
                        </td>
                      </tr>
                    );
                  };

                  // Fragment (non un <tr> vero e proprio) perché una voce madre produce PIÙ righe
                  // di tabella consecutive: la sua riga, poi quella di ogni sottovoce, poi
                  // eventualmente il mini-form per aggiungerne un'altra.
                  return (
                    <Fragment key={mov.id}>
                      {renderRiga(mov, false)}
                      {figli.map(figlio => renderRiga(figlio, true))}
                      {rigaApertaPerSottovoce === mov.id && (
                        // Mini-form inline "aggiungi sottovoce", aperto dal pulsante "+" su questa riga madre (vedi apriFormSottovoce)
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                          <td></td>
                          <td colSpan={5} style={{ padding: '14px 20px 18px 40px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '130px 130px 1fr auto auto', gap: '10px', alignItems: 'end' }}>
                              <div>
                                <label style={styles.label}>DATA</label>
                                <input type="date" min={`${anno}-01-01`} max={`${anno}-12-31`} value={nuovaSottovoce.data} onChange={e => setNuovaSottovoce({ ...nuovaSottovoce, data: e.target.value })} style={styles.input} />
                              </div>
                              <div>
                                <label style={styles.label}>IMPORTO (€)</label>
                                <input type="number" value={nuovaSottovoce.importo} onChange={e => setNuovaSottovoce({ ...nuovaSottovoce, importo: e.target.value })} style={styles.input} />
                              </div>
                              <div>
                                <label style={styles.label}>NOME</label>
                                <input type="text" value={nuovaSottovoce.nota} onChange={e => setNuovaSottovoce({ ...nuovaSottovoce, nota: e.target.value })} style={styles.input} placeholder="Descrizione della sottovoce..." />
                              </div>
                              <Check size={18} color="#10b981" style={{ cursor: 'pointer', marginBottom: '12px' }} title="Salva la sottovoce" onClick={() => registraSottovoce(mov.id)} />
                              <X size={18} color="#94a3b8" style={{ cursor: 'pointer', marginBottom: '12px' }} title="Annulla" onClick={() => setRigaApertaPerSottovoce(null)} />
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                              {(config?.tags || []).map(t => (
                                <div key={t.nome} onClick={() => toggleSottovoceTag(t.nome)}
                                  style={{
                                    padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
                                    background: nuovaSottovoce.tags.includes(t.nome) ? (t.tipo === 'entrata' ? '#10b981' : t.tipo === 'uscita' ? '#ef4444' : '#64748b') : '#fff',
                                    color: nuovaSottovoce.tags.includes(t.nome) ? '#fff' : '#64748b',
                                    border: '1px solid #e2e8f0'
                                  }}>
                                  {t.nome.toUpperCase()}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}