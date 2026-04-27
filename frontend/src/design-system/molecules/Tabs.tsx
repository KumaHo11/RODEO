/**
 * RODEO Design System — Tabs Molecule
 * ─────────────────────────────────────
 * Navegación horizontal entre secciones.
 * Variantes: pill (default) y underline.
 * Soporta contadores de badges en cada tab.
 */
import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  /** Número a mostrar como badge (ej: notificaciones) */
  count?: number;
  /** Ícono opcional */
  icon?: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  variant?: 'pill' | 'underline';
  className?: string;
}

export function Tabs<T extends string>({
  items,
  activeTab,
  onChange,
  variant = 'pill',
  className,
}: TabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div className={twMerge('flex gap-0 border-b border-gray-100', className)}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            role="tab"
            aria-selected={activeTab === item.id}
            className={twMerge(
              'flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all',
              'border-b-2 -mb-px',
              activeTab === item.id
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            )}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span className={twMerge(
                'w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center',
                activeTab === item.id
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              )}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Default: pill variant
  return (
    <div
      role="tablist"
      className={twMerge('flex gap-1 p-1 bg-gray-100 rounded-xl w-fit', className)}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          role="tab"
          aria-selected={activeTab === item.id}
          className={twMerge(
            'flex items-center gap-1.5 flex-1 py-2 px-4 text-sm font-bold rounded-lg transition-all capitalize',
            activeTab === item.id
              ? 'bg-white text-green-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          {item.label}
          {item.count !== undefined && item.count > 0 && (
            <span className={twMerge(
              'w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center',
              activeTab === item.id ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
            )}>
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
