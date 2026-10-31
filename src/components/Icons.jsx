// Ikon SVG sederhana (dekoratif, disembunyikan dari pembaca layar).

const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true, focusable: 'false' };

export function LogoMark({ size = 40 }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 92 56" aria-hidden="true" focusable="false">
      <rect x="1.5" y="8" width="54" height="36" rx="6" fill="#0B3C49" />
      <circle cx="40" cy="24" r="6.5" fill="#00B8C8" />
      <rect x="9" y="18" width="18" height="3.4" rx="1.7" fill="#5FA9B4" />
      <rect x="9" y="25" width="13" height="3.4" rx="1.7" fill="#5FA9B4" />
      <rect x="9" y="34" width="38" height="3.4" rx="1.7" fill="#3A7F8B" />
      <g fill="none" stroke="#00B8C8" strokeLinecap="round" strokeWidth="3.2">
        <path d="M63 17 a14 14 0 0 1 0 19" />
        <path d="M71 11 a22 22 0 0 1 0 31" strokeOpacity=".7" />
        <path d="M79 5 a30 30 0 0 1 0 43" strokeOpacity=".4" />
      </g>
    </svg>
  );
}

export function IconCheck(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconWarn(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2.5L22.5 21h-21L12 2.5z" fill="currentColor" />
      <path d="M12 9v5.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="17.6" r="1.4" fill="#fff" />
    </svg>
  );
}

export function IconCross(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconBack(props) {
  return (
    <svg {...base} {...props}>
      <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSound(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconShield(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3z" fill="currentColor" />
      <path d="M8.5 12l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
