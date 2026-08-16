import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportaView from './Importa';
import { CATEGORIE_DEFAULT } from '../ocr/interpretaScontrino';

const styles = {
  card: {}, input: {}, label: {},
  btn: () => ({}),
};

const config = { anniAttivi: ['2026'], coloreTema: '#4f46e5', tags: [{ nome: 'documenti', tipo: 'neutro' }] };
const categorieScontrino = Object.keys(CATEGORIE_DEFAULT);

const risultatoScontrinoOcr = {
  testo: 'finto testo ocr',
  totaleRilevato: 3.7,
  righe: [
    { descrizione: 'PANE INTEGRALE 500G', importo: 2.5, categoria: 'pane e prodotti da forno', testoOriginale: '' },
    { descrizione: 'LATTE PARMALAT 1L', importo: 1.2, categoria: 'latticini e uova', testoOriginale: '' },
  ],
};

/** Apre il pannello "Crea nuovo record" e passa alla modalità Scontrino, per non ripetere questi passaggi in ogni test. */
async function apriModalitaScontrino(props) {
  render(<ImportaView {...props} />);
  await userEvent.click(screen.getByText('Crea nuovo record'));
  await userEvent.click(screen.getByText('Scontrino'));
}

describe('ImportaView - modalità Scontrino', () => {
  it('estrae le righe, le mostra modificabili e conferma crea 1 voce madre + N sottovoci', async () => {
    const onLeggiFileCattura = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    const onEstraiScontrino = vi.fn().mockResolvedValue(risultatoScontrinoOcr);
    const onCreaRecordScontrino = vi.fn();

    await apriModalitaScontrino({
      fileDaImportare: ['scontrino.jpg'], percorsoCattura: '/tmp/cattura', spese: [], config, styles, isMobile: false,
      onRiscansiona: () => {}, onAllegaEsistente: () => {}, onCreaRecord: () => {}, onCreaRecordScontrino,
      onIgnoraFile: () => {}, onLeggiFileCattura, onEstraiDatiOcr: () => {}, onEstraiScontrino,
      onImparaOcrFornitore: () => {}, categorieScontrino, showToast: () => {},
    });

    await userEvent.click(screen.getByText('Estrai righe automaticamente'));

    // Le due righe rilevate compaiono come campi modificabili, precompilati con quanto trovato dall'OCR.
    expect(await screen.findByDisplayValue('PANE INTEGRALE 500G')).toBeInTheDocument();
    expect(screen.getByDisplayValue('LATTE PARMALAT 1L')).toBeInTheDocument();
    expect(onLeggiFileCattura).toHaveBeenCalledWith('scontrino.jpg');
    expect(onEstraiScontrino).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), 'image/jpeg');

    const nomeNegozio = screen.getByPlaceholderText('Descrizione del record...');
    await userEvent.clear(nomeNegozio);
    await userEvent.type(nomeNegozio, 'Esselunga');

    await userEvent.click(screen.getByText('Registra scontrino (2 voci)'));

    expect(onCreaRecordScontrino).toHaveBeenCalledTimes(1);
    const [nomeFile, anno, campi] = onCreaRecordScontrino.mock.calls[0];
    expect(nomeFile).toBe('scontrino.jpg');
    expect(anno).toBe('2026');
    expect(campi.nota).toBe('Esselunga');
    expect(campi.righe).toEqual([
      { descrizione: 'PANE INTEGRALE 500G', importo: 2.5, categoria: 'pane e prodotti da forno' },
      { descrizione: 'LATTE PARMALAT 1L', importo: 1.2, categoria: 'latticini e uova' },
    ]);
  });

  it('rimuovere una riga la esclude dalla conferma e aggiorna il conteggio sul bottone', async () => {
    const onCreaRecordScontrino = vi.fn();
    await apriModalitaScontrino({
      fileDaImportare: ['scontrino.jpg'], percorsoCattura: '/tmp/cattura', spese: [], config, styles, isMobile: false,
      onRiscansiona: () => {}, onAllegaEsistente: () => {}, onCreaRecord: () => {}, onCreaRecordScontrino,
      onIgnoraFile: () => {}, onLeggiFileCattura: vi.fn().mockResolvedValue(new Uint8Array()),
      onEstraiDatiOcr: () => {}, onEstraiScontrino: vi.fn().mockResolvedValue(risultatoScontrinoOcr),
      onImparaOcrFornitore: () => {}, categorieScontrino, showToast: () => {},
    });

    await userEvent.click(screen.getByText('Estrai righe automaticamente'));
    await screen.findByDisplayValue('PANE INTEGRALE 500G');

    const rigaLatte = screen.getByDisplayValue('LATTE PARMALAT 1L').closest('div');
    await userEvent.click(within(rigaLatte).getByText((_, el) => el.tagName === 'svg' && el.classList.contains('lucide-trash2')));

    expect(screen.queryByDisplayValue('LATTE PARMALAT 1L')).not.toBeInTheDocument();
    expect(screen.getByText('Registra scontrino (1 voci)')).toBeInTheDocument();
  });

  it('aggiungere una riga manuale la include nella conferma', async () => {
    const onCreaRecordScontrino = vi.fn();
    await apriModalitaScontrino({
      fileDaImportare: ['scontrino.jpg'], percorsoCattura: '/tmp/cattura', spese: [], config, styles, isMobile: false,
      onRiscansiona: () => {}, onAllegaEsistente: () => {}, onCreaRecord: () => {}, onCreaRecordScontrino,
      onIgnoraFile: () => {}, onLeggiFileCattura: vi.fn().mockResolvedValue(new Uint8Array()),
      onEstraiDatiOcr: () => {}, onEstraiScontrino: vi.fn().mockResolvedValue({ testo: '', totaleRilevato: null, righe: [] }),
      onImparaOcrFornitore: () => {}, categorieScontrino, showToast: () => {},
    });

    await userEvent.click(screen.getByText('Estrai righe automaticamente'));
    await userEvent.click(await screen.findByText('Aggiungi riga'));

    await userEvent.type(screen.getByPlaceholderText('Descrizione...'), 'Detersivo piatti');
    await userEvent.type(screen.getByPlaceholderText('€'), '2.15');
    await userEvent.type(screen.getByPlaceholderText('Descrizione del record...'), 'Coop');

    await userEvent.click(screen.getByText('Registra scontrino (1 voci)'));

    expect(onCreaRecordScontrino.mock.calls[0][2].righe).toEqual([
      { descrizione: 'Detersivo piatti', importo: 2.15, categoria: null },
    ]);
  });
});
