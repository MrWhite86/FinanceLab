// Menu di navigazione laterale: Impostazioni, Ricerca Globale e un pulsante per ogni
// registro annuale (anni). Componente "dumb": non tiene stato proprio ne' calcola nulla,
// riceve tutto da App.jsx (activeTab, elenco anni...) e si limita a notificare i click
// tramite le callback ricevute come props (onTabChange, onAddAnno, onRemoveAnno, onLogout).
import { Calendar, Inbox, LogOut, PlusCircle, Search, Settings, Trash2, User } from 'lucide-react';
import ArkivMark from './ArkivMark';

export default function Sidebar({ activeTab, onTabChange, anni, onAddAnno, onRemoveAnno, onLogout, currentUser, coloreScuro, isMobile, isOpen, setIsOpen, conteggioDaImportare }) {
  /**
   * Stile di una voce di menu: overlay chiaro traslucido fisso per lo stato attivo, NON il
   * colore tema dell'utente (che qui sarebbe la versione CHIARA, non adatta a distinguersi da
   * uno sfondo già scuro qualunque tinta abbia). Lo stesso vale sotto per il badge conteggio e PlusCircle.
   */
  const sidebarItemStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
    borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
    transition: 'all 0.2s', color: active ? '#fff' : '#d4d4d4',
    background: active ? 'rgba(255,255,255,0.1)' : 'transparent', textDecoration: 'none',
    border: 'none', width: '100%', textAlign: 'left'
  });

  return (
    // Da mobile (isMobile) diventa un pannello a scomparsa: fixed e spostato fuori
    // schermo (left: -250px) finché isOpen non è true; da desktop resta sempre visibile
    // e "sticky" (scorre con la pagina restando in vista).
    <aside style={{
      width: '250px',
      flexShrink: 0,
      alignSelf: 'stretch',
      backgroundColor: coloreScuro,
      color: '#fff',
      position: isMobile ? 'fixed' : 'sticky',
      top: 0,
      height: '100vh',
      padding: '30px 20px',
      boxSizing: 'border-box',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      left: isMobile && !isOpen ? '-250px' : '0',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: isMobile ? '5px 0 15px -5px rgba(0,0,0,0.3)' : 'none',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px', padding: '0 10px' }}>
        <ArkivMark size={26} />
        <h1 style={{ fontSize: '18px', fontWeight: '900' }}>Arkiv</h1>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <button onClick={() => { onTabChange('impostazioni'); if(isMobile) setIsOpen(false); }} style={sidebarItemStyle(activeTab === 'impostazioni')}>
          <Settings size={18}/> Impostazioni
        </button>
        <button onClick={() => { onTabChange('ricerca'); if(isMobile) setIsOpen(false); }} style={sidebarItemStyle(activeTab === 'ricerca')}>
          <Search size={18}/> Ricerca Globale
        </button>
        <button onClick={() => { onTabChange('importa'); if(isMobile) setIsOpen(false); }} style={{ ...sidebarItemStyle(activeTab === 'importa'), justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><Inbox size={18}/> Documenti da Importare</span>
          {conteggioDaImportare > 0 && (
            <span style={{ background: activeTab === 'importa' ? 'rgba(255,255,255,0.25)' : '#52525b', color: '#fff', fontSize: '10px', fontWeight: '700', borderRadius: '999px', padding: '2px 7px', minWidth: '18px', textAlign: 'center' }}>
              {conteggioDaImportare}
            </span>
          )}
        </button>

        <div style={{ padding: '25px 10px 10px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#737373', fontWeight: '700' }}>REGISTRI</span>
          <PlusCircle size={20} color="#a1a1aa" cursor="pointer" onClick={onAddAnno}/>
        </div>

        {/* Un pulsante per ogni anno attivo: apre il registro (onTabChange) o lo rimuove (onRemoveAnno, bloccato da App.jsx se contiene dati) */}
        {anni.map(anno => (
          <div key={anno} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button 
              onClick={() => { onTabChange(anno); if(isMobile) setIsOpen(false); }} 
              style={{ ...sidebarItemStyle(activeTab === anno), flex: 1 }}
            >
              <Calendar size={16}/> {anno}
            </button>
            <Trash2 
              size={16} color="#404040" 
              style={{ cursor: 'pointer', opacity: 0.6, padding: '8px' }} 
              onClick={() => onRemoveAnno(anno)}
            />
          </div>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #262626' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', color: '#a3a3a3', fontSize: '13px' }}>
            <User size={16} /> {currentUser?.toUpperCase()}
          </div>
          <button onClick={onLogout} style={{ padding: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><LogOut size={18}/> Logout</button>
        </div>
      </nav>
    </aside>
  );
}