import { useState, useEffect } from 'react';
import { LayoutDashboard, User, CheckCircle2 } from 'lucide-react';
import { derivePasswordRecord, verifyPassword, isLegacyRecord } from '../authUtils';

export default function Login({ onLogin, themeColor, styles }) {
  const [users, setUsers] = useState({});

  useEffect(() => {
    const initializeUsers = async () => {
      const storedUsers = JSON.parse(localStorage.getItem('finance_lab_users') || '{}');
      if (!storedUsers.admin) {
        storedUsers.admin = await derivePasswordRecord('admin');
        localStorage.setItem('finance_lab_users', JSON.stringify(storedUsers));
      }
      setUsers(storedUsers);
    };
    initializeUsers();
  }, []);

  // Ricorda solo quali username sono stati usati di recente, mai la password: niente testo in chiaro in localStorage.
  const remembered = JSON.parse(localStorage.getItem('finance_lab_remembered') || '{}');

  const [authMode, setAuthMode] = useState('login');
  const [credentials, setCredentials] = useState({ username: 'admin', password: '' });
  const [rememberMe, setRememberMe] = useState(!!remembered.admin);

  const userList = Object.keys(users);

  const handleSelectProfile = (name) => {
    setCredentials({ username: name, password: '' });
    setRememberMe(!!remembered[name]);
  };

  const handleAuth = async () => {
    const { username, password } = credentials;
    if (!username.trim()) {
      alert("Inserisci un nome utente.");
      return;
    }

    if (authMode === 'registro') {
      if (users[username]) {
        alert("Utente già esistente.");
        return;
      }
      const updatedUsers = { ...users, [username]: await derivePasswordRecord(password) };
      localStorage.setItem('finance_lab_users', JSON.stringify(updatedUsers));
      setUsers(updatedUsers);
      alert("Registrazione completata! Ora puoi accedere.");
      setAuthMode('login');
    } else {
      const storedRecord = users[username];
      const isValid = await verifyPassword(password, storedRecord);

      if (isValid) {
        // Se l'account usava ancora il formato pre-salt, migralo al login
        if (isLegacyRecord(storedRecord)) {
          const migratedUsers = { ...users, [username]: await derivePasswordRecord(password) };
          localStorage.setItem('finance_lab_users', JSON.stringify(migratedUsers));
          setUsers(migratedUsers);
        }

        const newRemembered = JSON.parse(localStorage.getItem('finance_lab_remembered') || '{}');
        if (rememberMe) {
          newRemembered[username] = true;
        } else {
          delete newRemembered[username];
        }
        localStorage.setItem('finance_lab_remembered', JSON.stringify(newRemembered));
        onLogin(username);
      } else {
        alert("Credenziali errate");
      }
    }
  };

  return (
    <div style={{ 
      display: 'flex', minHeight: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', 
      backgroundColor: '#0f172a',
      backgroundImage: `radial-gradient(circle at top right, ${themeColor}33, transparent), radial-gradient(circle at bottom left, #1e1b4b, transparent)`
    }}>
      <div style={{ ...styles.card, width: '90%', maxWidth: '440px', padding: '40px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '25px' }}>
          <div style={{ background: `${themeColor}15`, padding: '15px', borderRadius: '20px' }}>
            <LayoutDashboard color={themeColor} size={48} />
          </div>
        </div>
        <h2 style={{ marginBottom: '8px', fontSize: '26px', fontWeight: '900', color: '#1e293b' }}>
          {authMode === 'login' ? 'Bentornato' : 'Nuovo Profilo'}
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>
          {authMode === 'login' ? 'Inserisci le tue credenziali per accedere' : 'Crea un account locale per i tuoi dati'}
        </p>
        
        {authMode === 'login' && userList.length > 0 && (
          <div style={{ marginBottom: '25px', textAlign: 'left' }}>
            <label style={styles.label}>PROFILI RILEVATI</label>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px' }}>
              {userList.map(name => (
                <div 
                  key={name} 
                  onClick={() => handleSelectProfile(name)}
                  style={{ padding: '8px 12px', background: credentials.username === name ? `${themeColor}20` : '#f1f5f9', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${credentials.username === name ? themeColor : '#e2e8f0'}`, display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                >
                  <User size={14} color={credentials.username === name ? themeColor : '#64748b'} />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>{name}</span>
                  {remembered[name] && <CheckCircle2 size={12} color="#10b981" />}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
          <div>
            <label style={styles.label}>NOME UTENTE</label>
            <input
              type="text" placeholder="Inserisci username..." style={styles.input}
              value={credentials.username} onChange={e => setCredentials({...credentials, username: e.target.value.toLowerCase()})}
            />
          </div>
          <div>
            <label style={styles.label}>PASSWORD</label>
            <input
              type="password" placeholder="••••••••" style={styles.input}
              value={credentials.password} onChange={e => setCredentials({...credentials, password: e.target.value})}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setRememberMe(!rememberMe)}>
            <input type="checkbox" checked={rememberMe} onChange={() => {}} style={{ cursor: 'pointer' }} />
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Ricorda nome utente (la password va sempre reinserita)</span>
          </div>
          <button onClick={handleAuth} style={{...styles.btn(themeColor), justifyContent: 'center', width: '100%', marginTop: '10px'}}>
            {authMode === 'login' ? 'ACCEDI AL PORTALE' : 'CREA PROFILO'}
          </button>
          <div style={{ marginTop: '10px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              {authMode === 'login' ? "Prima volta qui?" : "Hai già un account?"} {' '}
              <span style={{ color: themeColor, fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }} 
                onClick={() => setAuthMode(authMode === 'login' ? 'registro' : 'login')}>
                {authMode === 'login' ? "Registrati ora" : "Accedi qui"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}