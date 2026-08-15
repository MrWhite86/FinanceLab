import { describe, it, expect } from 'vitest';
import { timestampOrdinabile, nomeCartellaBackup, cartelleDaRimuovere, backupDaEseguireAllAvvio } from './backupUtils';

describe('timestampOrdinabile', () => {
  it('produce un formato ordinabile alfabeticamente = cronologicamente', () => {
    const t1 = timestampOrdinabile(new Date('2026-08-15T14:30:05Z'));
    const t2 = timestampOrdinabile(new Date('2026-08-15T14:31:00Z'));
    expect(t1 < t2).toBe(true);
  });
});

describe('nomeCartellaBackup', () => {
  it('inizia sempre con il prefisso atteso', () => {
    expect(nomeCartellaBackup(new Date('2026-08-15T14:30:05Z'))).toMatch(/^backup_completo_/);
  });
});

describe('cartelleDaRimuovere', () => {
  it('non rimuove nulla se sono meno del limite', () => {
    const nomi = ['backup_completo_2026-08-13_100000', 'backup_completo_2026-08-14_100000'];
    expect(cartelleDaRimuovere(nomi, 3)).toEqual([]);
  });

  it('rimuove le più vecchie oltre il limite, mantenendo le più recenti', () => {
    const nomi = [
      'backup_completo_2026-08-13_100000',
      'backup_completo_2026-08-15_100000',
      'backup_completo_2026-08-14_100000',
    ];
    expect(cartelleDaRimuovere(nomi, 1)).toEqual(['backup_completo_2026-08-13_100000', 'backup_completo_2026-08-14_100000']);
  });

  it('ignora file/cartelle che non sono snapshot di backup', () => {
    const nomi = ['backup_completo_2026-08-15_100000', '.DS_Store', 'altra_cartella'];
    expect(cartelleDaRimuovere(nomi, 0)).toEqual(['backup_completo_2026-08-15_100000']);
  });
});

describe('backupDaEseguireAllAvvio', () => {
  it('con frequenza "nessuno" non scatta mai', () => {
    expect(backupDaEseguireAllAvvio('nessuno', null)).toBe(false);
  });

  it('con frequenza "avvio" scatta sempre', () => {
    expect(backupDaEseguireAllAvvio('avvio', new Date().toISOString())).toBe(true);
  });

  it('con frequenza "modifica" non scatta qui (gestito a parte)', () => {
    expect(backupDaEseguireAllAvvio('modifica', null)).toBe(false);
  });

  it('con frequenza "giornaliero" scatta se non c\'è mai stato un backup', () => {
    expect(backupDaEseguireAllAvvio('giornaliero', null)).toBe(true);
  });

  it('con frequenza "giornaliero" non scatta se l\'ultimo backup è recente', () => {
    expect(backupDaEseguireAllAvvio('giornaliero', new Date().toISOString())).toBe(false);
  });

  it('con frequenza "giornaliero" scatta se sono passate più di 24 ore', () => {
    const ieriLAltro = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(backupDaEseguireAllAvvio('giornaliero', ieriLAltro)).toBe(true);
  });
});
