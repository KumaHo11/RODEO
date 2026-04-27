/**
 * CowIcon — Two cows silhouette (adult + calf) matching the provided reference icon.
 * Filled/solid style. Used ONLY in the sidebar navigation for "Rodeos".
 * Usage: <CowIcon className="w-5 h-5 text-current" />
 */
export default function CowIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 56 48"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
    >
      {/* ── Adult cow (larger, standing, right side) ────────────────────── */}
      {/* Body */}
      <ellipse cx="36" cy="28" rx="14" ry="9" />
      {/* Head */}
      <path d="M49 20 C49 16 51 14 53 14 C55 14 56 15.5 56 17.5 C56 20 54.5 21.5 52.5 21.5 C51 21.5 49.5 20.8 49 20Z" />
      {/* Neck */}
      <rect x="48.5" y="19" width="2" height="4" rx="1" />
      {/* Horn */}
      <path d="M52 14.5 L50.5 11.5 L52.5 12 Z" />
      {/* Ear */}
      <ellipse cx="55" cy="16" rx="1.5" ry="1" transform="rotate(-20 55 16)" />
      {/* Legs */}
      <rect x="25" y="36" width="3.5" height="9" rx="1.5" />
      <rect x="31" y="37" width="3.5" height="8" rx="1.5" />
      <rect x="38" y="37" width="3.5" height="8" rx="1.5" />
      <rect x="44" y="36" width="3.5" height="9" rx="1.5" />
      {/* Tail */}
      <path d="M22 26 C19 24 18 21 20 19 C21 18 22.5 19 22 20.5 C21.5 22 22 24 22 26Z" />
      {/* Udder */}
      <ellipse cx="36" cy="37.5" rx="5" ry="2" />

      {/* ── Calf (smaller, grazing, front/left) ────────────────────────── */}
      {/* Body */}
      <ellipse cx="16" cy="34" rx="10" ry="6.5" />
      {/* Neck angled down (grazing) */}
      <path d="M24 29 C26 26 27 24 26.5 22.5 L24.5 22.5 C24.5 23.5 23.5 25 22 28Z" />
      {/* Head (lowered, grazing) */}
      <path d="M26.5 22.5 C26.5 20 28 18.5 30 18.5 C32 18.5 33 20 33 21.5 C33 23.5 31.5 24.5 29.5 24.5 C28 24.5 26.5 23.5 26.5 22.5Z" />
      {/* Ear */}
      <ellipse cx="32" cy="19.5" rx="1.2" ry="0.8" transform="rotate(-15 32 19.5)" />
      {/* Horn nub */}
      <path d="M30 18.5 L29 16.5 L31 17 Z" />
      {/* Calf legs */}
      <rect x="8"  y="39" width="3" height="7.5" rx="1.3" />
      <rect x="13" y="39.5" width="3" height="7" rx="1.3" />
      <rect x="19" y="39.5" width="3" height="7" rx="1.3" />
      <rect x="23.5" y="39" width="3" height="7.5" rx="1.3" />
      {/* Calf tail */}
      <path d="M6 32 C4 30 3.5 27.5 5 26.5 C6 26 7 27 6.5 28.5 C6 30 6 31 6 32Z" />
    </svg>
  )
}
