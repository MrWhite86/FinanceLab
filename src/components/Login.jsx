import React, { useState, useEffect } from 'react';
import * as Lucide from 'lucide-react';

/** Funzione per l'hashing sicuro delle password tramite SHA-256 */
async function hashPassword(pwd) {
  if (!pwd) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(pwd);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function Login({ onLogin, themeColor, styles }) {
  const [users, setUsers] = useState({});

  useEffect(() => {
    const initializeUsers = async () => {
      const storedUsers = JSON.parse(localStorage.getItem('finance_lab_users') || '{}');
      if (!storedUsers.admin) {
        // Hashing della password predefinita "admin" per testing
        storedUsers.admin = await hashPassword('admin');
        localStorage.setItem('finance_lab_users', JSON.stringify(storedUsers));
      }
      setUsers(storedUsers);
    };
    initializeUsers();
  }, []);

  const remembered = JSON.parse(localStorage.getItem('finance_lab_remembered') || '{}');

  const [authMode, setAuthMode] = useState('login');
  const [credentials, setCredentials] = useState({ 
    username: 'admin', 
    password: remembered.admin || '' 
  });
  const [rememberMe, setRememberMe] = useState(!!remembered.admin);

  const userList = Object.keys(users);

  const handleSelectProfile = (name) => {
    const savedPassword = remembered[name] || '';
    setCredentials({ username: name, password: savedPassword });
    setRememberMe(!!savedPassword);
  };

  const handleAuth = async () => {
    const { username, password } = credentials;
    if (!username.trim()) {
      alert("Inserisci un nome utente.");
      return;
    }

    const hashedInput = await hashPassword(password);

    if (authMode === 'registro') {
      if (users[username]) {
        alert("Utente già esistente.");
        return;
      }
      const updatedUsers = { ...users, [username]: hashedInput };
      localStorage.setItem('finance_lab_users', JSON.stringify(updatedUsers));
      setUsers(updatedUsers);
      alert("Registrazione completata! Ora puoi accedere.");
      setAuthMode('login');
    } else {
      const storedPass = users[username];
      // Verifica hash; tollera anche una password ancora salvata in chiaro per migrarla all'hash
      const isValid = storedPass === hashedInput || storedPass === password;

      if (isValid) {
        // Se la password era memorizzata in chiaro, migrala automaticamente all'hash SHA-256
        if (storedPass === password) {
          const migratedUsers = { ...users, [username]: hashedInput };
          localStorage.setItem('finance_lab_users', JSON.stringify(migratedUsers));
          setUsers(migratedUsers);
        }

        const newRemembered = JSON.parse(localStorage.getItem('finance_lab_remembered') || '{}');
        if (rememberMe) {
          newRemembered[username] = password;
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
            <Lucide.LayoutDashboard color={themeColor} size={48} />
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
                  <Lucide.User size={14} color={credentials.username === name ? themeColor : '#64748b'} />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>{name}</span>
                  {remembered[name] && <Lucide.CheckCircle2 size={12} color="#10b981" />}
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
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Ricorda le credenziali</span>
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