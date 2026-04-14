/**
 * RODEO Design System — FormField Molecule
 * ─────────────────────────────────────────
 * Combina: Label + Input + Error Message
 * Genera automáticamente el id entre label/input para accesibilidad.
 */
import React, { useId } from 'react';
import { twMerge } from 'tailwind-merge';
import { Input, InputProps } from '../atoms/Input';

export interface FormFieldProps extends InputProps {
  /** Texto del label (siempre requerido) */
  label: string;
  /** Mensaje de error a mostrar bajo el input */
  errorText?: string;
  /** Clases extras para el wrapper externo */
  wrapperClassName?: string;
}

export function FormField({
  label,
  errorText,
  className,
  wrapperClassName,
  id: externalId,
  ...props
}: FormFieldProps) {
  const internalId = useId();
  const inputId = externalId ?? internalId;

  return (
    <div className={twMerge('space-y-1.5 w-full', wrapperClassName)}>
      <label
        htmlFor={inputId}
        className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1"
      >
        {label}
      </label>

      <Input
        id={inputId}
        error={!!errorText}
        className={className}
        aria-describedby={errorText ? `${inputId}-error` : undefined}
        {...props}
      />

      {errorText && (
        <p
          id={`${inputId}-error`}
          role="alert"
          className="text-[10px] font-bold text-red-500 px-1 animate-in fade-in slide-in-from-top-1"
        >
          {errorText}
        </p>
      )}
    </div>
  );
}
