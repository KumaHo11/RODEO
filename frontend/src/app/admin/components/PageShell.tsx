/**
 * PageShell — wrapper reutilizable para páginas del Admin.
 * Muestra un sub-header limpio con título, contador y botones de acción (top-right).
 * Los botones de acción se pasan como children.
 */
export default function PageShell({
  label,
  count,
  countLabel,
  children,
  actions,
}: {
  label?: string
  count?: number
  countLabel?: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      {/* Sub-header: count (left) + actions (right) */}
      {(label || actions) && (
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            {count !== undefined && (
              <span className="font-semibold text-gray-700">{count.toLocaleString()}</span>
            )}{' '}
            {countLabel ?? label}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Page content */}
      {children}
    </div>
  )
}
