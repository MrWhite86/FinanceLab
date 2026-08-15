// Converte le pagine di un PDF in immagini (PNG), cosi' il motore OCR (motoreOcr.js, che sa
// leggere solo immagini, non il formato PDF) puo' analizzarle. Usa pdf.js (Mozilla), interamente
// offline nel webview: il worker è incluso nell'app sotto public/pdfjs/, non scaricato da un CDN.
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

const SCALA_RENDER = 2; // pagina più grande = testo più leggibile per l'OCR, a scapito della velocità

/** Disegna una pagina pdf.js già caricata su un canvas e ne restituisce i byte PNG. */
async function paginaAPng(pagina) {
  const viewport = pagina.getViewport({ scale: SCALA_RENDER });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await pagina.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Converte tutte le pagine di un PDF (byte grezzi, es. da Tauri fs.readBinaryFile) in altrettante
 * immagini PNG (byte). L'informazione utile (importo/scadenza) di una bolletta può stare su una
 * pagina diversa dalla prima, quindi le rasterizza tutte invece di fermarsi alla prima.
 */
export async function rasterizzaPaginePdf(bytes) {
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const immagini = [];
  for (let numeroPagina = 1; numeroPagina <= pdf.numPages; numeroPagina += 1) {
    const pagina = await pdf.getPage(numeroPagina);
    immagini.push(await paginaAPng(pagina));
  }
  return immagini;
}
