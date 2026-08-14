import { describe, it, expect } from 'vitest';
import { derivePasswordRecord, verifyPassword, isLegacyRecord } from './authUtils';

describe('derivePasswordRecord / verifyPassword', () => {
  it('accetta la password corretta e rifiuta una password sbagliata', async () => {
    const record = await derivePasswordRecord('correct-horse-battery-staple');

    expect(await verifyPassword('correct-horse-battery-staple', record)).toBe(true);
    expect(await verifyPassword('password-sbagliata', record)).toBe(false);
  });

  it('usa un salt diverso ad ogni derivazione, quindi la stessa password produce hash diversi', async () => {
    const a = await derivePasswordRecord('stessa-password');
    const b = await derivePasswordRecord('stessa-password');

    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('non concede accesso se non esiste alcun record per l\'utente (niente backdoor implicite)', async () => {
    expect(await verifyPassword('qualsiasi-cosa', undefined)).toBe(false);
    expect(await verifyPassword('admin', undefined)).toBe(false);
  });

  it('distingue un record legacy (stringa hash) dal nuovo formato salato ({hash, salt})', async () => {
    // formato pre-salt usato dalle versioni precedenti dell'app: una stringa hash, non un oggetto
    const legacyStringHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('password'))
      .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
    expect(isLegacyRecord(legacyStringHash)).toBe(true);

    const record = await derivePasswordRecord('password');
    expect(isLegacyRecord(record)).toBe(false);
    expect(await verifyPassword('password', legacyStringHash)).toBe(true);
  });
});
