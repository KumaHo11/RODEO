/**
 * RODEO Design System — Input Atom
 * ─────────────────────────────────
 * Soporta ícono izquierdo/derecho, estado de error, y focus accesible.
 * Siempre se renderiza dentro de un FormField para tener su label.
 */
import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Activa el estado de error (borde rojo) */
  error?: boolean;
  /** Ícono decorativo a la izquierda */
  leftIcon?: React.ReactNode;
  /** Ícono o acción a la derecha (ej: toggle password) */
  rightIcon?: React.ReactNode;
}

export function Input({
  className,
  error = false,
  leftIcon,
  rightIcon,
  id,
  ...props
}: InputProps) {
  return (
    <div className="relative w-full group">
      {leftIcon && (
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none
                     group-focus-within:text-green-600 transition-colors duration-200"
          aria-hidden="true"
        >
          {leftIcon}
        </div>
      )}

      <input
        id={id}
        className={twMerge(
          // Base
          'w-full bg-gray-50 border border-gray-200 rounded-xl',
          'text-sm font-bold text-gray-800',
          'px-4 py-3',
          'placeholder:text-gray-300 placeholder:font-normal',
          'transition-all duration-200 outline-none',
          // Focus
          'focus:bg-white focus:border-green-500/50 focus:ring-2 focus:ring-green-500/10',
          // Icon offsets
          leftIcon  && 'pl-11',
          rightIcon && 'pr-11',
          // Error state
          error && 'border-red-300 focus:border-red-400 focus:ring-red-100',
          className
        )}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />

      {rightIcon && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
          {rightIcon}
        </div>
      )}
    </div>
  );
}
