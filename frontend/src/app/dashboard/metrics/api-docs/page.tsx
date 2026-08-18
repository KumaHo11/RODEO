import React from 'react';

export default function ApiDocsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              API B2B v2 (REST)
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Documentación oficial para integraciones B2B</p>
          </div>
          <a href="/dashboard/metrics/marketplace" className="text-sm font-medium bg-green-50 text-green-700 px-4 py-2 rounded-lg hover:bg-green-100 border border-green-200">
            Ir al Marketplace
          </a>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4">Autenticación</h2>
            <p className="text-gray-700 mb-2">Todas las solicitudes a la API deben incluir una API key válida en los headers:</p>
            <div className="bg-gray-800 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
              X-RODEO-API-Key: rdeo_live_a1b2c3...
            </div>
            <p className="text-gray-500 mt-2 text-sm">Podés generar y administrar tus API keys desde el Marketplace.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4">Endpoints</h2>
            
            <div className="space-y-6">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-50 p-3 border-b flex gap-3 items-center">
                  <span className="font-bold bg-blue-600 text-white px-2 py-1 rounded text-sm">GET</span>
                  <span className="font-mono font-medium text-gray-900">/api/v2/metrics</span>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-gray-700 mb-3">Retorna métricas satelitales (NDVI, EVI, etc) crudas.</p>
                  <p className="font-medium text-sm text-gray-900 mb-1">Parámetros:</p>
                  <ul className="list-disc pl-5 text-sm text-gray-600 mb-3 space-y-1">
                    <li><code className="bg-gray-100 px-1 rounded">metric_type</code> (ej: NDVI)</li>
                    <li><code className="bg-gray-100 px-1 rounded">paddock_id</code> (ej: p_123)</li>
                    <li><code className="bg-gray-100 px-1 rounded">date_from</code> / <code className="bg-gray-100 px-1 rounded">date_to</code> (YYYY-MM-DD)</li>
                  </ul>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 p-3 border-b flex gap-3 items-center">
                  <span className="font-bold bg-green-600 text-white px-2 py-1 rounded text-sm">GET</span>
                  <span className="font-mono font-medium text-gray-900">/api/v2/compliance</span>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-gray-700">Retorna los scores de compliance (EUDR, EOV, GRSB) consolidados.</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-yellow-50 p-3 border-b flex gap-3 items-center">
                  <span className="font-bold bg-yellow-600 text-white px-2 py-1 rounded text-sm">GET</span>
                  <span className="font-mono font-medium text-gray-900">/api/v2/deforestation</span>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-gray-700">Retorna el estado de deforestación por potrero en formato GeoJSON.</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-purple-50 p-3 border-b flex gap-3 items-center">
                  <span className="font-bold bg-purple-600 text-white px-2 py-1 rounded text-sm">GET</span>
                  <span className="font-mono font-medium text-gray-900">/api/v2/report</span>
                </div>
                <div className="p-4 bg-white">
                  <p className="text-gray-700 mb-3">Genera y retorna un PDF MRV oficial de la plataforma.</p>
                  <p className="font-medium text-sm text-gray-900 mb-1">Parámetros:</p>
                  <ul className="list-disc pl-5 text-sm text-gray-600">
                    <li><code className="bg-gray-100 px-1 rounded">report_type</code> (full, eudr, eov, grsb)</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm text-gray-600 text-center">
              Para descargar la especificación OpenAPI completa, hacé un GET a <a href="/api/v2/openapi.json" className="text-blue-600 hover:underline">/api/v2/openapi.json</a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
