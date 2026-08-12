/**
 * Interpreta il contenuto testuale di un file JSON esportato dall'app e ne
 * applica le migrazioni note (formato "categorie"/"categoria" -> "tags").
 * Lancia se il JSON non è valido, cosi il chiamante puo mostrare "File corrotto.".
 */
export function parseImportedData(jsonString) {
  const json = JSON.parse(jsonString);

  let config;
  if (json.config) {
    config = { ...json.config };
    if (config.categorie && !config.tags) {
      config.tags = config.categorie;
      delete config.categorie;
    }
  }

  let spese;
  if (json.spese) {
    spese = json.spese.map(s =>
      (s.categoria && (!s.tags || s.tags.length === 0)) ? { ...s, tags: [s.categoria], categoria: undefined } : s
    );
  }

  return { config, spese };
}
