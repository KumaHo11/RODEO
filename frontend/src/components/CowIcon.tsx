// CowIcon — Professional cattle/cow icon in Lucide style
// Usage: <CowIcon className="w-4 h-4 text-current" />

export default function CowIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Body — main torso */}
      <path d="M4 13 C4 10 7 8.5 12 8.5 C17 8.5 20 10 20 13 C20 16 17.5 18 12 18 C6.5 18 4 16 4 13Z" />
      {/* Head */}
      <path d="M17 9 C17 6.5 18 5 19.5 5 C21 5 22 6 22 7.5 C22 9 21 10 19.5 10 C18.5 10 17.5 9.5 17 9Z" />
      {/* Neck connecting body to head */}
      <path d="M17 9 L17 11.5" />
      {/* Horn left */}
      <path d="M18 5.5 L16.5 3.5" />
      {/* Horn right */}
      <path d="M21 5.5 L22.5 3.5" />
      {/* Ear */}
      <path d="M22 7 L23.5 6.5" />
      {/* Nostril */}
      <circle cx="20.5" cy="9" r="0.5" fill="currentColor" stroke="none" />
      {/* Legs — 4 legs */}
      <line x1="7.5"  y1="17.5" x2="7"   y2="22" />
      <line x1="10.5" y1="18"   x2="10.5" y2="22" />
      <line x1="13.5" y1="18"   x2="13.5" y2="22" />
      <line x1="16.5" y1="17.5" x2="17"  y2="22" />
      {/* Tail */}
      <path d="M4 13 C2.5 12 2 10.5 3 9.5" />
      {/* Udder */}
      <path d="M9 17.5 Q12 19.5 15 17.5" strokeWidth="1.25" />
    </svg>
  )
}
