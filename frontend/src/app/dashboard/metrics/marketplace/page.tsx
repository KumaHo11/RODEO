'use client'

/**
 * /dashboard/metrics/marketplace — Mercado de Datos B2B · RODEO
 * Accesos a datos y claves de API para integraciones B2B.
 */
import React, { useState } from 'react'
import {
  Building2, Landmark, Key, Plus, Copy, CheckCheck, Trash2, Lock, ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/design-system'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Access {
  id: string
  name: string
  type: string
  level: string
  expires: string | null
  icon: React.ElementType
}

interface ApiKey {
  id: string
  preview: string
  createdAt: string
  lastUsed: string
}

// ── Datos de muestra (reemplazar con fetch real) ──────────────────────────────

const ACCESSES: Access[] = [
  {
    id: '1',
    name: 'Frigorífico Pampas SA',
    type: 'Exportador',
    level: 'READ',
    expires: '31/12',
    icon: Building2,
  },
  {
    id: '2',
    name: 'Banco Nación — Crédito Verde',
    type: 'Banco',
    level: 'REPORT',
    expires: null,
    icon: Landmark,
  },
]

const API_KEYS: ApiKey[] = [
  {
    id: 'k1',
    preview: 'rdeo_live_a1b2c3…',
    createdAt: '18/08',
    lastUsed: 'hoy',
  },
]

// ── Badge de nivel de acceso ──────────────────────────────────────────────────

const LEVEL_STYLES: Record<string, string> = {
  READ:   'bg-blue-50 text-blue-700 border-blue-100',
  REPORT: 'bg-green-50 text-green-700 border-green-100',
  WRITE:  'bg-amber-50 text-amber-700 border-amber-100',
}

const LEVEL_LABELS: Record<string, string> = {
  READ:   'Lectura',
  REPORT: 'Informe',
  WRITE:  'Escritura',
}

function LevelBadge({ level }: { level: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${LEVEL_STYLES[level] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
    >
      {LEVEL_LABELS[level] ?? level}
    </span>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">

      {/* Encabezado */}
      <div>
        <h1 className="text-2xl font-black text-gray-950">Mercado de datos B2B</h1>
        <p className="text-sm text-gray-500 mt-1">
          Compartí tus datos verificados con certificadoras, bancos y compradores.
        </p>
      </div>

      {/* Accesos activos */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-black text-gray-900">Accesos activos</h2>
            <p className="text-xs text-gray-400 mt-0.5">{ACCESSES.length} organizaciones con acceso</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Otorgar acceso
          </Button>
        </div>

        <div className="divide-y divide-gray-100">
          {ACCESSES.map((acc) => {
            const Icon = acc.icon
            return (
              <div key={acc.id} className="flex items-center gap-4 px-5 py-4">
                {/* Icono */}
                <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>

                {/* Información */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{acc.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-gray-400">{acc.type}</span>
                    <LevelBadge level={acc.level} />
                    {acc.expires && (
                      <span className="text-xs text-gray-400">Vence: {acc.expires}</span>
                    )}
                    {!acc.expires && (
                      <span className="text-xs text-gray-400">Sin vencimiento</span>
                    )}
                  </div>
                </div>

                {/* Acción */}
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                  aria-label={`Revocar acceso a ${acc.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Revocar
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Claves de API */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-gray-400" />
            <div>
              <h2 className="text-sm font-black text-gray-900">Claves de API</h2>
              <p className="text-xs text-gray-400 mt-0.5">Requiere plan Latifundio o superior</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Nueva clave
          </Button>
        </div>

        <div className="divide-y divide-gray-100">
          {API_KEYS.map((key) => (
            <div key={key.id} className="flex items-center gap-4 px-5 py-4">
              {/* Vista previa de la clave */}
              <div className="flex-1 min-w-0">
                <code className="text-sm font-mono text-gray-800 bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">
                  {key.preview}
                </code>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-gray-400">Creada: {key.createdAt}</span>
                  <span className="text-xs text-gray-400">Último uso: {key.lastUsed}</span>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleCopy(key.id, key.preview)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Copiar clave de API"
                >
                  {copied === key.id
                    ? <CheckCheck className="w-3.5 h-3.5 text-green-600" />
                    : <Copy className="w-3.5 h-3.5" />
                  }
                  {copied === key.id ? 'Copiado' : 'Copiar'}
                </button>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                  aria-label="Revocar clave de API"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Revocar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Enlace a documentación */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-2xl">
        <div className="flex items-center gap-3">
          <Lock className="w-4 h-4 text-gray-400 shrink-0" />
          <p className="text-sm text-gray-600">
            Revisá la documentación técnica para configurar integraciones B2B.
          </p>
        </div>
        <Link
          href="/dashboard/metrics/api-docs"
          className="flex items-center gap-1.5 text-sm font-bold text-green-700 hover:text-green-800 transition-colors shrink-0 ml-4"
        >
          Ver documentación
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}
