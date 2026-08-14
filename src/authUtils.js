// Logica di hashing/verifica delle password degli account locali (usata da Login.jsx).
// Le password non vengono mai salvate in chiaro: qui vengono trasformate in un hash
// derivato con PBKDF2 e un salt casuale per utente, tramite la Web Crypto API del browser
// (nessuna libreria esterna necessaria). I record utente vivono in localStorage
// (chiave "finance_lab_users"), gestiti da Login.jsx.

// Numero di iterazioni PBKDF2: più alto = più lento da forzare (brute force), ma anche
// più lento da calcolare ad ogni login. 100.000 è un compromesso comune per uso client-side.
const PBKDF2_ITERATIONS = 100000;

/** Converte un array di byte nella sua rappresentazione esadecimale (stringa), per poterlo salvare come testo in localStorage/JSON. */
function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Operazione inversa di bytesToHex: da stringa esadecimale (es. il salt salvato) torna a un array di byte utilizzabile da crypto.subtle. */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

/** Hash SHA-256 non salato: solo per verificare/migrare account creati con la versione precedente dell'app. */
async function legacyHashPassword(pwd) {
  if (!pwd) return '';
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd));
  return bytesToHex(new Uint8Array(hashBuffer));
}

/** Deriva { hash, salt } con PBKDF2-SHA256. Senza saltHex ne genera uno nuovo casuale (nuovo utente). */
export async function derivePasswordRecord(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256);
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

/**
 * Verifica una password contro il record salvato per un utente.
 * Gestisce anche i due formati legacy (hash SHA-256 non salato, o - versioni molto vecchie - testo in chiaro),
 * cosi' gli account creati prima dell'introduzione del salt continuano a funzionare finche' non vengono migrati al login.
 */
export async function verifyPassword(password, storedRecord) {
  if (storedRecord && typeof storedRecord === 'object' && storedRecord.salt) {
    const { hash } = await derivePasswordRecord(password, storedRecord.salt);
    return hash === storedRecord.hash;
  }
  if (typeof storedRecord === 'string') {
    const legacyHash = await legacyHashPassword(password);
    return storedRecord === legacyHash || storedRecord === password;
  }
  return false;
}

/** Un record e' "legacy" (da migrare al formato salato) se non e' un oggetto {hash, salt}. */
export function isLegacyRecord(storedRecord) {
  return typeof storedRecord === 'string';
}
