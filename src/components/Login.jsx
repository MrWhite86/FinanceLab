// Schermata di autenticazione: mostrata da App.jsx finché non c'è un currentUser.
// L'app non ha un vero backend: gli account (username -> hash password) vivono nel
// localStorage del browser sotto la chiave "finance_lab_users" (un localStorage per
// dispositivo/browser: account e dati non si sincronizzano automaticamente tra Mac e telefono).
// L'hashing vero e proprio (PBKDF2 + salt) è delegato ad authUtils.js.
import { useState, useEffect } from 'react';
import { User, CheckCircle2 } from 'lucide-react';
import { derivePasswordRecord, verifyPassword, isLegacyRecord } from '../authUtils';
import logoArkiv from '../assets/logo-arkiv-orizzontale.png';

export default function Login({ onLogin, themeColor, coloreScuro, styles }) {
  /** Mappa username -> record password ({hash, salt}, o stringa legacy da migrare), caricata da localStorage. */
  const [users, setUsers] = useState({});

  // Al primo avvio, se non esiste ancora nessun utente, crea l'account "admin" di default
  // (password "admin") cosi' l'app è subito utilizzabile senza una registrazione forzata.
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

  /** 'login' mostra il form di accesso, 'registro' quello per creare un nuovo profilo locale. */
  const [authMode, setAuthMode] = useState('login');
  const [credentials, setCredentials] = useState({ username: 'admin', password: '' });
  const [rememberMe, setRememberMe] = useState(!!remembered.admin);

  const userList = Object.keys(users);

  /** Click su un chip "PROFILI RILEVATI": precompila solo lo username (mai la password), coerente con "Ricorda nome utente". */
  const handleSelectProfile = (name) => {
    setCredentials({ username: name, password: '' });
    setRememberMe(!!remembered[name]);
  };

  /** Gestisce sia la registrazione di un nuovo profilo sia il login, con migrazione trasparente degli account creati con hash pre-salt. */
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

  // Il form cambia poco tra i due authMode: stesso username/password, cambiano solo
  // titolo, testo del bottone e il link in fondo per passare da login a registrazione.

  return (
    <div style={{ 
      display: 'flex', minHeight: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', 
      backgroundColor: coloreScuro,
      backgroundImage: `radial-gradient(circle at top right, rgba(255,255,255,0.08), transparent), radial-gradient(circle at bottom left, rgba(0,0,0,0.35), transparent)`
    }}>
      <div style={{ ...styles.card, width: '90%', maxWidth: '440px', padding: '40px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <img src={logoArkiv} alt="Arkiv" style={{ width: '190px', height: 'auto' }} />
        </div>
        <h2 style={{ marginBottom: '8px', fontSize: '26px', fontWeight: '800', color: '#262626' }}>
          {authMode === 'login' ? 'Bentornato' : 'Nuovo Profilo'}
        </h2>
        <p style={{ color: '#737373', fontSize: '14px', marginBottom: '32px' }}>
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
                  style={{ padding: '8px 12px', background: credentials.username === name ? `${themeColor}20` : '#f5f5f5', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${credentials.username === name ? themeColor : '#e5e5e5'}`, display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                >
                  <User size={14} color={credentials.username === name ? themeColor : '#737373'} />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#262626' }}>{name}</span>
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
            <span style={{ fontSize: '13px', color: '#737373', fontWeight: '600' }}>Ricorda nome utente (la password va sempre reinserita)</span>
          </div>
          <button onClick={handleAuth} className="arkiv-btn" style={{...styles.btn(themeColor), justifyContent: 'center', width: '100%', marginTop: '10px'}}>
            {authMode === 'login' ? 'ACCEDI AL PORTALE' : 'CREA PROFILO'}
          </button>
          <div style={{ marginTop: '10px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#737373' }}>
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