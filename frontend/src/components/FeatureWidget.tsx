import React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';

interface FeatureWidgetProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  isFeatureEnabled: boolean;
  requiredPlan?: 'holistico' | 'enterprise';
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
  href?: string;
}

export function FeatureWidget({
  title,
  icon,
  children,
  isFeatureEnabled,
  requiredPlan = 'holistico',
  onAction,
  actionLabel,
  className = '',
  href
}: FeatureWidgetProps) {
  const isEnterprise = requiredPlan === 'enterprise';

  const widgetContent = (
    <div className={`relative flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full ${className}`}>
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
        <h2 className="text-sm font-bold flex items-center gap-2 text-gray-900">
          {icon}
          {title}
        </h2>
        {isFeatureEnabled && actionLabel && (
          href ? (
            <Link href={href} className="text-xs font-bold text-green-600 hover:underline flex items-center gap-1">
              {actionLabel}
            </Link>
          ) : (
            <button onClick={onAction} className="text-xs font-bold text-green-600 hover:underline flex items-center gap-1">
              {actionLabel}
            </button>
          )
        )}
      </div>

      {/* Body */}
      <div className="relative flex-1 p-4 flex flex-col">
        {isFeatureEnabled ? (
          children
        ) : (
          isEnterprise ? (
            <>
              <div className="blur-sm opacity-50 select-none pointer-events-none absolute inset-0 p-4">
                {children}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/30 backdrop-blur-md z-10 p-6 text-center">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mb-3">
                  <Lock className="w-6 h-6 text-amber-600" />
                </div>
                <p className="text-sm font-bold text-gray-900 mb-2">Desbloquea esta métrica en el Plan Enterprise.</p>
                <Link href="/dashboard/planes" className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-800 transition-colors">
                  Ver planes
                </Link>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 text-gray-300">
                <Lock className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-gray-400">Vista disponible únicamente para el Plan Holístico</p>
              <Link href="/dashboard/planes" className="mt-3 px-4 py-2 bg-green-50 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 transition-colors">
                Mejorar plan
              </Link>
            </div>
          )
        )}
      </div>
    </div>
  );

  return widgetContent;
}
