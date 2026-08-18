import React from 'react';

export default function ReportBuilderPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Report Builder
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Generá y descargá reportes MRV personalizados para certificaciones</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-3">Seleccioná el tipo de reporte:</h2>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="radio" name="reportType" value="full" className="mt-1" defaultChecked />
                <div>
                  <div className="font-medium">Reporte Completo MRV (EUDR + EOV + GRSB)</div>
                  <div className="text-sm text-gray-500">Todas las normativas en un solo documento consolidado.</div>
                </div>
              </label>
              
              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="radio" name="reportType" value="eudr" className="mt-1" />
                <div>
                  <div className="font-medium">Solo EUDR — Reglamento Europeo de Deforestación</div>
                  <div className="text-sm text-gray-500">Incluye análisis de deforestación y polígonos.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="radio" name="reportType" value="eov" className="mt-1" />
                <div>
                  <div className="font-medium">Solo EOV — Savory Institute</div>
                  <div className="text-sm text-gray-500">Enfocado en regeneración ecológica y resultados EOV.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="radio" name="reportType" value="grsb" className="mt-1" />
                <div>
                  <div className="font-medium">Solo GRSB — Global Roundtable for Sustainable Beef</div>
                  <div className="text-sm text-gray-500">Evaluación de los cinco principios de sostenibilidad.</div>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
              <div className="flex gap-2">
                <input type="date" className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border p-2" defaultValue="2020-01-01" />
                <span className="self-center text-gray-500">hasta</span>
                <input type="date" className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border p-2" defaultValue="2026-08-18" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Potrero</label>
              <select className="block w-full rounded-md border-gray-300 shadow-sm sm:text-sm border p-2 bg-white">
                <option value="all">Todos los potreros</option>
                <option value="1">Lote 1</option>
                <option value="2">Lote 2</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 flex gap-4">
            <button className="bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 flex items-center gap-2">
              <span>🔽</span> Descargar PDF
            </button>
            <button className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-md font-medium hover:bg-gray-50 flex items-center gap-2">
              <span>📧</span> Enviar por email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
