// DashboardView è il componente più corposo dell'app: gestisce tutto quello che riguarda
// UN singolo registro annuale (quello selezionato nella Sidebar). Ha due modalità (viewMode),
// selezionabili con i pulsanti "DATI"/"ANALISI" in alto:
//   - 'dati': form per registrare un nuovo movimento + tabella di tutti i movimenti dell'anno,
//     con le sottovoci annidate sotto la rispettiva voce madre (vedi renderRiga più sotto).
//   - 'grafici': tre grafici (andamento tag personalizzato, patrimonio mensile, torta uscite)
//     con i dati già pronti da useFinance.js/App.jsx, passati tramite la prop datiGrafici.
// È caricato "lazy" da App.jsx (solo quando serve, non al primo avvio) perché importa
// recharts, una libreria di grafici pesante.
import { useState, useMemo, useRef, Fragment } from 'react';
import { BarChart2, BarChart3, Calculator, Check, ChevronDown, ChevronRight, Eye, FileText, ListPlus, Paperclip, Pencil, PieChart as PieChartIcon, Plus, Tag, Trash2, TrendingUp, X } from 'lucide-react';
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
        border: '1px solid #404040',
        fontSize: '13px',
        minWidth: '180px'
      }}>
        <div style={{ fontWeight: '700', marginBottom: '8px', color: '#a3a3a3', borderBottom: '1px solid #404040', paddingBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Mese di {label}
        </div>
        {payload.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', margin: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, display: 'inline-block' }} />
              <span style={{ fontWeight: '600', color: '#fafafa' }}>{item.name}</span>
            </div>
            <span style={{ fontWeight: '800', color: '#fff' }}>
              € {Number(item.value).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
        {payload.length > 1 && (
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #404040', display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#60a5fa', fontSize: '12px' }}>
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
export default function DashboardView({ anno, speseAnno, config, styles, colors, datiGrafici, onAddSpesa, onUpdateSpesa, onRemoveSpesa, onAllegaFile, onApriAnteprima, topTags, showToast, isMobile }) {
  /** 'dati' (tabella + form) oppure 'grafici' (analisi): decide cosa mostrare sotto l'header. */
  const [viewMode, setViewMode] = useState('dati');

  /** Riferimento alla card del form, per riportarla in vista quando si inizia a modificare una riga lontana nella tabella. */
  const formCardRef = useRef(null);

  /** id della voce madre in fase di modifica (il form principale si riapre precompilato con i suoi dati), o null se si sta creando un nuovo movimento. */
  const [recordInModifica, setRecordInModifica] = useState(null);

  /** id delle righe con i dettagli extra (allegati, valore secondario, scadenza) espansi; per default tutto è compresso per non affollare la tabella. */
  const [righeEspanse, setRigheEspanse] = useState(() => new Set());
  const toggleEspansione = (id) => setRigheEspanse(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  /** Stato locale del form "nuovo movimento" in cima alla tabella. */
  const [nuovaSpesa, setNuovaSpesa] = useState({ importo: '', tags: [], data: `${anno}-01-01`, nota: '', allegato: null, valoreSecondario: '', etichettaSecondaria: '', scadenza: '', pagato: false });
  /** Mostra/nasconde i campi per il valore secondario (es. lordo), escluso da saldo e grafici */
  const [showValoreSecondario, setShowValoreSecondario] = useState(false);
  /** Mostra/nasconde il campo scadenza (es. garanzia, dichiarazione redditi) */
  const [showScadenza, setShowScadenza] = useState(false);
  /** Mostra/nasconde lo stato di pagamento (es. multe, bollette): quando attivo il record nasce "da pagare" */
  const [showPagato, setShowPagato] = useState(false);
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

  /** Data di oggi in formato ISO, per capire se una scadenza è già passata */
  const oggiISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
  /** id della voce madre il cui form inline "aggiungi/modifica sottovoce" è aperto; null se nessuna riga è espansa. Una sola alla volta. */
  const [rigaApertaPerSottovoce, setRigaApertaPerSottovoce] = useState(null);
  /** id della sottovoce in fase di modifica (il form inline si riapre precompilato con i suoi dati), o null se se ne sta creando una nuova. */
  const [sottovoceInModifica, setSottovoceInModifica] = useState(null);
  /** Stato del mini-form inline per la sottovoce (vedi renderRiga/tabella più sotto). */
  const [nuovaSottovoce, setNuovaSottovoce] = useState({ importo: '', data: '', nota: '', tags: [] });

  /** Click sul "+" di una riga: apre (o chiude, se già aperto in modalità "nuova") il form inline sotto quella riga, precompilando la data con quella della voce madre. Interrompe un'eventuale modifica in corso su un'altra sottovoce. */
  const apriFormSottovoce = (mov) => {
    if (rigaApertaPerSottovoce === mov.id && sottovoceInModifica === null) { setRigaApertaPerSottovoce(null); return; }
    setRigaApertaPerSottovoce(mov.id);
    setSottovoceInModifica(null);
    setNuovaSottovoce({ importo: '', data: mov.data, nota: '', tags: [] });
  };

  /** Click sulla matita di una sottovoce: riapre il form inline della voce madre, ma precompilato con i dati della sottovoce da modificare. */
  const iniziaModificaSottovoce = (figlio, genitoreId) => {
    setRigaApertaPerSottovoce(genitoreId);
    setSottovoceInModifica(figlio.id);
    setNuovaSottovoce({ importo: String(figlio.importo), data: figlio.data, nota: figlio.nota, tags: figlio.tags || [] });
  };

  /** Chiude il form inline sottovoce (nuova o in modifica) e lo riporta allo stato vuoto. */
  const chiudiFormSottovoce = () => {
    setRigaApertaPerSottovoce(null);
    setSottovoceInModifica(null);
    setNuovaSottovoce({ importo: '', data: '', nota: '', tags: [] });
  };

  /** Seleziona/deseleziona un tag nel mini-form della sottovoce (a differenza del form principale, qui il tag è facoltativo). */
  const toggleSottovoceTag = (tagName) => {
    setNuovaSottovoce(prev => ({
      ...prev,
      tags: prev.tags.includes(tagName) ? prev.tags.filter(t => t !== tagName) : [...prev.tags, tagName]
    }));
  };

  /**
   * Salva la sottovoce (nuova, oppure aggiorna quella in modifica) collegandola alla voce madre
   * tramite contenitoreId. Importante: contenitoreId è ciò che dice a useFinance.js di NON contare
   * questo importo nel saldo (già contato una volta sulla voce madre) - vedi commenti in useFinance.js.
   */
  const registraSottovoce = (parentId) => {
    if (!nuovaSottovoce.nota.trim()) return showToast("Il campo Nome è obbligatorio");
    if (nuovaSottovoce.data < `${anno}-01-01` || nuovaSottovoce.data > `${anno}-12-31`) return showToast(`La data deve essere compresa nel ${anno}`);
    if (!(Number.isFinite(Number(nuovaSottovoce.importo)) && Number(nuovaSottovoce.importo) > 0)) return showToast("Inserisci un importo valido");

    const campi = { importo: Number(nuovaSottovoce.importo), data: nuovaSottovoce.data, nota: nuovaSottovoce.nota, tags: nuovaSottovoce.tags };
    if (sottovoceInModifica) {
      onUpdateSpesa(sottovoceInModifica, campi);
      showToast("Sottovoce aggiornata!");
    } else {
      onAddSpesa({ ...campi, contenitoreId: parentId });
    }
    chiudiFormSottovoce();
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

  /** KPI riassuntivi (Totale e Media) sui valori secondari (es. lordo, IVA...), raggruppati per etichetta. */
  const riassuntoValoriSecondari = useMemo(() => {
    const gruppi = {};
    (speseAnno || []).forEach(mov => {
      if (mov.valoreSecondario == null) return;
      const etichetta = mov.etichettaSecondaria || 'Secondario';
      if (!gruppi[etichetta]) gruppi[etichetta] = { totale: 0, conteggio: 0 };
      gruppi[etichetta].totale += Number(mov.valoreSecondario);
      gruppi[etichetta].conteggio += 1;
    });
    return Object.entries(gruppi).map(([etichetta, { totale, conteggio }]) => ({
      etichetta, totale, conteggio, media: totale / conteggio
    }));
  }, [speseAnno]);

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

  /** Riporta il form principale allo stato di "nuovo movimento" vuoto, uscendo da un'eventuale modifica in corso. */
  const annullaModifica = () => {
    setRecordInModifica(null);
    setNuovaSpesa({ importo: '', tags: [], data: `${anno}-01-01`, nota: '', allegato: null, valoreSecondario: '', etichettaSecondaria: '', scadenza: '', pagato: false });
    setShowValoreSecondario(false);
    setShowScadenza(false);
    setShowPagato(false);
  };

  /**
   * Click sulla matita di una voce madre: precompila il form principale con i suoi dati (invece
   * di crearne uno vuoto) e lo riporta in vista, cosi' si può modificare un record esistente
   * senza doverlo cancellare e ricreare da zero. Il salvataggio vero e proprio (onUpdateSpesa
   * invece di onAddSpesa) avviene nel bottone REGISTRA/SALVA MODIFICHE, che controlla recordInModifica.
   */
  const iniziaModifica = (riga) => {
    setRecordInModifica(riga.id);
    setNuovaSpesa({
      importo: String(riga.importo),
      tags: riga.tags || [],
      data: riga.data,
      nota: riga.nota,
      allegato: null,
      valoreSecondario: riga.valoreSecondario != null ? String(riga.valoreSecondario) : '',
      etichettaSecondaria: riga.etichettaSecondaria || '',
      scadenza: riga.scadenza || '',
      pagato: riga.pagato ?? false,
    });
    setShowValoreSecondario(riga.valoreSecondario != null);
    setShowScadenza(!!riga.scadenza);
    setShowPagato(riga.pagato !== undefined);
    setSelectedLibraryTags([]);
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h2 style={{ fontWeight: '800', fontSize: '26px' }}>Gestione {anno}</h2>
        <div style={{ display: 'flex', background: styles.bgSottile2, padding: '4px', borderRadius: '12px' }}>
          <button onClick={() => setViewMode('dati')} style={{ padding: '8px 24px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', background: viewMode === 'dati' ? styles.card.background : 'transparent', color: viewMode === 'dati' ? config.coloreTema : '#737373' }}>DATI</button>
          <button onClick={() => setViewMode('grafici')} style={{ padding: '8px 24px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', background: viewMode === 'grafici' ? styles.card.background : 'transparent', color: viewMode === 'grafici' ? config.coloreTema : '#737373' }}>ANALISI</button>
        </div>
      </div>

      {/* ===== VISTA "ANALISI" (grafici) ===== */}
      {viewMode === 'grafici' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          {/* Card: Selettore Tag e Grafico di Andamento Personalizzato */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: styles.testo }}>Andamento Tag Personalizzati</h3>
                <span style={{ fontSize: '12px', color: '#737373' }}>Seleziona i tag per tracciarne e confrontarne l&rsquo;evoluzione mensile</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Switch Tipo Grafico (Linee vs Barre) */}
                <div style={{ display: 'flex', background: styles.bgSottile2, padding: '3px', borderRadius: '10px', border: `1px solid ${styles.border}` }}>
                  <button 
                    onClick={() => setChartType('line')}
                    style={{ padding: '5px 12px', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', background: chartType === 'line' ? styles.card.background : 'transparent', color: chartType === 'line' ? config.coloreTema : '#737373', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <TrendingUp size={14} /> Linee
                  </button>
                  <button 
                    onClick={() => setChartType('bar')}
                    style={{ padding: '5px 12px', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', background: chartType === 'bar' ? styles.card.background : 'transparent', color: chartType === 'bar' ? config.coloreTema : '#737373', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <BarChart3 size={14} /> Barre
                  </button>
                </div>

                {/* Filtri Rapidi Tag */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    onClick={() => selectTagsByType('uscita')}
                    style={{ padding: '5px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', color: '#ef4444' }}
                  >
                    Solo Uscite
                  </button>
                  <button 
                    onClick={() => selectTagsByType('entrata')}
                    style={{ padding: '5px 10px', background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '8px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', color: '#10b981' }}
                  >
                    Solo Entrate
                  </button>
                  <button 
                    onClick={() => setSelectedTagsForAnalysis(allAvailableTagNames)}
                    style={{ padding: '5px 10px', background: styles.bgSottile2, border: `1px solid ${styles.borderForte}`, borderRadius: '8px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', color: styles.testoMuto }}
                  >
                    Tutti
                  </button>
                  <button 
                    onClick={() => setSelectedTagsForAnalysis([])}
                    style={{ padding: '5px 10px', background: styles.bgSottile2, border: `1px solid ${styles.borderForte}`, borderRadius: '8px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', color: styles.testoMuto }}
                  >
                    Nessuno
                  </button>
                </div>
              </div>
            </div>

            {/* Badge Interattivi dei Tag Raggruppati per Tipo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', padding: '16px', background: styles.bgSottile, borderRadius: '12px', border: `1px solid ${styles.border}` }}>
              {['uscita', 'entrata', 'neutro'].map(tipo => {
                const tagsByTipo = config?.tags?.filter(t => t.tipo === tipo) || [];
                if (tagsByTipo.length === 0) return null;

                return (
                  <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '9px', fontWeight: '700', color: tipo === 'entrata' ? '#10b981' : tipo === 'uscita' ? '#ef4444' : '#737373', width: '65px', textTransform: 'uppercase' }}>
                      {tipo}
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                      {tagsByTipo.map(t => {
                        const isSelected = selectedTagsForAnalysis.includes(t.nome);
                        const colorIndex = selectedTagsForAnalysis.indexOf(t.nome);
                        const strokeColor = colorIndex !== -1 ? colors[colorIndex % colors.length] : (tipo === 'entrata' ? '#10b981' : tipo === 'uscita' ? '#ef4444' : '#737373');

                        return (
                          <div
                            key={t.nome}
                            onClick={() => toggleAnalysisTag(t.nome)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s',
                              background: isSelected ? strokeColor : styles.card.background,
                              color: isSelected ? '#ffffff' : '#737373',
                              border: `2px solid ${isSelected ? strokeColor : styles.border}`,
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
              <div style={{ padding: '50px 20px', textAlign: 'center', background: styles.bgSottile, borderRadius: '12px', border: `1px dashed ${styles.borderForte}`, color: '#737373' }}>
                <BarChart2 size={40} color="#a3a3a3" style={{ marginBottom: '12px' }} />
                <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: styles.testo }}>Nessun tag selezionato</p>
                <span style={{ fontSize: '12px', color: '#737373' }}>Seleziona uno o più tag in alto per visualizzare l&rsquo;andamento nel grafico.</span>
              </div>
            ) : (
              <>
                <div style={{ height: '360px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'line' ? (
                      <LineChart data={datiAndamentoTag} margin={{ top: 15, right: 25, left: 15, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={styles.border} />
                        <XAxis dataKey="name" stroke="#737373" fontSize={12} fontWeight={600} />
                        <YAxis stroke="#737373" fontSize={11} fontWeight={600} tickFormatter={formatYAxis} width={60} />
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
                            dot={{ r: 4, strokeWidth: 2, fill: styles.card.background }}
                            activeDot={{ r: 7 }}
                          />
                        ))}
                      </LineChart>
                    ) : (
                      <BarChart data={datiAndamentoTag} margin={{ top: 15, right: 25, left: 15, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={styles.border} />
                        <XAxis dataKey="name" stroke="#737373" fontSize={12} fontWeight={600} />
                        <YAxis stroke="#737373" fontSize={11} fontWeight={600} tickFormatter={formatYAxis} width={60} />
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
                        background: styles.bgSottile, 
                        borderRadius: '12px', 
                        borderLeft: `5px solid ${colors[idx % colors.length]}`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#737373' }}>{item.nome.toUpperCase()}</span>
                        <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: item.tipo === 'entrata' ? '#d1fae5' : item.tipo === 'uscita' ? '#fee2e2' : styles.bgSottile2, color: item.tipo === 'entrata' ? '#10b981' : item.tipo === 'uscita' ? '#ef4444' : '#737373' }}>
                          {item.tipo.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: '900', color: styles.testo, margin: '6px 0' }}>
                        € {item.totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </div>
                      <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: '600' }}>
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
                <h4 style={{ margin: 0, fontWeight: '700', fontSize: '16px', color: styles.testo }}>Patrimonio Netto Mensile</h4>
                <span style={{ fontSize: '12px', color: '#737373' }}>Evoluzione cumulativa della liquidità nel corso del {anno}</span>
              </div>
              <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={datiGrafici.patrimonio} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={styles.border}/>
                    <XAxis dataKey="name" fontSize={11} stroke="#737373" fontWeight={600} />
                    <YAxis fontSize={11} stroke="#737373" fontWeight={600} tickFormatter={formatYAxis} width={60} />
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
                  <h4 style={{ margin: 0, fontWeight: '700', fontSize: '16px', color: styles.testo }}>Ripartizione Uscite per Tag</h4>
                  <span style={{ fontSize: '12px', color: '#737373' }}>Suddivisione percentuale delle spese dell&rsquo;anno</span>
                </div>
                {totaleUsciteAnno > 0 && (
                  <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', background: '#fee2e2', color: '#ef4444', borderRadius: '8px' }}>
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
                          <Cell key={`cell-${index}`} fill={colors[index % colors.length]} stroke={styles.card.background} strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`€ ${Number(value).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 'Importo Totale']} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: '700', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#a3a3a3' }}>
                  <PieChartIcon size={40} style={{ marginBottom: '10px' }} />
                  <span style={{ fontSize: '13px', fontWeight: '600' }}>Nessuna spesa registrata per il {anno}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card: Riepilogo Valori Secondari (es. lordo, IVA...), raggruppati per etichetta */}
          {riassuntoValoriSecondari.length > 0 && (
            <div style={styles.card}>
              <div style={{ marginBottom: '15px' }}>
                <h4 style={{ margin: 0, fontWeight: '700', fontSize: '16px', color: styles.testo, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calculator size={16} color={config.coloreTema} /> Valori Secondari
                </h4>
                <span style={{ fontSize: '12px', color: '#737373' }}>Totale e media dei valori secondari registrati nel {anno}, raggruppati per etichetta</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '14px' }}>
                {riassuntoValoriSecondari.map((item, idx) => (
                  <div
                    key={item.etichetta}
                    style={{
                      padding: '14px 18px',
                      background: styles.bgSottile,
                      borderRadius: '12px',
                      borderLeft: `5px solid ${colors[idx % colors.length]}`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#737373' }}>{item.etichetta.toUpperCase()}</span>
                      <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: styles.bgSottile2, color: '#737373' }}>
                        {item.conteggio} {item.conteggio === 1 ? 'RECORD' : 'RECORDS'}
                      </span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: styles.testo, margin: '6px 0' }}>
                      € {item.totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </div>
                    <span style={{ fontSize: '11px', color: '#a3a3a3', fontWeight: '600' }}>
                      Media: € {item.media.toLocaleString('it-IT', { minimumFractionDigits: 2 })}/record
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ===== VISTA "DATI" (form nuovo movimento + tabella) ===== */
        <>
          <div style={styles.card} ref={formCardRef}>
            {recordInModifica && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 15px', marginBottom: '15px', background: `${config.coloreTema}10`, border: `1px solid ${config.coloreTema}`, borderRadius: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: config.coloreTema, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Pencil size={13} /> Stai modificando: {nuovaSpesa.nota || '...'}
                </span>
                <button onClick={annullaModifica} style={{ background: 'transparent', border: 'none', color: config.coloreTema, fontSize: '11px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}>
                  ANNULLA MODIFICA
                </button>
              </div>
            )}
            {/* Riga principale del form: importo/data/nome + bottone REGISTRA/SALVA MODIFICHE, che valida tutto prima di chiamare onAddSpesa o onUpdateSpesa.
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
                if (showScadenza && nuovaSpesa.scadenza !== '' && (nuovaSpesa.scadenza < nuovaSpesa.data)) return showToast("La scadenza non può essere precedente alla data del record");

                const haValoreSecondario = showValoreSecondario && nuovaSpesa.valoreSecondario !== '';
                const haScadenza = showScadenza && nuovaSpesa.scadenza !== '';
                // I campi assenti si passano come "undefined" (non si omettono con delete): in modifica,
                // onUpdateSpesa fa un merge {...vecchio, ...nuovo} e solo cosi' un campo tolto viene
                // davvero sovrascritto invece di restare con il valore precedente.
                const campi = {
                  importo: Number(nuovaSpesa.importo),
                  tags: nuovaSpesa.tags,
                  data: nuovaSpesa.data,
                  nota: nuovaSpesa.nota,
                  valoreSecondario: haValoreSecondario ? Number(nuovaSpesa.valoreSecondario) : undefined,
                  etichettaSecondaria: haValoreSecondario ? (nuovaSpesa.etichettaSecondaria.trim() || 'Secondario') : undefined,
                  scadenza: haScadenza ? nuovaSpesa.scadenza : undefined,
                  pagato: showPagato ? nuovaSpesa.pagato : undefined,
                };

                if (recordInModifica) {
                  onUpdateSpesa(recordInModifica, campi);
                  showToast("Movimento aggiornato!");
                } else {
                  onAddSpesa({ ...campi, allegato: null });
                }
                annullaModifica();
                setSelectedLibraryTags([]);
              }} style={{...styles.btn(config.coloreTema), width:'auto'}}>{recordInModifica ? 'SALVA MODIFICHE' : 'REGISTRA'}</button>
            </div>

            {!showValoreSecondario ? (
              <button
                onClick={() => setShowValoreSecondario(true)}
                style={{ background: 'transparent', border: 'none', color: '#737373', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, marginBottom: '15px' }}
              >
                <Plus size={12} /> AGGIUNGI VALORE SECONDARIO (es. lordo, non conta nel saldo)
              </button>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '150px 1fr 30px', gap: '15px', alignItems: 'end', marginBottom: '20px', padding: '15px', background: styles.bgSottile, borderRadius: '12px', border: `1px dashed ${styles.borderForte}` }}>
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
                  color="#a3a3a3"
                  style={{ cursor: 'pointer', marginBottom: '12px' }}
                  onClick={() => { setShowValoreSecondario(false); setNuovaSpesa({ ...nuovaSpesa, valoreSecondario: '', etichettaSecondaria: '' }); }}
                />
              </div>
            )}

            {!showScadenza ? (
              <button
                onClick={() => setShowScadenza(true)}
                style={{ background: 'transparent', border: 'none', color: '#737373', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, marginBottom: '15px' }}
              >
                <Plus size={12} /> AGGIUNGI SCADENZA (es. garanzia, dichiarazione redditi)
              </button>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '150px 30px', gap: '15px', alignItems: 'end', marginBottom: '20px', padding: '15px', background: styles.bgSottile, borderRadius: '12px', border: `1px dashed ${styles.borderForte}` }}>
                <div>
                  <label style={styles.label}>SCADE IL</label>
                  <input type="date" value={nuovaSpesa.scadenza} onChange={e => setNuovaSpesa({ ...nuovaSpesa, scadenza: e.target.value })} style={styles.input} />
                </div>
                <X
                  size={18}
                  color="#a3a3a3"
                  style={{ cursor: 'pointer', marginBottom: '12px' }}
                  onClick={() => { setShowScadenza(false); setNuovaSpesa({ ...nuovaSpesa, scadenza: '' }); }}
                />
              </div>
            )}

            {!showPagato ? (
              <button
                onClick={() => setShowPagato(true)}
                style={{ background: 'transparent', border: 'none', color: '#737373', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0, marginBottom: '15px' }}
              >
                <Plus size={12} /> TRACCIA STATO PAGAMENTO (es. multe, bollette)
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', padding: '15px', background: styles.bgSottile, borderRadius: '12px', border: `1px dashed ${styles.borderForte}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setNuovaSpesa({ ...nuovaSpesa, pagato: !nuovaSpesa.pagato })}>
                  <input type="checkbox" checked={nuovaSpesa.pagato} onChange={() => {}} style={{ cursor: 'pointer' }} />
                  <span style={{ fontSize: '13px', color: '#737373', fontWeight: '700' }}>{nuovaSpesa.pagato ? 'Pagato' : 'Da pagare'}</span>
                </div>
                <X
                  size={18}
                  color="#a3a3a3"
                  style={{ cursor: 'pointer', marginLeft: 'auto' }}
                  onClick={() => { setShowPagato(false); setNuovaSpesa({ ...nuovaSpesa, pagato: false }); }}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={styles.label}>SELEZIONA TAG:</span>
              {['entrata', 'uscita', 'neutro'].map(tipo => (
                <div key={tipo} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#a3a3a3', width: '60px' }}>{tipo.toUpperCase()}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {config?.tags?.filter(t => t.tipo === tipo).map(t => (
                      <div 
                        key={t.nome} 
                        onClick={() => toggleTag(t.nome)}
                        style={{ 
                          padding: '4px 10px', 
                          borderRadius: '8px', 
                          border: selectedLibraryTags.includes(t.nome) ? `2px solid ${config.coloreTema}` : `1px solid ${styles.border}`, 
                          fontSize: '10px', 
                          fontWeight: '700', 
                          cursor: 'pointer', 
                          background: nuovaSpesa.tags.includes(t.nome) ? (tipo === 'entrata' ? '#10b981' : tipo === 'uscita' ? '#ef4444' : '#737373') : styles.card.background, 
                          color: nuovaSpesa.tags.includes(t.nome) ? '#fff' : '#737373',
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
              <thead style={{ background: styles.bgSottile }}>
                <tr>
                  <th style={styles.th('40px')}><input type="checkbox" checked={topLevelSpese.length > 0 && selectedRows.length === topLevelSpese.length} onChange={(e) => setSelectedRows(e.target.checked ? topLevelSpese.map(s => s.id) : [])} /></th>
                  <th style={styles.th('12%')}>Data</th>
                  <th style={styles.th('20%')}>Tag</th>
                  <th style={styles.th('38%')}>Dettagli</th>
                  <th style={styles.th('15%', 'right')}>Importo</th>
                  <th style={styles.th('130px')}></th>
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
                    const amountColor = isEntrata ? '#10b981' : (isUscita ? '#ef4444' : styles.testo);
                    // riga.pagato è tracciato solo se l'utente ha usato "TRACCIA STATO PAGAMENTO" in creazione: undefined = non applicabile
                    const statoPagamentoTracciato = riga.pagato !== undefined;
                    const daPagare = riga.pagato === false;
                    const scadenzaPassata = riga.scadenza && riga.scadenza < oggiISO;
                    // Supporta anche il vecchio campo singolare "allegato" delle versioni precedenti dell'app
                    const allegati = riga.allegati || (riga.allegato ? [riga.allegato] : []);
                    // Dettagli "secondari": tenuti compressi di default (solo un riepilogo a chip) per non
                    // affollare la tabella quando un record accumula molte informazioni; espandibili a richiesta.
                    const haDettagliExtra = allegati.length > 0 || riga.valoreSecondario != null || !!riga.scadenza;
                    const espansa = righeEspanse.has(riga.id);

                    return (
                      <tr key={riga.id}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = daPagare ? '#fffbeb' : styles.bgSottile}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = daPagare ? '#fffbeb' : 'transparent'}
                          style={{
                            borderBottom: `1px solid ${styles.border}`,
                            borderLeft: daPagare ? '4px solid #f59e0b' : '4px solid transparent',
                            transition: 'all 0.2s',
                            backgroundColor: daPagare ? '#fffbeb' : (isNeutro ? '#fcfcfc' : 'transparent'),
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
                              style={{ padding: '4px 8px', background: styles.bgSottile2, borderRadius: '6px', fontSize: '10px', fontWeight: '700', color: '#737373', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#ef4444'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = styles.bgSottile2; e.currentTarget.style.color = '#737373'; }}>
                              {t.toUpperCase()}
                              <X size={10} />
                            </span>
                          ))}
                          {isFiglio && (!riga.tags || riga.tags.length === 0) && (
                            <span style={{ fontSize: '10px', color: styles.borderForte, fontStyle: 'italic' }}>Nessun tag</span>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{fontWeight: isFiglio ? 500 : 600, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'}}>
                            {haDettagliExtra && (
                              espansa
                                ? <ChevronDown size={13} color="#a3a3a3" style={{ cursor: 'pointer', flexShrink: 0 }} title="Comprimi dettagli" onClick={() => toggleEspansione(riga.id)} />
                                : <ChevronRight size={13} color="#a3a3a3" style={{ cursor: 'pointer', flexShrink: 0 }} title="Espandi dettagli" onClick={() => toggleEspansione(riga.id)} />
                            )}
                            {isFiglio && <span style={{ color: styles.borderForte }}>↳</span>}
                            {riga.nota}
                            {statoPagamentoTracciato && (
                              <span
                                onClick={() => onUpdateSpesa(riga.id, { pagato: !riga.pagato })}
                                title="Clicca per cambiare stato"
                                style={{
                                  fontSize: '9px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer',
                                  background: daPagare ? '#fef3c7' : '#d1fae5', color: daPagare ? '#b45309' : '#10b981'
                                }}
                              >
                                {daPagare ? 'DA PAGARE' : 'PAGATO'}
                              </span>
                            )}
                          </div>

                          {/* Riepilogo compatto: un colpo d'occhio su cosa c'è, senza impilare una riga di testo per ciascuno */}
                          {haDettagliExtra && !espansa && (
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '3px' }}>
                              {allegati.length > 0 && (
                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#a3a3a3', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <Paperclip size={10} /> {allegati.length}
                                </span>
                              )}
                              {riga.valoreSecondario != null && (
                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#a3a3a3' }}>
                                  {(riga.etichettaSecondaria || 'Secondario')}: € {Number(riga.valoreSecondario).toLocaleString('it-IT')}
                                </span>
                              )}
                              {riga.scadenza && (
                                <span style={{ fontSize: '10px', fontWeight: '700', color: scadenzaPassata ? '#ef4444' : '#b45309' }}>
                                  Scade {formatDataIT(riga.scadenza)}{scadenzaPassata && ' — scaduta!'}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Dettagli per esteso, solo quando la riga è espansa dal chevron qui sopra */}
                          {espansa && allegati.map(nomeFile => (
                            <div key={nomeFile} style={{fontSize:'10px', color:'#a3a3a3', display:'flex', alignItems:'center', gap:'4px', marginTop:'2px'}} title={`${config.percorsoSalvataggio}/backup/${anno}/${nomeFile}`}>
                              <FileText size={10}/> {nomeFile}
                              <Eye
                                size={11}
                                style={{ cursor: 'pointer' }}
                                title="Apri l'anteprima"
                                onClick={() => onApriAnteprima(riga, nomeFile)}
                              />
                              <X
                                size={10}
                                style={{ cursor: 'pointer' }}
                                title="Rimuovi il collegamento (il file copiato resta sul disco)"
                                onClick={() => onUpdateSpesa(riga.id, { allegati: allegati.filter(f => f !== nomeFile) })}
                              />
                            </div>
                          ))}
                          {espansa && riga.valoreSecondario != null && (
                            <div style={{ fontSize: '10px', color: '#a3a3a3', fontWeight: '700', marginTop: '2px' }} title="Valore informativo, non incluso in saldo e grafici">
                              {(riga.etichettaSecondaria || 'Secondario').toUpperCase()}: € {Number(riga.valoreSecondario).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </div>
                          )}
                          {espansa && riga.scadenza && (
                            <div style={{ fontSize: '10px', fontWeight: '700', marginTop: '2px', color: scadenzaPassata ? '#ef4444' : '#b45309' }}>
                              Scade: {formatDataIT(riga.scadenza)}{scadenzaPassata && ' — scaduta!'}
                            </div>
                          )}
                          {!isFiglio && haFigli && (
                            <div style={{ fontSize: '10px', fontWeight: '700', marginTop: '2px', color: superaTotale ? '#ef4444' : '#737373' }}>
                              € {categorizzato.toLocaleString('it-IT', { minimumFractionDigits: 2 })} categorizzati su € {Number(riga.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                              {superaTotale && ' — supera il totale!'}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '900', color: amountColor }}>€ {Number(riga.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {/* Modifica: riapre il form (principale per una voce madre, inline per una sottovoce) precompilato, per correggere un record senza doverlo ricreare. */}
                            <Pencil
                              size={15}
                              color="#a3a3a3"
                              style={{ cursor: 'pointer' }}
                              title="Modifica"
                              onClick={() => isFiglio ? iniziaModificaSottovoce(riga, mov.id) : iniziaModifica(riga)}
                            />
                            {/* Allega file: copia i file scelti in percorsoSalvataggio/backup/<anno del record>/ (solo versione Desktop). Si può cliccare più volte per accumulare altri allegati. */}
                            <Paperclip
                              size={15}
                              color={allegati.length > 0 ? '#10b981' : '#a3a3a3'}
                              style={{ cursor: 'pointer' }}
                              title={allegati.length > 0 ? `${allegati.length} allegato/i (clicca per aggiungerne altri)` : 'Allega uno o più file'}
                              onClick={() => onAllegaFile(riga)}
                            />
                            {!isFiglio && (
                              <ListPlus size={15} color={config.coloreTema} style={{ cursor: 'pointer' }} title="Aggiungi una sottovoce" onClick={() => apriFormSottovoce(riga)} />
                            )}
                            {/* Cancellazione bloccata su una voce madre finché ha sottovoci: eviterebbe riferimenti orfani (contenitoreId che punta a un id non più esistente) */}
                            <Trash2 size={15} color={styles.borderForte} style={{ cursor: 'pointer' }} onClick={() => {
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
                        // Mini-form inline sottovoce: aperto dal pulsante "+" (nuova) su questa riga madre,
                        // oppure dalla matita di una sottovoce esistente (sottovoceInModifica valorizzato)
                        <tr style={{ background: styles.bgSottile, borderBottom: `1px solid ${styles.border}` }}>
                          <td></td>
                          <td colSpan={5} style={{ padding: '14px 20px 18px 40px' }}>
                            {sottovoceInModifica && (
                              <div style={{ fontSize: '11px', fontWeight: '700', color: config.coloreTema, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                <Pencil size={12} /> Modifica sottovoce
                              </div>
                            )}
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
                              <X size={18} color="#a3a3a3" style={{ cursor: 'pointer', marginBottom: '12px' }} title="Annulla" onClick={chiudiFormSottovoce} />
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                              {(config?.tags || []).map(t => (
                                <div key={t.nome} onClick={() => toggleSottovoceTag(t.nome)}
                                  style={{
                                    padding: '4px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', cursor: 'pointer',
                                    background: nuovaSottovoce.tags.includes(t.nome) ? (t.tipo === 'entrata' ? '#10b981' : t.tipo === 'uscita' ? '#ef4444' : '#737373') : styles.card.background,
                                    color: nuovaSottovoce.tags.includes(t.nome) ? '#fff' : '#737373',
                                    border: `1px solid ${styles.border}`
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