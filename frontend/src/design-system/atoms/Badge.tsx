/**
 * RODEO Design System — Badge Atom
 * ─────────────────────────────────
 * Etiqueta compacta para estados, categorías o conteos.
 * Variantes de color semántico y tamaños xs/sm.
 */
import React from 'react';
import { twMerge } from 'tailwind-merge';

export type BadgeVariant =
  | 'gray'
  | 'green'
  | 'amber'
  | 'red'
  | 'blue'
  | 'violet'
  | 'cyan'
  | 'orange'
  | 'indigo';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'xs' | 'sm';
  dot?: boolean;
  icon?: React.ReactNode;
  uppercase?: boolean;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  gray:   'bg-gray-100 text-gray-700',
  green:  'bg-green-100 text-green-800',
  amber:  'bg-amber-100 text-amber-800',
  red:    'bg-red-100 text-red-700',
  blue:   'bg-blue-100 text-blue-800',
  violet: 'bg-violet-100 text-violet-800',
  cyan:   'bg-cyan-100 text-cyan-800',
  orange: 'bg-orange-100 text-orange-800',
  indigo: 'bg-indigo-100 text-indigo-800',
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  gray:   'bg-gray-400',
  green:  'bg-green-500',
  amber:  'bg-amber-500',
  red:    'bg-red-500',
  blue:   'bg-blue-500',
  violet: 'bg-violet-500',
  cyan:   'bg-cyan-500',
  orange: 'bg-orange-500',
  indigo: 'bg-indigo-500',
};

export function Badge({
  children,
  variant = 'gray',
  size = 'xs',
  dot = false,
  icon,
  uppercase = true,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center gap-1 rounded-full font-black',
        uppercase && 'uppercase tracking-widest',
        size === 'xs' ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1',
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={twMerge('w-1.5 h-1.5 rounded-full shrink-0', DOT_CLASSES[variant])} />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
