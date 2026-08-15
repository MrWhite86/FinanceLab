import { describe, it, expect } from 'vitest';
import { trovaImporti, trovaDate, estraiParolaChiaveDaContesto } from './interpretaBolletta';

describe('trovaImporti', () => {
  it('trova un importo semplice in formato italiano', () => {
    const candidati = trovaImporti('Totale da pagare: 42,50 euro');
    expect(candidati).toHaveLength(1);
    expect(candidati[0].valore).toBe(42.5);
  });

  it('gestisce il separatore delle migliaia', () => {
    const candidati = trovaImporti('Importo dovuto 1.234,56 EUR');
    expect(candidati[0].valore).toBe(1234.56);
  });

  it('mette in cima il candidato più vicino a una parola chiave', () => {
    const testo = 'Codice cliente 99,00 Totale da pagare 42,50';
    const candidati = trovaImporti(testo);
    expect(candidati[0].valore).toBe(42.5);
    expect(candidati[0].punteggio).toBeGreaterThan(candidati[1].punteggio);
  });

  it('ignora numeri senza due decimali (non sono importi in euro)', () => {
    const candidati = trovaImporti('Codice pratica 20260815');
    expect(candidati).toHaveLength(0);
  });

  it('nessun importo trovato restituisce array vuoto', () => {
    expect(trovaImporti('Nessun numero qui')).toEqual([]);
  });

  it('accetta una lista di parole chiave personalizzata', () => {
    const testo = 'Consumo 10,00 Canone mensile 25,00';
    const candidati = trovaImporti(testo, ['canone']);
    expect(candidati[0].valore).toBe(25);
  });

  it('una parola chiave più in alto nella lista pesa di più (per la memoria per fornitore)', () => {
    // "canone" e' generico (secondo in lista), "quota fissa enel" e' la parola imparata per
    // questo fornitore (prima in lista): deve vincere anche se e' un solo match contro uno solo.
    // Il testo di riempimento supera la finestra di contesto (45 caratteri) cosi' i due importi
    // restano isolati l'uno dall'altro, senza che le parole chiave dell'uno "sconfinino" nell'altro.
    const testo = 'Quota fissa enel 12,00. Dettaglio consumi e letture del periodo di riferimento. Canone mensile 25,00';
    const candidati = trovaImporti(testo, ['quota fissa enel', 'canone']);
    expect(candidati[0].valore).toBe(12);
  });
});

describe('trovaDate', () => {
  it('converte una data italiana gg/mm/aaaa in ISO', () => {
    const candidati = trovaDate('Scadenza: 30/09/2026');
    expect(candidati[0].valore).toBe('2026-09-30');
  });

  it('gestisce anni a 2 cifre assumendo il 2000', () => {
    const candidati = trovaDate('Scade il 15/03/26');
    expect(candidati[0].valore).toBe('2026-03-15');
  });

  it('gestisce il separatore trattino', () => {
    const candidati = trovaDate('Data 05-01-2027');
    expect(candidati[0].valore).toBe('2027-01-05');
  });

  it('ignora date non valide (giorno/mese fuori range)', () => {
    expect(trovaDate('Codice 45/67/2026')).toEqual([]);
  });

  it('mette in cima il candidato più vicino a una parola chiave', () => {
    const testo = 'Emessa il 01/01/2026 Data di scadenza 30/09/2026';
    const candidati = trovaDate(testo);
    expect(candidati[0].valore).toBe('2026-09-30');
  });

  it('nessuna data trovata restituisce array vuoto', () => {
    expect(trovaDate('Nessuna data qui')).toEqual([]);
  });
});

describe('estraiParolaChiaveDaContesto', () => {
  it('prende le ultime parole prima del valore', () => {
    expect(estraiParolaChiaveDaContesto('Quota fissa enel 12,00', '12,00')).toBe('quota fissa enel');
  });

  it('limita a 3 parole anche se il contesto ne ha di più', () => {
    expect(estraiParolaChiaveDaContesto('In data odierna risulta un totale bolletta gas 42,50', '42,50')).toBe('totale bolletta gas');
  });

  it('restituisce stringa vuota se il valore è all’inizio del contesto (niente prima)', () => {
    expect(estraiParolaChiaveDaContesto('12,00 e nient’altro prima', '12,00')).toBe('');
  });
});
