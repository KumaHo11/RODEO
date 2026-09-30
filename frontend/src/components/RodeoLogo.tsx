'use client'

import React from 'react'

interface RodeoLogoProps {
  /**
   * 'white'  → logo blanco (sobre fondos oscuros o verdes)
   * 'green'  → logo verde (sobre fondos blancos / navbar scrolled)
   *
   * Aliases legacy: 'dark' = 'white', 'light' = 'green'
   */
  variant?: 'white' | 'green' | 'dark' | 'light'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** @deprecated — ya no renderiza tagline; se ignora */
  showTagline?: boolean
  /** @deprecated — renderiza sólo la letra R con el color correspondiente */
  iconOnly?: boolean
  className?: string
}

const HEIGHTS: Record<string, number> = {
  xs:  18,
  sm:  26,
  md:  34,
  lg:  44,
  xl:  60,
}

export default function RodeoLogo({
  variant = 'green',
  size = 'md',
  showTagline,   // eslint-disable-line @typescript-eslint/no-unused-vars
  iconOnly = false,
  className = '',
}: RodeoLogoProps) {
  // Normalise legacy aliases
  const isWhite = variant === 'white' || variant === 'dark'

  const logoSrc  = isWhite ? '/logos/logo-blanco.svg' : '/logos/logo-verde.svg'
  const heightPx = HEIGHTS[size] ?? HEIGHTS.md

  if (iconOnly) {
    // Fallback: single letter R with brand colour
    return (
      <span
        className={className}
        style={{
          fontFamily: "'Nunito', 'Poppins', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: heightPx,
          color: isWhite ? '#ffffff' : '#16a34a',
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}
      >
        R
      </span>
    )
  }

  return (
    /*
     * Regla del 80 %:
     *   El contenedor tiene padding lateral (10 % a cada lado) para que el logo
     *   respire y nunca ocupe el 100 % de la caja disponible.
     *   w-4/5 + mx-auto ó px-[10%] cumplen la misma función; usamos px-[10%]
     *   porque permite que el contenedor herede el ancho del padre sin clases extra.
     */
    <div
      className={`inline-flex items-center px-[10%] ${className}`}
      role="img"
      aria-label="RODEO"
    >
      <img
        src={logoSrc}
        alt="RODEO"
        style={{ height: heightPx, width: 'auto', display: 'block' }}
        draggable={false}
      />
    </div>
  )
}
