'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw, ChevronDown, Info } from 'lucide-react'
import { useCarbonBalance } from './hooks/useCarbonBalance'

export default function CarbonDashboardPage() {
  const [year, setYear] = useState('2026')
  const { summary, paddockBreakdown, loading, error, refetch } = useCarbonBalance(year)
  const [calculating, setCalculating] = useState(false)

  const handleCalculate = async () => {
    // In a real app we would iterate through paddocks or call a batch endpoint
    // We'll simulate recalculating here
    try {
      setCalculating(true)
      // Call endpoint to estimate, hardcoded paddock for demonstration or rely on backend
      // await fetch('/api/carbon/estimate?paddock_id=...&period_from=2026-01&period_to=2026-12')
      await refetch()
    } finally {
      setCalculating(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-950">
            Huella de Carbono
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">IPCC Tier 1 · Proxy satelital SOC</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <select 
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="appearance-none bg-white border border-gray-200 rounded-xl py-2 pl-4 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="2026">Año: 2026</option>
              <option value="2025">Año: 2025</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button 
            onClick={handleCalculate}
            disabled={calculating || loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${calculating ? 'animate-spin' : ''}`} />
            Calcular / Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Error: {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border border-gray-200 rounded-2xl shadow-sm">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Emisiones Brutas</h3>
          <div className="text-3xl font-black text-gray-950 tabular-nums">
            {loading ? '-' : summary?.total_gross_tco2e.toFixed(1)} <span className="text-lg font-normal text-gray-500">tCO₂e/año</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">CH4 entérico + N2O</p>
        </div>
        
        <div className="p-6 border border-gray-200 rounded-2xl shadow-sm">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Secuestro SOC</h3>
          <div className="text-3xl font-black text-green-600 tabular-nums">
            {loading ? '-' : (summary?.total_sequestration_tco2e != null ? summary.total_sequestration_tco2e.toFixed(1) : '-')} <span className="text-lg font-normal text-gray-500">tCO₂e/año</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Proxy Sentinel-2</p>
        </div>

        <div className="p-6 border border-gray-200 rounded-2xl shadow-sm bg-gray-50">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Balance Neto</h3>
          <div className={`text-3xl font-black tabular-nums ${summary && summary.net_balance_tco2e < 0 ? 'text-green-600' : 'text-gray-950'}`}>
            {loading ? '-' : `${(summary?.net_balance_tco2e ?? 0) > 0 ? '+' : ''}${summary?.net_balance_tco2e?.toFixed(1) || '0.0'}`} <span className="text-lg font-normal text-gray-500">tCO₂e/año</span>
          </div>
          <p className="text-xs text-gray-500 mt-2">Neto verificable</p>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-black text-gray-950">Por Potrero</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-3">Potrero</th>
                <th className="px-6 py-3">Área</th>
                <th className="px-6 py-3">Carga Promedio</th>
                <th className="px-6 py-3">Emisiones</th>
                <th className="px-6 py-3">Secuestro</th>
                <th className="px-6 py-3">Balance</th>
                <th className="px-6 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">Cargando...</td>
                </tr>
              ) : paddockBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No hay datos de carbono para este año.</td>
                </tr>
              ) : (
                paddockBreakdown.map((p) => {
                  const isSink = p.net_balance_tco2e < 0
                  return (
                    <tr key={p.paddock_id} className="bg-white hover:bg-gray-50 transition-colors text-sm">
                      <td className="px-6 py-4 font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-4 text-gray-600">{p.area_ha.toFixed(1)} ha</td>
                      <td className="px-6 py-4 text-gray-600">{Math.round(p.avg_head_count)} cabezas</td>
                      <td className="px-6 py-4 text-gray-600">{p.gross_tco2e.toFixed(1)}</td>
                      <td className="px-6 py-4 text-gray-600 text-green-600">-{p.sequestration_tco2e.toFixed(1)}</td>
                      <td className={`px-6 py-4 font-medium ${isSink ? 'text-green-600' : 'text-gray-900'}`}>
                        {p.net_balance_tco2e > 0 ? '+' : ''}{p.net_balance_tco2e.toFixed(1)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                          isSink 
                            ? 'bg-green-50 text-green-700' 
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {isSink ? 'Sumidero' : 'Emisor'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-medium text-gray-800">Disclaimer metodológico</h4>
          <p className="text-sm text-gray-600 mt-1">
            Esta estimación usa IPCC Tier 1 + proxy satelital SOC. 
            Para certificación de créditos de carbono se requieren muestras de suelo bajo metodología Verra VM0026 o equivalente.
          </p>
        </div>
      </div>
    </div>
  )
}
