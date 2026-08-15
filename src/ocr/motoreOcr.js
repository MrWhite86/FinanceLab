// Motore OCR condiviso: legge il testo grezzo da un'immagine, senza sapere nulla di bollette,
// scontrini o altro dominio applicativo (quella logica vive in interpretaBolletta.js e simili).
// Pensato per essere riutilizzabile "a diversi livelli" dentro FinanceLab (e, in futuro, anche
// fuori) senza essere legato a React o alle API di Tauri: riceve byte grezzi, restituisce testo.
//
// Gira interamente offline nel webview tramite tesseract.js (WASM): nessuna chiamata di rete,
// nessuna chiave API. I file necessari (core WASM, worker, dati lingua italiana) sono inclusi
// nell'app sotto public/tesseract/ e public/tessdata/, invece di essere scaricati da un CDN
// (comportamento di default di tesseract.js), cosi' funziona anche senza connessione.
import { createWorker } from 'tesseract.js';

let workerPromise = null;

/** Crea (una sola volta, poi riusa) il worker Tesseract configurato per leggere solo file locali. */
function ottieniWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('ita', 1, {
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/tesseract-core-lstm.wasm.js',
      langPath: '/tessdata',
      gzip: false,
    });
  }
  return workerPromise;
}

/**
 * Estrae il testo grezzo da un'immagine (byte, es. il risultato di Tauri fs.readBinaryFile).
 * mimeType serve solo a costruire il Blob che tesseract.js sa leggere. Non tenta di leggere PDF
 * (tesseract.js lavora su immagini): per i PDF l'estrazione automatica non è disponibile.
 */
export async function estraiTestoDaImmagine(bytes, mimeType) {
  const worker = await ottieniWorker();
  const blob = new Blob([bytes], { type: mimeType });
  const { data } = await worker.recognize(blob);
  return data.text;
}
