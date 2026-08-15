// Menu di navigazione laterale: Impostazioni, Ricerca Globale e un pulsante per ogni
// registro annuale (anni). Componente "dumb": non tiene stato proprio ne' calcola nulla,
// riceve tutto da App.jsx (activeTab, elenco anni...) e si limita a notificare i click
// tramite le callback ricevute come props (onTabChange, onAddAnno, onRemoveAnno, onLogout).
import { Calendar, Inbox, LayoutDashboard, LogOut, PlusCircle, Search, Settings, Trash2, User } from 'lucide-react';

export default function Sidebar({ activeTab, onTabChange, anni, onAddAnno, onRemoveAnno, onLogout, currentUser, themeColor, isMobile, isOpen, setIsOpen, conteggioDaImportare }) {
  /** Stile di una voce di menu: sfondo pieno del colore tema se è quella attiva, altrimenti trasparente. */
  const sidebarItemStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
    borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
    transition: 'all 0.2s', color: active ? '#fff' : '#cbd5e1',
    background: active ? themeColor : 'transparent', textDecoration: 'none',
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
      backgroundColor: '#0f172a',
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
        <LayoutDashboard color={themeColor} size={28} />
        <h1 style={{ fontSize: '18px', fontWeight: '900' }}>FinanceLab</h1>
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
            <span style={{ background: activeTab === 'importa' ? 'rgba(255,255,255,0.25)' : themeColor, color: '#fff', fontSize: '10px', fontWeight: '900', borderRadius: '999px', padding: '2px 7px', minWidth: '18px', textAlign: 'center' }}>
              {conteggioDaImportare}
            </span>
          )}
        </button>

        <div style={{ padding: '25px 10px 10px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '800' }}>REGISTRI</span>
          <PlusCircle size={20} color={themeColor} cursor="pointer" onClick={onAddAnno}/>
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
              size={16} color="#334155" 
              style={{ cursor: 'pointer', opacity: 0.6, padding: '8px' }} 
              onClick={() => onRemoveAnno(anno)}
            />
          </div>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', color: '#94a3b8', fontSize: '13px' }}>
            <User size={16} /> {currentUser?.toUpperCase()}
          </div>
          <button onClick={onLogout} style={{ padding: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><LogOut size={18}/> Logout</button>
        </div>
      </nav>
    </aside>
  );
}