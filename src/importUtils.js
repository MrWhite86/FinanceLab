// Logica di import dei backup JSON (pulsante "Importa" in Settings.jsx, gestito da App.jsx).
// Isolata in un modulo a parte, senza dipendenze da React/DOM, cosi' e' testabile
// direttamente (vedi importUtils.test.js) passandole semplice testo, senza dover
// simulare un vero upload di file nel browser.

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Un movimento e' importabile solo se ha una data in formato valido e un importo numerico. */
function isMovimentoValido(s) {
  return !!s && typeof s === 'object' && DATA_RE.test(s.data) && Number.isFinite(Number(s.importo));
}

/**
 * Interpreta il contenuto testuale di un file JSON esportato dall'app e ne
 * applica le migrazioni note (formato "categorie"/"categoria" -> "tags").
 * Lancia se il JSON non è valido, cosi il chiamante puo mostrare "File corrotto.".
 * I movimenti privi di data/importo validi vengono scartati (mai passati al resto dell'app,
 * dove andrebbero in crash), e conteggiati in skippedCount.
 */
export function parseImportedData(jsonString) {
  const json = JSON.parse(jsonString); // lancia SyntaxError se il file non e' JSON valido

  // Config: se il file usa il vecchio nome di campo "categorie", lo rinomina in "tags"
  // (nome corrente usato da tutto il resto dell'app).
  let config;
  if (json.config) {
    config = { ...json.config };
    if (config.categorie && !config.tags) {
      config.tags = config.categorie;
      delete config.categorie;
    }
  }

  // Spese: stessa migrazione ma a livello di singolo movimento (categoria singola -> array tags),
  // poi si scartano i record senza data/importo validi per non far crashare il resto dell'app.
  let spese;
  let skippedCount = 0;
  if (json.spese) {
    if (!Array.isArray(json.spese)) throw new Error('Il campo "spese" deve essere un elenco.');
    const migrate = (s) => (s && s.categoria && (!s.tags || s.tags.length === 0)) ? { ...s, tags: [s.categoria], categoria: undefined } : s;
    const migrated = json.spese.map(migrate);
    spese = migrated.filter(isMovimentoValido);
    skippedCount = migrated.length - spese.length;
  }

  return { config, spese, skippedCount };
}
