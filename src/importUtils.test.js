import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseImportedData } from './importUtils';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(__dirname, 'test/fixtures', name), 'utf-8');

describe('parseImportedData', () => {
  it('importa un JSON in formato corrente senza alterare tag e importi', () => {
    const { config, spese } = parseImportedData(fixture('import-normale.json'));

    expect(config.saldoStatoZero).toBe(1000);
    expect(config.tags).toEqual([
      { nome: 'stipendio', tipo: 'entrata' },
      { nome: 'alimentari', tipo: 'uscita' },
      { nome: 'casa', tipo: 'uscita' },
      { nome: 'documenti', tipo: 'neutro' },
    ]);

    expect(spese).toHaveLength(3);
    expect(spese[1]).toMatchObject({ importo: 100, tags: ['alimentari', 'casa'] });
  });

  it('migra il formato legacy: config.categorie -> config.tags, spesa.categoria -> spesa.tags', () => {
    const { config, spese } = parseImportedData(fixture('import-legacy.json'));

    expect(config.categorie).toBeUndefined();
    expect(config.tags).toEqual([{ nome: 'benzina', tipo: 'uscita' }]);

    expect(spese[0].categoria).toBeUndefined();
    expect(spese[0].tags).toEqual(['benzina']);
  });

  it('lancia un errore su un file JSON corrotto, cosi il chiamante puo mostrare "File corrotto."', () => {
    expect(() => parseImportedData(fixture('import-corrotto.json'))).toThrow();
  });
});
