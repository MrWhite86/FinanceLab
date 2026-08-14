import { useState } from 'react';
import { Download, FolderArchive, Lock, Save, Trash2, Unlock, Upload } from 'lucide-react';

/**
 * SettingsView: Gestisce le configurazioni globali dell'applicazione.
 * Include gestione del percorso file, manutenzione (import/export), profilo utente e libreria tag.
 */
export default function SettingsView({ config, setConfig, user, updateProfile, importaJSON, backupCartella, styles, newUsername, setNewUsername, newPassword, setNewPassword }) {
  const isAdmin = user.username === 'admin';
  const [nuovoTag, setNuovaTag] = useState('');
  const [bloccaPercorso, setBloccaPercorso] = useState(true);

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
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
          <button onClick={() => {const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({config})])); a.download="backup.json"; a.click();}} style={{...styles.btn('#10b981'), flex:1, justifyContent:'center'}}><Download size={18}/> Esporta</button>
          <label style={{...styles.btn('#475569'), cursor:'pointer', flex:1, justifyContent:'center'}}><Upload size={18}/> Importa <input type="file" style={{display:'none'}} onChange={importaJSON}/></label>
          <button onClick={backupCartella} style={{...styles.btn('#f59e0b'), flex:1, justifyContent:'center'}}><FolderArchive size={18}/> Backup Cartella</button>
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