import React from 'react';
import * as Lucide from 'lucide-react';

export const Toast = ({ message, onClose, onUndo, undoLabel = "ANNULLA" }) => (
  <div style={{ 
    position: 'fixed', bottom: '20px', right: '20px', padding: '12px 20px', 
    background: '#0f172a', color: '#fff', borderRadius: '12px', zIndex: 1000, 
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '14px', 
    animation: 'slideIn 0.3s ease-out', border: '1px solid #1e293b' 
  }}>
    <Lucide.Info size={18} color="#60a5fa" />
    <span style={{ fontSize: '14px', fontWeight: 600 }}>
      {typeof message === 'object' ? message.text : message}
    </span>
    {(onUndo || (typeof message === 'object' && message.onUndo)) && (
      <button 
        onClick={onUndo || message.onUndo}
        style={{
          padding: '4px 10px',
          background: '#38bdf8',
          color: '#0f172a',
          border: 'none',
          borderRadius: '6px',
          fontWeight: '800',
          fontSize: '11px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        {undoLabel}
      </button>
    )}
    <Lucide.X size={16} onClick={onClose} style={{ cursor: 'pointer', opacity: 0.7 }} />
  </div>
);

export const Modal = ({ show, title, msg, type, inputValue, setInputValue, onConfirm, onCancel, themeColor }) => {
  if (!show) return null;
  return (
    <div style={{ 
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', 
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', 
      justifyContent: 'center', zIndex: 200, padding: '20px' 
    }}>
      <div style={{ background: 'white', padding: '30px', borderRadius: '16px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p style={{ color: '#64748b', fontSize: '14px' }}>{msg}</p>
        
        {type === 'prompt' && (
          <input 
            type="text" autoFocus 
            style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', width: '100%', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginTop: '10px' }} 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)}
          />
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '25px', justifyContent: 'flex-end' }}>
          <button 
            style={{ padding: '10px 20px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }} 
            onClick={onCancel}>ANNULLA</button>
          <button
            style={{ padding: '10px 20px', background: themeColor, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
            onClick={() => onConfirm(inputValue)}>CONFERMA</button>
        </div>
      </div>
    </div>
  );
};