// Tre componenti di interfaccia generici e riutilizzabili in tutta l'app (nessuna logica
// applicativa qui dentro): la notifica in basso a destra, la finestra di dialogo modale, e
// l'anteprima di un allegato. App.jsx tiene lo stato di tutti e li renderizza una sola volta,
// in fondo all'albero dei componenti, cosi' funzionano sopra qualunque vista sia attiva.
import { FileWarning, Info, X } from 'lucide-react';
import { tipoConAnteprima } from '../fileUtils';

/**
 * Notifica temporanea (si autochiude dopo 4s, vedi showToast in App.jsx).
 * @param message - una stringa semplice, oppure { text, onUndo } se serve un pulsante ANNULLA
 *                  (usato per la cancellazione dei movimenti, vedi handleRemoveSpesaWithUndo).
 */
export const Toast = ({ message, onClose, onUndo, undoLabel = "ANNULLA" }) => (
  <div style={{ 
    position: 'fixed', bottom: '20px', right: '20px', padding: '12px 20px', 
    background: '#171717', color: '#fff', borderRadius: '12px', zIndex: 1000, 
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '14px', 
    animation: 'slideIn 0.3s ease-out', border: '1px solid #262626' 
  }}>
    <Info size={18} color="#60a5fa" />
    <span style={{ fontSize: '14px', fontWeight: 600 }}>
      {typeof message === 'object' ? message.text : message}
    </span>
    {(onUndo || (typeof message === 'object' && message.onUndo)) && (
      <button 
        onClick={onUndo || message.onUndo}
        style={{
          padding: '4px 10px',
          background: '#38bdf8',
          color: '#171717',
          border: 'none',
          borderRadius: '6px',
          fontWeight: '700',
          fontSize: '11px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        {undoLabel}
      </button>
    )}
    <X size={16} onClick={onClose} style={{ cursor: 'pointer', opacity: 0.7 }} />
  </div>
);

/**
 * Finestra di dialogo generica, usata sia per conferme (type='confirm', es. "Elimina Anno")
 * sia per richiedere un valore testuale (type='prompt', es. "Nuovo Registro" -> l'anno da creare).
 * onConfirm riceve sempre inputValue: le conferme semplici lo ignorano semplicemente.
 */
export const Modal = ({ show, title, msg, type, inputValue, setInputValue, onConfirm, onCancel, themeColor, styles }) => {
  if (!show) return null; // niente da renderizzare finche' nessuno chiama setModal({ show: true, ... })
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 200, padding: '20px'
    }}>
      <div style={{ background: styles.card.background, padding: '30px', borderRadius: '16px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0, color: styles.testo }}>{title}</h3>
        <p style={{ color: styles.testoMuto, fontSize: '14px' }}>{msg}</p>

        {type === 'prompt' && (
          <input
            type="text" autoFocus
            style={{ ...styles.input, marginTop: '10px' }}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '25px', justifyContent: 'flex-end' }}>
          <button
            style={{ padding: '10px 20px', background: styles.bgSottile2, color: styles.testoMuto, border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
            onClick={onCancel}>ANNULLA</button>
          <button
            style={{ padding: '10px 20px', background: themeColor, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}
            onClick={() => onConfirm(inputValue)}>CONFERMA</button>
        </div>
      </div>
    </div>
  );
};

/**
 * Anteprima di un allegato (icona "occhio" sulle righe con documenti, vedi Dashboard.jsx/Search.jsx).
 * file = { nome, dataUri, tipo } preparato da apriAnteprima in App.jsx, oppure null se chiusa.
 * Sa mostrare solo immagini e PDF (i formati che i browser/webview sanno rendere nativamente,
 * vedi tipoConAnteprima in fileUtils.js); per gli altri formati mostra un avviso invece di un riquadro vuoto.
 */
export const AnteprimaModal = ({ file, onClose, styles }) => {
  if (!file) return null;
  const conAnteprima = tipoConAnteprima(file.tipo);
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 300, padding: '20px'
    }} onClick={onClose}>
      <div
        style={{ background: styles.card.background, borderRadius: '16px', width: '100%', maxWidth: '900px', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${styles.border}` }}>
          <span style={{ fontWeight: '800', fontSize: '14px', color: styles.testo }}>{file.nome}</span>
          <X size={20} color={styles.testoMuto} style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: styles.bgSottile }}>
          {!conAnteprima ? (
            <div style={{ textAlign: 'center', color: styles.testoMuto, padding: '40px' }}>
              <FileWarning size={40} color={styles.testoMuto} style={{ marginBottom: '12px' }} />
              <p style={{ margin: 0, fontWeight: '700' }}>Anteprima non disponibile per questo formato</p>
              <span style={{ fontSize: '12px' }}>Apri il file dalla cartella di backup per visualizzarlo</span>
            </div>
          ) : file.tipo === 'application/pdf' ? (
            <iframe src={file.dataUri} title={file.nome} style={{ width: '100%', height: '100%', border: 'none' }} />
          ) : (
            <img src={file.dataUri} alt={file.nome} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          )}
        </div>
      </div>
    </div>
  );
};