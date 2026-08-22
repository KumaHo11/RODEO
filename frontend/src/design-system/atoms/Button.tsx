/**
 * RODEO Design System — Button Atom
 * ─────────────────────────────────
 * Variantes:  primary | secondary | outline | ghost | danger
 * Tamaños:    sm | md | lg
 * Estados:    default | hover | active | disabled | loading
 */
import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Estilo visual del botón */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  /** Tamaño del botón */
  size?: 'sm' | 'md' | 'lg';
  /** Muestra un spinner y bloquea el botón */
  isLoading?: boolean;
  /** Ícono a la izquierda del texto */
  leftIcon?: React.ReactNode;
  /** Ícono a la derecha del texto */
  rightIcon?: React.ReactNode;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:   'bg-[var(--color-brand-vibrant)] text-[var(--color-surface-light)] hover:bg-[var(--color-brand-primary)] font-display font-bold shadow-sm',
  secondary: 'bg-transparent border-[1.5px] border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-muted)]',
  outline:   'border border-[var(--color-border-default)] text-[var(--color-earth-neutral)] hover:bg-[var(--color-surface-muted)]',
  ghost:     'bg-transparent text-[var(--color-earth-neutral)] hover:bg-[var(--color-surface-muted)]',
  danger:    'bg-[var(--color-status-error-bg)] text-[var(--color-status-error)] hover:bg-[var(--color-status-error-bg)]/80',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3.5 text-base',
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={twMerge(
        // Base
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold',
        'transition-all duration-200 active:scale-[0.97]',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading ? (
        <div
          className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && (
        <span className="shrink-0">{rightIcon}</span>
      )}
    </button>
  );
}
