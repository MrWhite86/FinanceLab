import React from 'react';
import * as Lucide from 'lucide-react';

export default function Sidebar({ activeTab, onTabChange, anni, onAddAnno, onRemoveAnno, onLogout, currentUser, themeColor, isMobile, isOpen, setIsOpen }) {
  const sidebarItemStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
    borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
    transition: 'all 0.2s', color: active ? '#fff' : '#cbd5e1',
    background: active ? themeColor : 'transparent', textDecoration: 'none',
    border: 'none', width: '100%', textAlign: 'left'
  });

  return (
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
        <Lucide.LayoutDashboard color={themeColor} size={28} />
        <h1 style={{ fontSize: '18px', fontWeight: '900' }}>FinanceLab</h1>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <button onClick={() => { onTabChange('impostazioni'); if(isMobile) setIsOpen(false); }} style={sidebarItemStyle(activeTab === 'impostazioni')}>
          <Lucide.Settings size={18}/> Impostazioni
        </button>
        <button onClick={() => { onTabChange('ricerca'); if(isMobile) setIsOpen(false); }} style={sidebarItemStyle(activeTab === 'ricerca')}>
          <Lucide.Search size={18}/> Ricerca Globale
        </button>

        <div style={{ padding: '25px 10px 10px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '800' }}>REGISTRI</span>
          <Lucide.PlusCircle size={20} color={themeColor} cursor="pointer" onClick={onAddAnno}/>
        </div>
        
        {anni.map(anno => (
          <div key={anno} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button 
              onClick={() => { onTabChange(anno); if(isMobile) setIsOpen(false); }} 
              style={{ ...sidebarItemStyle(activeTab === anno), flex: 1 }}
            >
              <Lucide.Calendar size={16}/> {anno}
            </button>
            <Lucide.Trash2 
              size={16} color="#334155" 
              style={{ cursor: 'pointer', opacity: 0.6, padding: '8px' }} 
              onClick={() => onRemoveAnno(anno)}
            />
          </div>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', color: '#94a3b8', fontSize: '13px' }}>
            <Lucide.User size={16} /> {currentUser?.toUpperCase()}
          </div>
          <button onClick={onLogout} style={{ padding: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Lucide.LogOut size={18}/> Logout</button>
        </div>
      </nav>
    </aside>
  );
}