import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseImportedData } from './importUtils';
import { useFinance } from './useFinance';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, 'test/fixtures', name), 'utf-8');

describe('useFinance su dati importati da import-normale.json', () => {
  const { config, spese } = parseImportedData(fixture('import-normale.json'));

  it('calcola il saldo attuale sommando entrate e sottraendo le uscite (una sola volta)', () => {
    const { result } = renderHook(() => useFinance(spese, config, '2026', ''));

    // 1000 (saldo iniziale) + 2000 (stipendio) - 100 (spesa multi-tag) - 50 (spesa alimentari)
    expect(result.current.saldoAttuale).toBe(2850);
  });

  it('ripartisce le spese multi-tag nel grafico a torta senza raddoppiare il totale', () => {
    const { result } = renderHook(() => useFinance(spese, config, '2026', ''));

    const uscite = Object.fromEntries(result.current.datiTorta.uscite.map(v => [v.name, v.value]));
    // la spesa da 100 con tag [alimentari, casa] viene divisa a metà (50 + 50),
    // sommata ai 50 di alimentari della seconda spesa -> alimentari 100, casa 50
    expect(uscite.ALIMENTARI).toBe(100);
    expect(uscite.CASA).toBe(50);

    const totale = Object.values(uscite).reduce((a, b) => a + b, 0);
    expect(totale).toBe(150); // = 100 + 50, non 100 + 100 + 50
  });

  it('filtra i movimenti dell\'anno corretto', () => {
    const { result } = renderHook(() => useFinance(spese, config, '2026', ''));
    expect(result.current.movimentiAnno).toHaveLength(3);

    const { result: result2025 } = renderHook(() => useFinance(spese, config, '2025', ''));
    expect(result2025.current.movimentiAnno).toHaveLength(0);
  });
});

describe('valoreSecondario (es. lordo dello stipendio)', () => {
  const config = {
    saldoStatoZero: 0,
    dataStatoZero: '2026-01-01',
    tags: [{ nome: 'stipendio', tipo: 'entrata' }],
  };

  it('non viene sommato al saldo ne alla ripartizione delle uscite: solo "importo" conta', () => {
    const spese = [
      { id: '1', data: '2026-01-10', importo: 1800, tags: ['stipendio'], nota: 'Stipendio', valoreSecondario: 2500, etichettaSecondaria: 'Lordo' },
    ];
    const { result } = renderHook(() => useFinance(spese, config, '2026', ''));

    // il saldo deve riflettere il netto (1800), mai il lordo (2500)
    expect(result.current.saldoAttuale).toBe(1800);
    // nessuna voce "lordo" deve comparire tra le uscite: il campo e' puramente informativo
    expect(result.current.datiTorta.uscite).toEqual([]);
  });
});
