/**
 * RODEO Design System — Toggle Atom
 * ───────────────────────────────────
 * Switch binario para activar/desactivar funciones.
 * Accesible con role="switch" y aria-checked.
 */
import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface ToggleProps {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

export function Toggle({
  on,
  onChange,
  disabled = false,
  size = 'md',
  label,
  className,
}: ToggleProps) {
  const track = size === 'md'
    ? 'w-11 h-6'
    : 'w-8 h-4';

  const thumb = size === 'md'
    ? 'w-4 h-4 top-1'
    : 'w-2.5 h-2.5 top-0.75';

  const thumbPosition = on
    ? size === 'md' ? 'left-6' : 'left-4.5'
    : 'left-1';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className={twMerge(
        track,
        'rounded-full relative shrink-0 transition-colors duration-200',
        on ? 'bg-green-500' : 'bg-gray-200',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <div
        className={twMerge(
          thumb,
          thumbPosition,
          'absolute bg-white rounded-full shadow-sm transition-all duration-200'
        )}
      />
    </button>
  );
}
