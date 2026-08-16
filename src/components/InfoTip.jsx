import { useState } from 'react';
import { Info } from 'lucide-react';

/**
 * Icona informativa piccola: mostra "testo" in una bolla al passaggio del mouse o al focus da
 * tastiera, invece di un paragrafo descrittivo sempre visibile sotto ogni titolo di card. La
 * bolla usa i colori invertiti rispetto alla superficie circostante (sfondo = styles.testo,
 * testo = styles.card.background) cosi' risalta sia in chiaro che in scuro senza bisogno di due
 * varianti separate.
 */
export default function InfoTip({ testo, styles }) {
  const [visibile, setVisibile] = useState(false);

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onMouseEnter={() => setVisibile(true)}
        onMouseLeave={() => setVisibile(false)}
        onFocus={() => setVisibile(true)}
        onBlur={() => setVisibile(false)}
        style={{
          width: '16px', height: '16px', borderRadius: '50%', border: `1px solid ${styles.borderForte}`,
          background: 'transparent', color: styles.testoMuto, cursor: 'help', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <Info size={11} />
      </button>
      {visibile && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', bottom: '130%', left: 0, zIndex: 20, width: '230px',
            background: styles.testo, color: styles.card.background,
            fontSize: '11px', fontWeight: 500, lineHeight: 1.45, textAlign: 'left',
            padding: '9px 11px', borderRadius: '8px', boxShadow: '0 8px 20px -6px rgba(0,0,0,0.35)',
            pointerEvents: 'none',
          }}
        >
          {testo}
        </span>
      )}
    </span>
  );
}
