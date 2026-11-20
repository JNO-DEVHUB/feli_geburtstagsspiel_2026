// Gezeichnete Requisiten für Story und Trailer.

const INK = '#3B2A22';
const S = `stroke="${INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;

// Reisekoffer, aus dem Franks und Findi springen. Der Deckel (.case-lid) klappt per CSS auf.
export function suitcaseSvg() {
  return `<svg class="case-svg" viewBox="0 0 220 196" aria-hidden="true">
  <circle cx="52" cy="184" r="10" fill="${INK}"/><circle cx="168" cy="184" r="10" fill="${INK}"/>
  <rect x="14" y="58" width="192" height="120" rx="18" fill="#F07A1A" ${S}/>
  <rect x="24" y="56" width="172" height="16" rx="6" fill="#2a1b14"/>
  <rect x="48" y="72" width="20" height="104" fill="#B9520B"/><rect x="152" y="72" width="20" height="104" fill="#B9520B"/>
  <rect x="50" y="108" width="16" height="18" rx="3" fill="#FFD23F" stroke="${INK}" stroke-width="3"/><rect x="154" y="108" width="16" height="18" rx="3" fill="#FFD23F" stroke="${INK}" stroke-width="3"/>
  <path d="M92 150l5-22 9 10 6-16 6 16 9-10 5 22z" fill="#FFD23F" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  <path d="M96 96q14-10 28 0" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".55"/>
  <g class="case-lid">
    <path d="M86 30q0-18 24-18t24 18" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/>
    <path d="M86 30q0-18 24-18t24 18" fill="none" stroke="#8a5a3c" stroke-width="6" stroke-linecap="round"/>
    <rect x="14" y="26" width="192" height="40" rx="16" fill="#FF9A45" ${S}/>
    <path d="M30 58h160" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round"/>
  </g>
</svg>`;
}
