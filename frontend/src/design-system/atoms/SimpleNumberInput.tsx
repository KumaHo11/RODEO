import React from 'react'
import clsx from 'clsx'

export interface SimpleNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
}

export function SimpleNumberInput({ label, error, className, ...props }: SimpleNumberInputProps) {
  return (
    <div className={clsx('flex flex-col', className)}>
      {label && <label className="text-xs font-bold text-gray-700 mb-1.5">{label}</label>}
      <input
        type="number"
        className={clsx(
          'w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-900',
          'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all',
          'placeholder:text-gray-400 font-tabular-nums',
          error && 'border-red-500 focus:ring-red-500'
        )}
        {...props}
      />
      {error && <p className="text-[10px] text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  )
}
