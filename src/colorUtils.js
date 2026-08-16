// Funzioni pure per derivare varianti di un colore esadecimale (usato per far "seguire" il
// colore tema scelto dall'utente anche a superfici scure come la barra laterale, invece di
// avere lì un grigio fisso scollegato dalla personalizzazione).

/** Mescola un colore esadecimale verso il nero di una frazione (0=colore originale, 1=nero puro). */
export function scuraColore(hex, frazione) {
  const pulito = hex.replace('#', '');
  const r = parseInt(pulito.substring(0, 2), 16);
  const g = parseInt(pulito.substring(2, 4), 16);
  const b = parseInt(pulito.substring(4, 6), 16);
  const mescola = (canale) => Math.round(canale * (1 - frazione));
  const aEsa = (canale) => canale.toString(16).padStart(2, '0');
  return `#${aEsa(mescola(r))}${aEsa(mescola(g))}${aEsa(mescola(b))}`;
}
