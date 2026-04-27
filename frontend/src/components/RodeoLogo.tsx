'use client'
/**
 * RodeoLogo — Solo Wordmark (Sin isotipo)
 * 
 * Basado en la última instrucción: "solo deja la palabra Rodeo".
 * Se eliminó el isotipo circular para mantener la máxima simplicidad.
 */

import React from 'react'

interface RodeoLogoProps {
  variant?: 'light' | 'dark'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showTagline?: boolean
  iconOnly?: boolean
  className?: string
}

const SIZES: Record<string, number> = {
  xs: 18,
  sm: 24,
  md: 32,
  lg: 44,
  xl: 64,
}

export default function RodeoLogo({
  variant = 'light',
  size = 'md',
  showTagline = true,
  iconOnly = false,
  className = '',
}: RodeoLogoProps) {
  const isDark = variant === 'dark'
  const fontSize = SIZES[size] ?? 32

  const wordColor = isDark ? '#ffffff' : '#14532d'
  const tagColor  = isDark ? 'rgba(255,255,255,0.7)' : '#16a34a'

  if (iconOnly) {
    return (
      <span
        className={className}
        role="img"
        aria-label="RODEO"
        style={{
          fontFamily: "'Inter', 'Google Sans', system-ui, sans-serif",
          fontWeight: 900,
          fontSize: fontSize,
          letterSpacing: '-0.03em',
          color: wordColor,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        R
      </span>
    )
  }

  return (
    <div
      className={`inline-flex flex-col ${className}`}
      style={{ lineHeight: 1, flexShrink: 0 }}
      role="img"
      aria-label="RODEO"
    >
      <span
        style={{
          fontFamily: "'Inter', 'Google Sans', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: fontSize,
          letterSpacing: '-0.03em',
          color: wordColor,
          lineHeight: 1,
        }}
      >
        RODEO
      </span>

      {showTagline && (
        <span
          style={{
            fontFamily: "'Inter', 'Google Sans', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: Math.max(9, Math.round(fontSize * 0.28)),
            letterSpacing: '0.12em',
            color: tagColor,
            marginTop: Math.round(fontSize * 0.1),
            lineHeight: 1,
            textTransform: 'uppercase',
          }}
        >
          Ganadería regenerativa
        </span>
      )}
    </div>
  )
}
