import React from 'react';

export default function MarketplacePage() {
  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Marketplace de Métricas
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Compartí tus datos con certificadores y compradores</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Accesos activos (2)</h2>
            </div>
            
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    📋 Frigorífico Pampas SA
                  </h3>
                  <div className="text-sm text-gray-500 mt-1 flex gap-3">
                    <span>Tipo: Exportador</span>
                    <span>•</span>
                    <span>Nivel: READ</span>
                    <span>•</span>
                    <span>Vence: 31/12</span>
                  </div>
                </div>
                <button className="text-red-600 text-sm font-medium hover:text-red-800">
                  [Revocar]
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    🏦 Banco Nación — Crédito Verde
                  </h3>
                  <div className="text-sm text-gray-500 mt-1 flex gap-3">
                    <span>Tipo: Banco</span>
                    <span>•</span>
                    <span>Nivel: REPORT</span>
                    <span>•</span>
                    <span>Sin vencimiento</span>
                  </div>
                </div>
                <button className="text-red-600 text-sm font-medium hover:text-red-800">
                  [Revocar]
                </button>
              </div>
            </div>

            <button className="mt-4 text-green-600 font-medium hover:text-green-700">
              [+ Otorgar nuevo acceso]
            </button>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">API Keys (feature LATIFUNDIO+)</h2>
            </div>
            
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg p-4 flex justify-between items-center bg-gray-50">
                <div className="font-mono text-sm text-gray-700 bg-white px-2 py-1 border rounded">
                  rdeo_live_a1b2c3...
                </div>
                <div className="text-sm text-gray-500 flex gap-3">
                  <span>Creada: 18/08</span>
                  <span>Últ.uso: hoy</span>
                </div>
                <div className="flex gap-3">
                  <button className="text-blue-600 text-sm font-medium hover:text-blue-800">
                    [Copiar]
                  </button>
                  <button className="text-red-600 text-sm font-medium hover:text-red-800">
                    [Revocar]
                  </button>
                </div>
              </div>
            </div>

            <button className="mt-4 text-green-600 font-medium hover:text-green-700">
              [+ Crear nueva API key]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
