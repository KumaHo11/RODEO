import React from 'react'
import { X, Table as TableIcon } from 'lucide-react'

interface Props {
  plan: any
  onClose: () => void
}

export default function RawDataModal({ plan, onClose }: Props) {
  const tableData = plan?.metrics?.raw_table

  if (!tableData) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-xl">
          <p className="text-sm font-bold text-gray-700">No hay tabla de datos asociada a este plan.</p>
          <button onClick={onClose} className="mt-4 px-6 py-2 bg-green-600 text-white font-bold rounded-xl text-sm">Cerrar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm">
              <TableIcon className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">{plan.name}</h3>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mt-0.5">
                Datos Crudos Originales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-400 transition-all shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100/50">
                  <tr>
                    {tableData.headers.map((h: string, i: number) => (
                      <th key={i} className="px-4 py-3 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap whitespace-pre-wrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {tableData.rows.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                      {tableData.headers.map((h: string, j: number) => {
                        const val = row[h]
                        return (
                          <td key={j} className="px-4 py-3 whitespace-nowrap text-xs font-medium text-gray-700">
                            {val !== undefined && val !== null ? String(val) : '-'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
