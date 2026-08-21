/**
 * /dashboard/metrics/api-docs — Portal de desarrolladores API B2B · RODEO
 * Documentación técnica para integraciones externas.
 */
import React from 'react'
import { Code2, ExternalLink, ArrowRight } from 'lucide-react'
import Link from 'next/link'

// ── Badge de método HTTP ───────────────────────────────────────────────────────

const METHOD_STYLES: Record<string, string> = {
  GET:    'bg-blue-50 text-blue-700 border-blue-100',
  POST:   'bg-green-50 text-green-700 border-green-100',
  PUT:    'bg-amber-50 text-amber-700 border-amber-100',
  DELETE: 'bg-red-50 text-red-700 border-red-100',
  PATCH:  'bg-violet-50 text-violet-700 border-violet-100',
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-widest border font-mono ${METHOD_STYLES[method] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
    >
      {method}
    </span>
  )
}

// ── Código en línea ────────────────────────────────────────────────────────────

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-[12px] font-mono bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">
      {children}
    </code>
  )
}

// ── Tarjeta de endpoint ────────────────────────────────────────────────────────

interface EndpointProps {
  method: string
  path: string
  description: string
  params?: Array<{ name: string; example: string }>
}

function EndpointCard({ method, path, description, params }: EndpointProps) {
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      {/* Cabecera del endpoint */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <MethodBadge method={method} />
        <code className="text-sm font-mono font-bold text-gray-900">{path}</code>
      </div>
      {/* Cuerpo */}
      <div className="px-4 py-4 bg-white space-y-3">
        <p className="text-sm text-gray-600">{description}</p>
        {params && params.length > 0 && (
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Parámetros</p>
            <ul className="space-y-1.5">
              {params.map((p) => (
                <li key={p.name} className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                  <InlineCode>{p.name}</InlineCode>
                  <span className="text-gray-400">— ej:</span>
                  <InlineCode>{p.example}</InlineCode>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  return (
    <div className="p-6 space-y-8 max-w-3xl">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-950">Documentación API B2B v2</h1>
          <p className="text-sm text-gray-500 mt-1">
            Integración externa vía REST / JSON · Autenticación por clave de API.
          </p>
        </div>
        <Link
          href="/dashboard/metrics/marketplace"
          className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-50 border border-green-200 text-sm font-bold text-green-700 hover:bg-green-100 transition-colors"
        >
          Mercado B2B
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Autenticación */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-black text-gray-900">Autenticación</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Incluí tu clave de API en el encabezado de cada solicitud.
          </p>
        </div>

        {/* Bloque de código */}
        <div className="rounded-2xl bg-gray-900 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
            <Code2 className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-mono text-gray-400">Encabezado HTTP</span>
          </div>
          <pre className="px-4 py-4 text-sm font-mono text-green-400 overflow-x-auto">
            {`X-RODEO-API-Key: rdeo_live_a1b2c3...`}
          </pre>
        </div>

        <p className="text-sm text-gray-500">
          Generá y administrá tus claves de API desde el{' '}
          <Link href="/dashboard/metrics/marketplace" className="text-green-700 font-bold hover:underline">
            Mercado B2B
          </Link>.
        </p>
      </section>

      {/* Endpoints */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-black text-gray-900">Endpoints</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            URL base: <InlineCode>https://api.rodeo.farm/v2</InlineCode>
          </p>
        </div>

        <EndpointCard
          method="GET"
          path="/api/v2/metrics"
          description="Retorna métricas satelitales (NDVI, EVI, SAVI, etc.) en crudo para un potrero y rango de fechas."
          params={[
            { name: 'metric_type', example: 'NDVI' },
            { name: 'paddock_id', example: 'p_123' },
            { name: 'date_from / date_to', example: '2024-01-01' },
          ]}
        />

        <EndpointCard
          method="GET"
          path="/api/v2/compliance"
          description="Retorna los puntajes de cumplimiento consolidados (EUDR, EOV, GRSB)."
        />

        <EndpointCard
          method="GET"
          path="/api/v2/deforestation"
          description="Retorna el estado de deforestación por potrero en formato GeoJSON, referenciado a la fecha de corte EUDR (31/12/2020)."
        />

        <EndpointCard
          method="GET"
          path="/api/v2/report"
          description="Genera y retorna un PDF MRV oficial de la plataforma para el rango de fechas seleccionado."
          params={[
            { name: 'report_type', example: 'full | eudr | eov | grsb' },
          ]}
        />
      </section>

      {/* Especificación OpenAPI */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-2xl">
        <p className="text-sm text-gray-600">
          Especificación OpenAPI completa disponible en{' '}
          <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">/api/v2/openapi.json</code>
        </p>
        <a
          href="/api/v2/openapi.json"
          className="flex items-center gap-1.5 text-sm font-bold text-green-700 hover:text-green-800 transition-colors shrink-0 ml-4"
          target="_blank"
          rel="noopener noreferrer"
        >
          Descargar
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  )
}
