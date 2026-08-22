/**
 * RODEO Design System — Card Organism
 * ─────────────────────────────────────
 * Contenedor de sección con variantes de padding, sombra
 * y acento de color superior.
 *
 * Subcomponentes:
 *   <Card>         – wrapper principal
 *   <CardHeader>   – título + subtítulo + ícono opcional
 *   <CardSection>  – sección interna con separador
 *   <CardFooter>   – área de acciones al pie
 */
import React from 'react';
import { twMerge } from 'tailwind-merge';

/* ── Card ── */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Relleno interior del card */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Añade una línea de acento en el borde superior */
  accentColor?: string;
  /** Sombra más pronunciada */
  elevated?: boolean;
}

const PADDINGS: Record<NonNullable<CardProps['padding']>, string> = {
  none: 'p-0',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
};

export function Card({
  className,
  padding = 'md',
  accentColor,
  elevated = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={twMerge(
        'relative bg-[var(--color-surface-light)] border border-[var(--color-border-default)] rounded-2xl overflow-hidden transition-all',
        elevated ? 'shadow-md' : 'shadow-sm',
        PADDINGS[padding],
        className
      )}
      {...props}
    >
      {accentColor && (
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
}

/* ── CardHeader ── */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Título de la sección */
  title: string;
  /** Subtítulo o descripción */
  subtitle?: string;
  /** Ícono opcional (lucide-react recomendado) */
  icon?: React.ReactNode;
  /** Elemento a la derecha (ej: botón de acción) */
  action?: React.ReactNode;
  /** ¿Aplicar mayúsculas con tracking? */
  uppercase?: boolean;
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  uppercase = true,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div className={twMerge('mb-5', className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="text-[var(--color-earth-neutral)] shrink-0" aria-hidden="true">
              {icon}
            </div>
          )}
          <h3 className={twMerge(
            'text-[11px] font-bold text-[var(--color-earth-neutral)]',
            uppercase && 'uppercase tracking-widest'
          )}>
            {title}
          </h3>
        </div>
        {action && (
          <div className="shrink-0">{action}</div>
        )}
      </div>
      {subtitle && (
        <p className="text-sm font-bold text-[var(--color-text-main)] mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ── CardSection ── */
export interface CardSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  noBorder?: boolean;
}

export function CardSection({
  children,
  noBorder = false,
  className,
  ...props
}: CardSectionProps) {
  return (
    <div
      className={twMerge(
        'py-4',
        !noBorder && 'border-t border-[var(--color-border-subtle)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ── CardFooter ── */
export function CardFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        'flex items-center justify-end gap-3 pt-4 mt-4 border-t border-[var(--color-border-default)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
