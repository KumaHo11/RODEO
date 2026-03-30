'use client'

import { Lightbulb, TrendingUp, CloudRain, AlertTriangle, ArrowRight } from 'lucide-react'
import { useState } from 'react'

export default function InsightsPage() {
  const [simulationCows, setSimulationCows] = useState(50)
  const [simulationMonths, setSimulationMonths] = useState(3)
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Inteligencia RODEO</h1>
        <p className="mt-2 text-sm text-gray-500">
          Resúmenes ejecutivos y simulaciones basadas en manejo holístico.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Resumen Ejecutivo */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg flex items-center font-bold text-gray-900 mb-4">
              <TrendingUp className="h-5 w-5 mr-2 text-green-600" /> Resumen Ejecutivo
            </h2>
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-md border border-green-100">
                <p className="text-sm font-medium text-green-800">Carga Animal Óptima</p>
                <p className="mt-1 text-sm text-green-700">Tu Equivalente Vaca actual está un 15% por debajo de la capacidad de carga calculada para esta época del año. Considera aprovechar el excedente de pastura.</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-md border border-orange-100">
                <p className="text-sm font-medium text-orange-800">Alerta de Descanso Corto</p>
                <p className="mt-1 text-sm text-orange-700">Un lote está planificado con 30 días de recuperación. El modelo holístico sugiere al menos 45 días considerando las lluvias recientes.</p>
              </div>
            </div>
          </div>

          {/* Simulador */}
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg flex items-center font-bold text-gray-900 mb-4">
              <Lightbulb className="h-5 w-5 mr-2 text-blue-600" /> Simulador de Escenarios (What-if)
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              ¿Qué pasaría si modifico mi carga animal en las próximas temporadas?
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agregar cabezas (Vacas)</label>
                <input type="number" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border text-gray-900 bg-white" value={simulationCows} onChange={(e) => setSimulationCows(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duración (Meses de pastoreo)</label>
                <input type="number" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border text-gray-900 bg-white" value={simulationMonths} onChange={(e) => setSimulationMonths(parseInt(e.target.value) || 0)} />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <h4 className="font-semibold text-gray-900 text-sm mb-2">Proyección Holística:</h4>
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li>El requerimiento de forraje aumentará en aprox. <strong>{simulationCows * 12 * simulationMonths} kg MS (Materia Seca)</strong>.</li>
                <li>Si el pronóstico de precipitaciones se mantiene bajo (La Niña), podrías enfrentar un <strong>déficit de pastura en el mes {simulationMonths}</strong>.</li>
                <li><strong>Sugerencia:</strong> Reduce los días de pastoreo a 2 días por lote y aumenta el descanso a 60 días en los potreros de menor calidad (Calidad 1-3).</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Clima y Pronósticos */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg flex items-center font-bold text-gray-900 mb-4">
              <CloudRain className="h-5 w-5 mr-2 text-blue-500" /> Variables Climáticas
            </h2>
            <div className="text-center py-6 border-b border-gray-100 mb-4">
              <span className="text-4xl font-bold text-gray-900">12 mm</span>
              <p className="text-sm text-gray-500 mt-1">Lluvias acumuladas (Últimos 30 días)</p>
            </div>
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-orange-500 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600">
                Las precipitaciones están un 25% por debajo del promedio histórico regional. Prioriza el descanso de pasturas de crecimiento primaveral.
              </p>
            </div>
          </div>

          <button className="w-full flex items-center justify-center p-4 rounded-lg bg-green-50 hover:bg-green-100 text-green-800 font-semibold border border-green-200 transition-colors">
            Generar Sugerencia de Rotación <ArrowRight className="h-4 w-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  )
}
