import { describe, it, expect } from 'vitest';
import { estraiRigheProdotto, estraiTotale, classificaCategoria, interpretaScontrino, CATEGORIE_DEFAULT } from './interpretaScontrino';

describe('estraiRigheProdotto', () => {
  it('estrae descrizione e importo da una riga prodotto semplice', () => {
    const righe = estraiRigheProdotto('PANE INTEGRALE 500G        2,50');
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({ descrizione: 'PANE INTEGRALE 500G', importo: 2.5 });
  });

  it('ignora il codice IVA di una lettera dopo il prezzo', () => {
    const righe = estraiRigheProdotto('LATTE PARMALAT 1L          1,20 B');
    expect(righe[0]).toMatchObject({ descrizione: 'LATTE PARMALAT 1L', importo: 1.2 });
  });

  it('non scambia il peso a metà riga per il prezzo (prende quello di fine riga)', () => {
    const righe = estraiRigheProdotto('MELE GOLDEN KG 1,200 X 2,50            3,00');
    expect(righe).toHaveLength(1);
    expect(righe[0].importo).toBe(3);
  });

  it('ignora le righe di intestazione/piè di pagina (totale, contante, resto, P.IVA...)', () => {
    const testo = [
      'ESSELUNGA SPA',
      'VIA ROMA 12 - MILANO',
      'P.IVA 12345678901',
      'PANE INTEGRALE 500G        2,50',
      'TOTALE EUR                12,50',
      'CONTANTE                  20,00',
      'RESTO                      7,50',
      'SCONTRINO FISCALE N. 123',
    ].join('\n');
    const righe = estraiRigheProdotto(testo);
    expect(righe).toHaveLength(1);
    expect(righe[0].descrizione).toBe('PANE INTEGRALE 500G');
  });

  it('ignora le righe di sconto (il segno meno non è gestito, ma la parola chiave "sconto" esclude comunque la riga)', () => {
    const righe = estraiRigheProdotto('SCONTO FEDELTA             -1,00');
    expect(righe).toHaveLength(0);
  });

  it('ignora righe senza un prezzo a due decimali validi', () => {
    const righe = estraiRigheProdotto('SCONTRINO N. 00123456');
    expect(righe).toHaveLength(0);
  });

  it('ignora righe vuote', () => {
    const righe = estraiRigheProdotto('PANE 2,50\n\n\nLATTE 1,20');
    expect(righe).toHaveLength(2);
  });

  it('ignora una riga il cui prezzo è tutto ciò che resta (descrizione troppo corta)', () => {
    const righe = estraiRigheProdotto('A 2,50');
    expect(righe).toHaveLength(0);
  });

  it('nessuna riga prodotto restituisce array vuoto', () => {
    expect(estraiRigheProdotto('TOTALE EUR 0,00')).toEqual([]);
  });

  it('gestisce un intero scontrino multi-prodotto', () => {
    const testo = [
      'PANE INTEGRALE 500G        2,50',
      'LATTE PARMALAT 1L          1,20',
      'POLLO PETTO KG 0,800       7,84',
      'DETERSIVO PIATTI           2,15',
      'TOTALE EUR                13,69',
    ].join('\n');
    const righe = estraiRigheProdotto(testo);
    expect(righe).toHaveLength(4);
    expect(righe.map(r => r.importo)).toEqual([2.5, 1.2, 7.84, 2.15]);
  });
});

describe('estraiTotale', () => {
  it('trova il totale ignorando il subtotale', () => {
    const testo = 'SUBTOTALE 10,00\nSCONTO -1,00\nTOTALE EUR 9,00';
    expect(estraiTotale(testo)).toBe(9);
  });

  it('restituisce null se nessuna riga totale è presente', () => {
    expect(estraiTotale('PANE 2,50\nLATTE 1,20')).toBeNull();
  });
});

describe('classificaCategoria', () => {
  it('riconosce una categoria da una parola chiave nella descrizione', () => {
    const { categoria } = classificaCategoria('PANE INTEGRALE 500G', CATEGORIE_DEFAULT);
    expect(categoria).toBe('pane e prodotti da forno');
  });

  it('è case-insensitive', () => {
    const { categoria } = classificaCategoria('latte parmalat 1l', CATEGORIE_DEFAULT);
    expect(categoria).toBe('latticini e uova');
  });

  it('restituisce categoria null e punteggio 0 se nessuna parola chiave corrisponde', () => {
    expect(classificaCategoria('ARTICOLO SCONOSCIUTO XYZ', CATEGORIE_DEFAULT)).toEqual({ categoria: null, punteggio: 0 });
  });

  it('una parola chiave più in alto nella lista pesa di più a parità di categoria', () => {
    const categorie = { bevande: ['vino rosso riserva', 'vino'] };
    const generico = classificaCategoria('VINO BIANCO 1L', categorie);
    const specifico = classificaCategoria('VINO ROSSO RISERVA 1L', categorie);
    expect(specifico.punteggio).toBeGreaterThan(generico.punteggio);
  });
});

describe('interpretaScontrino', () => {
  it('produce righe con categoria suggerita e il totale rilevato, da uno scontrino realistico', () => {
    const testo = [
      'ESSELUNGA SPA',
      'VIA ROMA 12 - MILANO',
      'P.IVA 12345678901',
      '',
      'PANE INTEGRALE 500G        2,50 B',
      'LATTE PARMALAT 1L          1,20 A',
      'MELE GOLDEN KG 1,200 X 2,50   3,00 B',
      'DETERSIVO PIATTI           2,15 A',
      '',
      'TOTALE EUR                 8,85',
      'CONTANTE                  10,00',
      'RESTO                      1,15',
      'SCONTRINO FISCALE',
    ].join('\n');

    const { righe, totaleRilevato } = interpretaScontrino(testo, CATEGORIE_DEFAULT);

    expect(righe).toHaveLength(4);
    expect(righe.find(r => r.descrizione.includes('PANE')).categoria).toBe('pane e prodotti da forno');
    expect(righe.find(r => r.descrizione.includes('LATTE')).categoria).toBe('latticini e uova');
    expect(righe.find(r => r.descrizione.includes('MELE')).categoria).toBe('frutta e verdura');
    expect(righe.find(r => r.descrizione.includes('DETERSIVO')).categoria).toBe('igiene e pulizia');
    expect(totaleRilevato).toBe(8.85);
  });

  it('lascia categoria null per una descrizione non riconosciuta, senza scartare la riga', () => {
    const { righe } = interpretaScontrino('GADGET MISTERIOSO XYZ      5,00', CATEGORIE_DEFAULT);
    expect(righe).toHaveLength(1);
    expect(righe[0].categoria).toBeNull();
  });
});
