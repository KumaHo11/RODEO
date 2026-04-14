/**
 * RODEO Design System — EmptyState Organism
 * ───────────────────────────────────────────
 * Pantalla vacía estándar para listas, tablas y módulos sin datos.
 */
import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  emoji,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={twMerge(
        'flex flex-col items-center justify-center py-20 text-center',
        className
      )}
    >
      {(icon || emoji) && (
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          {emoji ? (
            <span className="text-2xl">{emoji}</span>
          ) : (
            <span className="text-gray-400">{icon}</span>
          )}
        </div>
      )}
      <p className="text-sm font-black text-gray-700">{title}</p>
      {description && (
        <p className="text-xs text-gray-400 mt-1 max-w-[240px] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
