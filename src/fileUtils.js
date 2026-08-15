// Piccole funzioni pure usate dall'anteprima degli allegati (vedi apriAnteprima in App.jsx).
// Nessuna dipendenza da Tauri/DOM qui dentro, così sono testabili in isolamento.

const MIME_PER_ESTENSIONE = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

/** Deduce il MIME type dall'estensione del nome file. 'application/octet-stream' per formati non riconosciuti (nessuna anteprima disponibile). */
export function mimeTypeDaNomeFile(nomeFile) {
  const estensione = (nomeFile || '').split('.').pop()?.toLowerCase();
  return MIME_PER_ESTENSIONE[estensione] || 'application/octet-stream';
}

/** True se per questo MIME type l'app sa mostrare un'anteprima (immagine o PDF); altrimenti si mostra solo il nome file. */
export function tipoConAnteprima(mimeType) {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

/**
 * Converte un array di byte (es. il risultato di Tauri fs.readBinaryFile) in una stringa base64,
 * per costruire una data URI da mostrare in <img>/<iframe>. Converte a blocchi per non superare
 * il limite di argomenti di String.fromCharCode su file grandi.
 */
export function bytesToBase64(bytes) {
  const CHUNK = 0x8000;
  let binario = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binario);
}
