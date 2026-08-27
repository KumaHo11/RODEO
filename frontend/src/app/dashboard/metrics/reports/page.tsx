'use client'

/**
 * /dashboard/metrics/reports — Constructor de informes MRV
 * Generá y descargá informes MRV personalizados para certificaciones.
 */
import React, { useState } from 'react'
import { Download, Mail, CheckCircle2, FileText, Leaf, Globe, ShieldCheck } from 'lucide-react'
import { Button } from '@/design-system'

// ── Tipos de informe ──────────────────────────────────────────────────────────

const REPORT_TYPES = [
  {
    id: 'full',
    label: 'Informe completo MRV',
    sublabel: 'EUDR + EOV + GRSB',
    description: 'Todas las normativas en un único documento consolidado.',
    icon: FileText,
  },
  {
    id: 'eudr',
    label: 'Solo EUDR',
    sublabel: 'Reglamento Europeo de Deforestación',
    description: 'Incluye análisis de deforestación y polígonos georreferenciados.',
    icon: Globe,
  },
  {
    id: 'eov',
    label: 'Solo EOV',
    sublabel: 'Savory Institute',
    description: 'Enfocado en regeneración ecológica y resultados EOV.',
    icon: Leaf,
  },
  {
    id: 'grsb',
    label: 'Solo GRSB',
    sublabel: 'Global Roundtable for Sustainable Beef',
    description: 'Evaluación de los cinco principios de sostenibilidad.',
    icon: ShieldCheck,
  },
]

// ── Página ────────────────────────────────────────────────────────────────────

export default function ReportBuilderPage() {
  const [selectedType, setSelectedType] = useState('full')
  const [dateFrom, setDateFrom] = useState('2020-01-01')
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [paddock, setPaddock] = useState('all')

  const selectedReport = REPORT_TYPES.find((r) => r.id === selectedType)

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-black text-gray-950">Constructor de informes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generá y descargá informes MRV personalizados para certificaciones y auditorías.
        </p>
      </div>

      {/* Paso 1: Tipo de informe */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo de informe</p>
        </div>

        <div className="divide-y divide-gray-100">
          {REPORT_TYPES.map((report) => {
            const Icon = report.icon
            const isSelected = selectedType === report.id
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedType(report.id)}
                className={`w-full flex items-start gap-4 px-5 py-4 text-left transition-colors ${
                  isSelected ? 'bg-green-50' : 'hover:bg-gray-50'
                }`}
                aria-pressed={isSelected}
              >
                {/* Icono */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isSelected ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-green-700' : 'text-gray-500'}`} />
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-bold ${isSelected ? 'text-green-900' : 'text-gray-900'}`}>
                      {report.label}
                    </p>
                    <span className={`text-xs font-semibold ${isSelected ? 'text-green-600' : 'text-gray-400'}`}>
                      {report.sublabel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{report.description}</p>
                </div>

                {/* Indicador de selección */}
                <CheckCircle2
                  className={`w-5 h-5 shrink-0 mt-0.5 transition-all ${
                    isSelected ? 'text-green-600' : 'text-gray-200'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </section>

      {/* Paso 2: Parámetros */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Parámetros</p>
        </div>

        <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Período */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Período
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
              />
              <span className="text-xs text-gray-400 shrink-0">hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
              />
            </div>
          </div>

          {/* Potrero */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Potrero
            </label>
            <select
              value={paddock}
              onChange={(e) => setPaddock(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors"
            >
              <option value="all">Todos los potreros</option>
              <option value="1">Lote 1</option>
              <option value="2">Lote 2</option>
            </select>
          </div>
        </div>
      </section>

      {/* Acciones */}
      <div className="flex gap-3 pt-1">
        <Button
          leftIcon={<Download className="w-4 h-4" />}
          size="md"
        >
          Descargar PDF
        </Button>
        <Button
          variant="outline"
          leftIcon={<Mail className="w-4 h-4" />}
          size="md"
        >
          Enviar por correo
        </Button>
      </div>

      {/* Nota informativa */}
      {selectedReport && (
        <p className="text-xs text-gray-400">
          Generando: <span className="font-bold text-gray-600">{selectedReport.label}</span>
          {' · '}{selectedReport.sublabel}
          {' · '}{dateFrom} → {dateTo}
        </p>
      )}
    </div>
  )
}
