'use client'

import React from 'react'

interface RodeoLogoProps {
  variant?: 'light' | 'dark'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showTagline?: boolean
  iconOnly?: boolean
  className?: string
}

const SIZES: Record<string, { name: number; tagline: number }> = {
  xs: { name: 13, tagline: 8  },
  sm: { name: 16, tagline: 9  },
  md: { name: 20, tagline: 10 },
  lg: { name: 28, tagline: 12 },
  xl: { name: 40, tagline: 14 },
}

export default function RodeoLogo({
  variant = 'light',
  size = 'md',
  showTagline = true,
  iconOnly = false,
  className = '',
}: RodeoLogoProps) {
  const isDark   = variant === 'dark'
  const nameColor    = isDark ? '#ffffff' : '#16a34a'   // white on dark bg, green-600 on light
  const taglineColor = isDark ? 'rgba(255,255,255,0.75)' : '#4b7c59'

  const { name: namePx, tagline: taglinePx } = SIZES[size] ?? SIZES.md

  const font = "'Nunito', 'Poppins', 'Google Sans', system-ui, sans-serif"

  if (iconOnly) {
    return (
      <span
        className={className}
        style={{
          fontFamily: font,
          fontWeight: 800,
          fontSize: namePx,
          color: nameColor,
          letterSpacing: '-0.01em',
          lineHeight: 1,
        }}
      >
        R
      </span>
    )
  }

  return (
    <div
      className={`inline-flex flex-col ${className}`}
      style={{ lineHeight: 1 }}
      role="img"
      aria-label="RODEO – Ganadería Regenerativa"
    >
      {/* ── Brand name ─────────────────────────────── */}
      <span
        style={{
          fontFamily: font,
          fontWeight: 800,
          fontSize: namePx,
          letterSpacing: '0.04em',
          color: nameColor,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        RODEO
      </span>

      {/* ── Tagline ─────────────────────────────────── */}
      {showTagline && (
        <span
          style={{
            fontFamily: font,
            fontWeight: 300,
            fontSize: taglinePx,
            letterSpacing: '0.06em',
            color: taglineColor,
            marginTop: 15,
            lineHeight: 1,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Ganadería regenerativa
        </span>
      )}
    </div>
  )
}
