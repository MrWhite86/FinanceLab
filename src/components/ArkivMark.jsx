// Il simbolo del brand: la piramide a 3 livelli che legge sia come "A" di Arkiv sia come
// documenti impilati in ordine (vedi anche brand/icon-app-v3-monocromo.png, l'icona dell'app
// vera e propria, che aggiunge le parentesi quadre attorno a questo stesso simbolo).
// Un solo colore con opacità decrescente per livello, cosi' si adatta a qualunque sfondo
// (chiaro o scuro) passando solo "color", senza dover indicare 3 tonalità separate ogni volta.
export default function ArkivMark({ size = 28, color = '#FAFAFA' }) {
  return (
    <svg width={size} height={size * 0.95} viewBox="0 0 100 95">
      <path d="M50 6 L70 36 L30 36 Z" fill={color} />
      <path d="M27 42 L73 42 L83 67 L17 67 Z" fill={color} opacity="0.65" />
      <path d="M14 73 L86 73 L94 92 L6 92 Z" fill={color} opacity="0.35" />
    </svg>
  );
}
