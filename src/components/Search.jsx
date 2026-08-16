import { useState } from 'react';
import { Eye, FileText, Search, Tag, X } from 'lucide-react';

/**
 * SearchView: ricerca testuale su TUTTI i movimenti dell'utente, di tutti gli anni
 * (a differenza di Dashboard.jsx che mostra solo l'anno aperto). Il filtro vero e
 * proprio (speseFiltrate) è già calcolato da useFinance.js in base a searchTerm;
 * questo componente si occupa solo di mostrare i risultati e di un'azione in più:
 * selezionare più righe e applicarci in blocco uno o più tag della libreria.
 */
export default function SearchView({ searchTerm, setSearchTerm, speseFiltrate, config, styles, onUpdateSpesa, onApriAnteprima, showToast }) {
  const [selectedLibraryTags, setSelectedLibraryTags] = useState([]); // tag scelti dalla "libreria" da applicare in blocco
  const [selectedRows, setSelectedRows] = useState([]); // id dei movimenti selezionati con le checkbox
  const [animatedRowId, setAnimatedRowId] = useState(null); // id della riga appena aggiornata, per un breve effetto di evidenziazione

  /** Aggiunge tutti i tag selezionati (senza duplicarli) a tutte le righe selezionate, poi svuota le selezioni. */
  const applyTagsToSelected = () => {
    if (selectedLibraryTags.length === 0 || selectedRows.length === 0) return;
    
    selectedRows.forEach(rowId => {
      const spesa = speseFiltrate.find(s => String(s.id) === String(rowId));
      if (spesa) {
        const currentTags = spesa.tags || [];
        const newTags = selectedLibraryTags.filter(t => !currentTags.includes(t));
        if (newTags.length > 0) {
          onUpdateSpesa(rowId, { tags: [...currentTags, ...newTags] });
          setAnimatedRowId(rowId);
        }
      }
    });
    
    showToast(`Tag applicati con successo.`);
    setSelectedRows([]);
    setSelectedLibraryTags([]);
    setTimeout(() => setAnimatedRowId(null), 600);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ ...styles.card, marginBottom: 0 }}>
        <h2 style={{ fontWeight: '800', fontSize: '26px', marginBottom: '20px' }}>Ricerca nell&rsquo;Archivio</h2>
        <div style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '15px', top: '15px', color: '#a3a3a3' }} />
          <input 
            type="text" 
            placeholder="Cerca per nota, categoria o data (es: 2024)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...styles.input, width: '100%', paddingLeft: '50px', fontSize: '16px', boxSizing: 'border-box' }}
          />
          {searchTerm && (
            <X 
              size={20} 
              onClick={() => setSearchTerm('')} 
              style={{ position: 'absolute', right: '15px', top: '15px', color: '#a3a3a3', cursor: 'pointer' }} 
            />
          )}
        </div>
        
        {/* Libreria tag: cliccando qui si scelgono i tag da applicare in blocco; le checkbox
            in tabella sotto scelgono a quali movimenti applicarli (bottone "APPLICA AI SELEZIONATI") */}
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ ...styles.label, fontSize: '10px' }}>LIBRERIA TAG (Seleziona uno o più tag da associare):</span>
          {['entrata', 'uscita', 'neutro'].map(tipo => (
            <div key={tipo} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '8px', fontWeight: '700', color: '#a3a3a3', width: '50px' }}>{tipo.toUpperCase()}</span>
              {config?.tags?.filter(t => t.tipo === tipo).map(t => (
                <div 
                  key={t.nome} 
                  onClick={() => setSelectedLibraryTags(prev => prev.includes(t.nome) ? prev.filter(tag => tag !== t.nome) : [...prev, t.nome])}
                  style={{
                    padding: '4px 10px', background: styles.card.background,
                    border: selectedLibraryTags.includes(t.nome) ? `2px solid ${config.coloreTema}` : `1px solid ${styles.border}`,
                    borderRadius: '6px', fontSize: '10px', fontWeight: '700', color: config.coloreTema, 
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                    boxShadow: selectedLibraryTags.includes(t.nome) ? `0 0 8px ${config.coloreTema}40` : 'none'
                  }}
                >
                  <Tag size={10} style={{ opacity: 0.4 }} />
                  {t.nome.toUpperCase()}
                </div>
              ))}
            </div>
          ))}
        </div>

        {selectedLibraryTags.length > 0 && selectedRows.length > 0 && (
          <div style={{ marginTop: '20px', padding: '15px', background: `${config.coloreTema}10`, borderRadius: '12px', border: `1px solid ${config.coloreTema}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: config.coloreTema }}>
              Associa {selectedLibraryTags.length} tag a {selectedRows.length} record selezionati
            </span>
            <button onClick={applyTagsToSelected} style={styles.btn(config.coloreTema)}>APPLICA AI SELEZIONATI</button>
          </div>
        )}
      </div>

      <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: styles.bgSottile }}>
            <tr>
              <th style={styles.th('40px')}><input type="checkbox" checked={selectedRows.length === speseFiltrate.length && speseFiltrate.length > 0} onChange={(e) => setSelectedRows(e.target.checked ? speseFiltrate.map(s => s.id) : [])} /></th>
              <th style={styles.th('12%')}>Data</th><th style={styles.th('23%')}>Tag</th><th style={styles.th('40%')}>Dettagli</th><th style={styles.th('20%', 'right')}>Importo</th></tr>
          </thead>
          <tbody>
            {speseFiltrate.map(mov => {
              const tagInfos = (mov.tags || []).map(tn => config.tags?.find(t => t.nome === tn)).filter(Boolean);
              const isEntrata = tagInfos.some(t => t.tipo === 'entrata');
              const isUscita = tagInfos.some(t => t.tipo === 'uscita');
              const isNeutro = tagInfos.some(t => t.tipo === 'neutro');
              const amountColor = isEntrata ? '#10b981' : (isUscita ? '#ef4444' : styles.testo);
              // Supporta anche il vecchio campo singolare "allegato" delle versioni precedenti dell'app
              const allegati = mov.allegati || (mov.allegato ? [mov.allegato] : []);

              return (
                <tr key={mov.id}
                    style={{
                      borderBottom: `1px solid ${styles.border}`,
                      background: isNeutro ? styles.bgSottile : styles.card.background,
                      boxShadow: animatedRowId === mov.id ? `0 0 0 3px ${config.coloreTema}80` : 'none',
                      transition: 'all 0.2s'
                    }}>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedRows.includes(mov.id)} onChange={() => setSelectedRows(prev => prev.includes(mov.id) ? prev.filter(id => id !== mov.id) : [...prev, mov.id])} />
                  </td>
                  <td style={{ padding: '16px 20px', fontSize:'13px' }}>{new Intl.DateTimeFormat('it-IT').format(new Date(mov.data))}</td>
                  <td style={{ padding: '16px 20px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {mov.tags?.map(t => (
                      <span key={t} style={{ padding: '4px 8px', background: styles.bgSottile2, borderRadius: '6px', fontSize: '10px', fontWeight: '700', color: '#737373' }}>
                        {t.toUpperCase()}
                      </span>
                    ))}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize:'14px' }}>
                    <div style={{fontWeight:600}}>{mov.nota}</div>
                    {allegati.map(nomeFile => (
                      <div key={nomeFile} style={{fontSize:'10px', color:'#a3a3a3', display:'flex', alignItems:'center', gap:'4px', marginTop:'2px'}} title={`${config.percorsoSalvataggio}/backup/${mov.data.substring(0,4)}/${nomeFile}`}>
                        <FileText size={10}/> {nomeFile}
                        <Eye size={11} style={{ cursor: 'pointer' }} title="Apri l'anteprima" onClick={() => onApriAnteprima(mov, nomeFile)} />
                      </div>
                    ))}
                    {mov.valoreSecondario != null && (
                      <div style={{ fontSize: '10px', color: '#a3a3a3', fontWeight: '700', marginTop: '2px' }} title="Valore informativo, non incluso in saldo e grafici">
                        {(mov.etichettaSecondaria || 'Secondario').toUpperCase()}: € {Number(mov.valoreSecondario).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: '900', color: amountColor }}>
                    € {Number(mov.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}