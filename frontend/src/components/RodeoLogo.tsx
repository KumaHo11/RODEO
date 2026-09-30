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
  xs: { name: 16, tagline: 8  },
  sm: { name: 22, tagline: 9  },
  md: { name: 28, tagline: 10 },
  lg: { name: 38, tagline: 12 },
  xl: { name: 56, tagline: 14 },
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

  const { name: namePx } = SIZES[size] ?? SIZES.md

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
      aria-label="RODEO"
    >
      {/* ── Brand name ─────────────────────────────── */}
      <img
        src={isDark ? '/RODEO.LogoHeaderBlanco.svg' : '/RODEO.LogoHeader.svg'}
        alt="RODEO"
        style={{ height: namePx, width: 'auto', display: 'block' }}
      />
    </div>
  )
}
