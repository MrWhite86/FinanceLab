import { describe, it, expect } from 'vitest';
import { prossimaOccorrenza, occorrenzeMancanti } from './operazioniPianificateUtils';

describe('prossimaOccorrenza', () => {
  it('mensile: trova la stessa data del mese corrente se ancora futura', () => {
    const op = { tipoPeriodicita: 'mensile', giorno: 27 };
    expect(prossimaOccorrenza(op, '2026-08-01')).toBe('2026-08-27');
  });

  it('mensile: passa al mese successivo se la data del mese corrente è già trascorsa', () => {
    const op = { tipoPeriodicita: 'mensile', giorno: 27 };
    expect(prossimaOccorrenza(op, '2026-08-27')).toBe('2026-09-27');
  });

  it('mensile: va a capodanno quando dicembre supera in gennaio', () => {
    const op = { tipoPeriodicita: 'mensile', giorno: 15 };
    expect(prossimaOccorrenza(op, '2026-12-15')).toBe('2027-01-15');
  });

  it('mensile: giorno 31 si aggancia all\'ultimo giorno nei mesi corti (febbraio, non bisestile)', () => {
    const op = { tipoPeriodicita: 'mensile', giorno: 31 };
    expect(prossimaOccorrenza(op, '2027-01-31')).toBe('2027-02-28');
  });

  it('mensile: giorno 31 si aggancia al 29 febbraio in un anno bisestile', () => {
    const op = { tipoPeriodicita: 'mensile', giorno: 31 };
    expect(prossimaOccorrenza(op, '2028-01-31')).toBe('2028-02-29');
  });

  it('annuale: trova la stessa data quest\'anno se ancora futura', () => {
    const op = { tipoPeriodicita: 'annuale', giorno: 15, mese: 3 };
    expect(prossimaOccorrenza(op, '2026-01-01')).toBe('2026-03-15');
  });

  it('annuale: passa all\'anno successivo se la data di quest\'anno è già trascorsa', () => {
    const op = { tipoPeriodicita: 'annuale', giorno: 15, mese: 3 };
    expect(prossimaOccorrenza(op, '2026-03-15')).toBe('2027-03-15');
  });
});

describe('occorrenzeMancanti', () => {
  it('nessuna occorrenza mancante se ultimaEsecuzione è già oggi o dopo', () => {
    const op = { tipoPeriodicita: 'mensile', giorno: 27, ultimaEsecuzione: '2026-08-27', attiva: true };
    expect(occorrenzeMancanti(op, '2026-08-27')).toEqual([]);
  });

  it('una sola occorrenza se è passato esattamente un periodo', () => {
    const op = { tipoPeriodicita: 'mensile', giorno: 27, ultimaEsecuzione: '2026-07-27', attiva: true };
    expect(occorrenzeMancanti(op, '2026-08-27')).toEqual(['2026-08-27']);
  });

  it('recupera tutte le occorrenze mancate (app rimasta chiusa per mesi)', () => {
    const op = { tipoPeriodicita: 'mensile', giorno: 1, ultimaEsecuzione: '2026-01-01', attiva: true };
    expect(occorrenzeMancanti(op, '2026-05-01')).toEqual(['2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01']);
  });

  it('rispetta il tetto di recupero anche con una data di partenza molto vecchia/corrotta', () => {
    const op = { tipoPeriodicita: 'mensile', giorno: 1, ultimaEsecuzione: '2000-01-01', attiva: true };
    const risultato = occorrenzeMancanti(op, '2026-08-01', 12);
    expect(risultato).toHaveLength(12);
  });

  it('un\'operazione non attiva non produce mai occorrenze', () => {
    const op = { tipoPeriodicita: 'mensile', giorno: 1, ultimaEsecuzione: '2000-01-01', attiva: false };
    expect(occorrenzeMancanti(op, '2026-08-01')).toEqual([]);
  });

  it('periodicità annuale: recupera le occorrenze annuali mancate', () => {
    const op = { tipoPeriodicita: 'annuale', giorno: 15, mese: 3, ultimaEsecuzione: '2024-03-15', attiva: true };
    expect(occorrenzeMancanti(op, '2026-06-01')).toEqual(['2025-03-15', '2026-03-15']);
  });
});
