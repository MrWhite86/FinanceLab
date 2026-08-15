import { describe, it, expect } from 'vitest';
import { mimeTypeDaNomeFile, tipoConAnteprima, bytesToBase64 } from './fileUtils';

describe('mimeTypeDaNomeFile', () => {
  it('riconosce le estensioni comuni di immagini e PDF', () => {
    expect(mimeTypeDaNomeFile('scontrino.pdf')).toBe('application/pdf');
    expect(mimeTypeDaNomeFile('foto.JPG')).toBe('image/jpeg'); // case-insensitive
    expect(mimeTypeDaNomeFile('foto.png')).toBe('image/png');
  });

  it('restituisce un tipo generico per estensioni sconosciute o assenti', () => {
    expect(mimeTypeDaNomeFile('documento.docx')).toBe('application/octet-stream');
    expect(mimeTypeDaNomeFile('senza-estensione')).toBe('application/octet-stream');
  });
});

describe('tipoConAnteprima', () => {
  it('è true solo per immagini e PDF, false per il resto', () => {
    expect(tipoConAnteprima('image/png')).toBe(true);
    expect(tipoConAnteprima('application/pdf')).toBe(true);
    expect(tipoConAnteprima('application/octet-stream')).toBe(false);
  });
});

describe('bytesToBase64', () => {
  it('produce una stringa base64 decodificabile che ricostruisce i byte originali', () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const base64 = bytesToBase64(bytes);
    expect(atob(base64)).toBe('Hello');
  });

  it('gestisce anche array più grandi del blocco di conversione (32KB)', () => {
    const bytes = new Uint8Array(0x8000 + 10).fill(65); // 'A' ripetuta, oltre la soglia di un blocco
    const base64 = bytesToBase64(bytes);
    expect(atob(base64)).toBe('A'.repeat(bytes.length));
  });
});
