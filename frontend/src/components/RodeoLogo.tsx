/**
 * RodeoLogo — Wordmark SVG inline (fondo 100% transparente)
 * "RODEO" bold + "GANADERÍA DE PRECISIÓN" alineada al mismo ancho
 *
 * variant "light" → texto verde oscuro  (fondos blancos/claros)
 * variant "dark"  → texto blanco        (fondos oscuros: sidebar, login panel, hero)
 */

interface RodeoLogoProps {
  variant?: 'light' | 'dark' | 'green'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showTagline?: boolean
  iconOnly?: boolean   // no-op, mantenido por compatibilidad
  className?: string
}

export default function RodeoLogo({
  variant = 'light',
  size = 'md',
  showTagline = false,
  className = '',
}: RodeoLogoProps) {
  const isDark = variant === 'dark'

  const colWord    = isDark ? '#ffffff' : '#14532d'
  const colTagline = isDark ? 'rgba(255,255,255,0.6)' : '#9ca3af'

  // Alturas — header +20%, login +50% respecto a original
  const heights: Record<string, number> = {
    xs: 20,
    sm: 28,
    md: 36,   // header (+20%)
    lg: 48,
    xl: 72,   // login / registro (+50%)
  }
  const h = heights[size] ?? 36
  const viewH = showTagline ? 40 : 26

  return (
    <svg
      viewBox={`0 0 88 ${viewH}`}
      height={h}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Rodeo — Ganadería de Precisión"
      role="img"
      className={className}
      style={{ flexShrink: 0 }}
    >
      {/* RODEO — ancho ~84px en este viewBox */}
      <text
        x="0"
        y={showTagline ? '17' : '20'}
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="22"
        fontWeight="800"
        letterSpacing="1.5"
        fill={colWord}
        dominantBaseline="middle"
        textAnchor="start"
      >
        RODEO
      </text>

      {/* GANADERÍA DE PRECISIÓN — forzada al mismo ancho que RODEO */}
      {showTagline && (
        <text
          x="0"
          y="33"
          fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
          fontSize="6"
          fontWeight="400"
          fill={colTagline}
          dominantBaseline="middle"
          textAnchor="start"
          textLength="84"
          lengthAdjust="spacingAndGlyphs"
        >
          GANADERÍA DE PRECISIÓN
        </text>
      )}
    </svg>
  )
}
