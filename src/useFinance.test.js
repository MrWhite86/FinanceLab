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

describe('sottovoci (es. prelievo di 500€ suddiviso in più spese)', () => {
  const config = {
    saldoStatoZero: 1000,
    dataStatoZero: '2026-01-01',
    tags: [
      { nome: 'prelievo', tipo: 'uscita' },
      { nome: 'bollette', tipo: 'uscita' },
      { nome: 'spesa', tipo: 'uscita' },
    ],
  };
  // La voce madre (il prelievo) e' quella che conta nel saldo: 500€ escono dal conto in quel momento.
  // Le sottovoci (contenitoreId) sono solo la categorizzazione per tag di dove sono finiti quei soldi,
  // e non devono mai ridurre il saldo una seconda volta.
  const spese = [
    { id: 'c1', data: '2026-01-01', importo: 500, tags: ['prelievo'], nota: 'Prelievo contanti' },
    { id: 's1', data: '2026-01-05', importo: 100, tags: ['bollette'], nota: 'Bolletta luce', contenitoreId: 'c1' },
    { id: 's2', data: '2026-01-10', importo: 200, tags: ['spesa'], nota: 'Spesa supermercato', contenitoreId: 'c1' },
  ];

  it('conta la voce madre nel saldo ed esclude le sottovoci (mai doppio conteggio)', () => {
    const { result } = renderHook(() => useFinance(spese, config, '2026', ''));

    // 1000 - 500 (solo la madre). Se anche le sottovoci contassero sarebbe 1000-500-100-200=200.
    expect(result.current.saldoAttuale).toBe(500);
  });

  it('nel grafico a torta la madre lascia spazio alle sottovoci una volta che esistono', () => {
    const { result } = renderHook(() => useFinance(spese, config, '2026', ''));

    const uscite = Object.fromEntries(result.current.datiTorta.uscite.map(v => [v.name, v.value]));
    // PRELIEVO (la madre) non compare più: la categorizzazione reale è nelle sottovoci
    expect(uscite.PRELIEVO).toBeUndefined();
    expect(uscite.BOLLETTE).toBe(100);
    expect(uscite.SPESA).toBe(200);
  });

  it('se la madre non ha ancora sottovoci, il suo tag conta normalmente nella torta', () => {
    const soloMadre = [{ id: 'c1', data: '2026-01-01', importo: 500, tags: ['prelievo'], nota: 'Prelievo contanti' }];
    const { result } = renderHook(() => useFinance(soloMadre, config, '2026', ''));

    const uscite = Object.fromEntries(result.current.datiTorta.uscite.map(v => [v.name, v.value]));
    expect(uscite.PRELIEVO).toBe(500);
  });
});

describe('datiSpesa (scontrini registrati con macro-categorie)', () => {
  const config = {
    saldoStatoZero: 1000,
    dataStatoZero: '2026-01-01',
    categorieSpesa: ['pane e prodotti da forno', 'latticini e uova'],
    tags: [
      { nome: 'spesa', tipo: 'uscita' },
      { nome: 'pane e prodotti da forno', tipo: 'uscita' },
      { nome: 'latticini e uova', tipo: 'uscita' },
      { nome: 'bollette', tipo: 'uscita' },
    ],
  };
  // Due scontrini nel 2026: il primo con due righe classificate (che insieme non coprono l'intero
  // totale del madre, es. un articolo non riconosciuto dall'OCR), il secondo con una sola riga.
  // Un movimento "bollette" indipendente serve a verificare che non venga mai conteggiato qui.
  const spese = [
    { id: 'm1', data: '2026-01-10', importo: 45, tags: ['spesa'], nota: 'Scontrino Esselunga' },
    { id: 's1', data: '2026-01-10', importo: 10, tags: ['pane e prodotti da forno'], nota: 'Pane', contenitoreId: 'm1' },
    { id: 's2', data: '2026-01-10', importo: 20, tags: ['latticini e uova'], nota: 'Latte e uova', contenitoreId: 'm1' },
    { id: 'm2', data: '2026-03-05', importo: 15, tags: ['spesa'], nota: 'Scontrino Conad' },
    { id: 's3', data: '2026-03-05', importo: 15, tags: ['pane e prodotti da forno'], nota: 'Pane', contenitoreId: 'm2' },
    { id: 'b1', data: '2026-02-01', importo: 80, tags: ['bollette'], nota: 'Bolletta luce' },
  ];

  it('conta solo le voci madri taggate "spesa" per totale/media/numero scontrini, ignorando altri tag', () => {
    const { result } = renderHook(() => useFinance(spese, config, '2026', ''));

    expect(result.current.datiSpesa.totaleAnno).toBe(60); // 45 + 15, non include la bolletta
    expect(result.current.datiSpesa.numeroScontrini).toBe(2);
    expect(result.current.datiSpesa.mediaMensile).toBe(5); // 60 / 12
  });

  it('ripartisce per categoria usando le sottovoci, anche se non coprono l\'intero totale del madre', () => {
    const { result } = renderHook(() => useFinance(spese, config, '2026', ''));

    const torta = Object.fromEntries(result.current.datiSpesa.torta.map(v => [v.name, v.value]));
    expect(torta['PANE E PRODOTTI DA FORNO']).toBe(25); // 10 + 15
    expect(torta['LATTICINI E UOVA']).toBe(20);
    expect(torta.BOLLETTE).toBeUndefined();
  });

  it('costruisce una linea per categoria nel grafico di andamento, con zero nei mesi senza spesa per quella categoria', () => {
    const { result } = renderHook(() => useFinance(spese, config, '2026', ''));

    expect(result.current.datiSpesa.categorieConDati.sort()).toEqual(['latticini e uova', 'pane e prodotti da forno'].sort());

    const perMese = Object.fromEntries(result.current.datiSpesa.andamentoCategorie.map(v => [v.name, v]));
    expect(perMese.Gen['pane e prodotti da forno']).toBe(10);
    expect(perMese.Gen['latticini e uova']).toBe(20);
    expect(perMese.Mar['pane e prodotti da forno']).toBe(15);
    expect(perMese.Mar['latticini e uova']).toBe(0); // nessuna riga di questa categoria a marzo
    expect(perMese.Feb['pane e prodotti da forno']).toBe(0);
  });

  it('una categoria configurata ma mai usata in scontrini non compare tra quelle "con dati"', () => {
    const configConCategoriaInutilizzata = { ...config, categorieSpesa: [...config.categorieSpesa, 'bevande'] };
    const { result } = renderHook(() => useFinance(spese, configConCategoriaInutilizzata, '2026', ''));

    expect(result.current.datiSpesa.categorieConDati).not.toContain('bevande');
  });

  it('anno senza scontrini: tutto a zero, nessun errore', () => {
    const { result } = renderHook(() => useFinance(spese, config, '2025', ''));

    expect(result.current.datiSpesa.totaleAnno).toBe(0);
    expect(result.current.datiSpesa.numeroScontrini).toBe(0);
    expect(result.current.datiSpesa.torta).toEqual([]);
  });
});
