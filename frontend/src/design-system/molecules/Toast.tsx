import React from 'react';
import { twMerge } from 'tailwind-merge';

export type ToastSeverity = 'success' | 'alert' | 'system';

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  message?: string;
  severity?: ToastSeverity;
  timestamp?: string;
  onClose?: () => void;
}

const SEVERITY_BORDERS: Record<ToastSeverity, string> = {
  success: 'border-l-[var(--color-status-success)]',
  alert:   'border-l-[var(--color-status-warning)]',
  system:  'border-l-[var(--color-brand-dark)]',
};

export function Toast({
  title,
  message,
  severity = 'system',
  timestamp,
  onClose,
  className,
  ...props
}: ToastProps) {
  return (
    <div
      className={twMerge(
        'w-full max-w-sm bg-[var(--color-surface-light)] rounded-r-lg shadow-md flex overflow-hidden border-l-[4px]',
        SEVERITY_BORDERS[severity],
        className
      )}
      role="alert"
      {...props}
    >
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-[var(--color-text-main)] font-bold text-sm">
            {title}
          </h4>
          {timestamp && (
            <span className="text-[var(--color-earth-neutral)] text-xs whitespace-nowrap">
              {timestamp}
            </span>
          )}
        </div>
        {message && (
          <p className="mt-1 text-sm text-[var(--color-text-main)]">
            {message}
          </p>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-4 text-[var(--color-earth-neutral)] hover:bg-[var(--color-surface-muted)] transition-colors"
          aria-label="Cerrar notificación"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
