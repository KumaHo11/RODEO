'use client'

/**
 * HerdCreatePanel — Panel inline de creación de un nuevo rodeo.
 *
 * v2: Categorías fenológicas, CustomSelect para Raza, navegación por slug.
 */

import React, { useState, useMemo } from 'react'
import clsx from 'clsx'
import { useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import {
  CATEGORIA_LABEL_RAE,
  CATEGORIA_COLORS,
  CATEGORIA_PESO_DEFAULT,
  CATEGORIA_REF,
  RAZAS_POR_CATEGORIA,
  type CategoriaComercial,
} from '@/lib/categorias'
import { calculateBaseEV } from '@/lib/grazing/evProjection'
import { todayISO } from '@/lib/utils/dates'
import { toHerdSlug } from '@/components/herds/layout/HerdDetailPanel'
import { CustomSelect, type SelectOption } from '@/components/ui/CustomSelect'
import Link from 'next/link'

const FIELD  = 'w-full border-2 border-gray-200 rounded-xl px-3.5 py-3 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-white'
const LABEL  = 'text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block'

// ── Categorías fenológicas ─────────────────────────────────────────────────────
// Cada opción mapea: etiqueta UI → CategoriaComercial + physiological_category
// para calcular el EV con la máxima precisión.

interface FenoOption {
  label:      string           // texto mostrado en UI
  catKey:     CategoriaComercial
  physio:     string           // physiological_category
  evMult:     number           // multiplicador EV aproximado (informativo)
  hint:       string
}

const FENO_GROUPS: { group: string; hint: string; opts: FenoOption[] }[] = [
  {
    group: 'Vacas',
    hint: 'Hembras adultas. EV varía según estado reproductivo.',
    opts: [
      { label: 'Vaca vacía',              catKey: 'VACAS', physio: 'VACIA',       evMult: 0.90, hint: 'ref. 400 kg · EV ≈ 0.90' },
      { label: 'Vaca preñada',            catKey: 'VACAS', physio: 'PRENADA',     evMult: 1.00, hint: 'ref. 430 kg · EV ≈ 1.00' },
      { label: 'Vaca con ternero al pie', catKey: 'VACAS', physio: 'CON_TERNERO', evMult: 1.25, hint: 'ref. 380 kg · EV ≈ 1.25' },
    ],
  },
  {
    group: 'Recría / Crecimiento',
    hint: 'En crecimiento. EV crece con el peso vivo.',
    opts: [
      { label: 'Ternero/a',     catKey: 'TERNEROS',    physio: 'DESTETE', evMult: 0.25, hint: 'ref. 150 kg · EV ≈ 0.25' },
      { label: 'Novillito',     catKey: 'NOVILLITOS',  physio: 'RECRIA',  evMult: 0.55, hint: 'ref. 250 kg · EV ≈ 0.55' },
      { label: 'Novillo',       catKey: 'NOVILLOS',    physio: 'ENGORDE', evMult: 0.80, hint: 'ref. 380 kg · EV ≈ 0.80' },
      { label: 'Vaquillona',    catKey: 'VAQUILLONAS', physio: 'RECRIA',  evMult: 0.70, hint: 'ref. 310 kg · EV ≈ 0.70' },
    ],
  },
  {
    group: 'Toros',
    hint: 'Machos reproductores. Mayor requerimiento MS.',
    opts: [
      { label: 'Toro en descanso', catKey: 'TOROS', physio: 'DESCANSO', evMult: 1.35, hint: 'ref. 600 kg · EV ≈ 1.35' },
      { label: 'Toro en servicio', catKey: 'TOROS', physio: 'SERVICIO', evMult: 1.50, hint: 'ref. 620 kg · EV ≈ 1.50' },
    ],
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function HerdCreatePanel() {
  const router = useRouter()

  const [name,      setName]      = useState('')
  const [fenoOpt,   setFenoOpt]   = useState<FenoOption | null>(null)
  const [breed,     setBreed]     = useState('')
  const [count,     setCount]     = useState<number | ''>(50)
  const [weight,    setWeight]    = useState<number | ''>('')
  const [admDate,   setAdmDate]   = useState(todayISO())
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const catKey      = fenoOpt?.catKey ?? null
  const catColors   = catKey ? CATEGORIA_COLORS[catKey] : null
  const defaultPeso = catKey ? CATEGORIA_PESO_DEFAULT[catKey] : undefined
  const catRef      = catKey ? CATEGORIA_REF[catKey] : undefined
  const razas       = catKey ? (RAZAS_POR_CATEGORIA[catKey] ?? []) : []

  // Opciones de raza para el CustomSelect
  const razaOptions: SelectOption[] = [
    { value: '', label: '— Sin especificar —' },
    ...razas.map(r => ({ value: r, label: r })),
  ]

  const ev = useMemo(() => {
    if (!catKey || !count) return null
    const w = weight !== '' ? Number(weight) : (defaultPeso ?? 400)
    return calculateBaseEV(catKey, w, Number(count))
  }, [catKey, count, weight, defaultPeso])

  const canSave = !!name.trim() && !!fenoOpt && !!count && Number(count) > 0

  const handleSave = async () => {
    if (!canSave || !fenoOpt) return
    setSaving(true); setError(null)
    try {
      const payload = {
        name:                   name.trim(),
        species:                CATEGORIA_LABEL_RAE[fenoOpt.catKey] ?? fenoOpt.catKey,
        categoria:              fenoOpt.catKey,
        physiological_category: fenoOpt.physio,
        breed:                  breed.trim() || null,
        head_count:             Number(count),
        avg_weight_kg:          weight !== '' ? Number(weight) : (defaultPeso ?? null),
        total_ev:               ev ? Math.round(ev) : null,
        admission_date:         admDate || null,
      }
      const res = await apiFetch('/api/herds', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Error ${res.status}`)
      }
      const data = await res.json()

      // Invalidar IDB
      import('@/lib/offline/db').then(({ dbUpsertMany }) =>
        dbUpsertMany('herds', [data.herd ?? data]).catch(() => {})
      )
      import('sonner').then(({ toast }) => toast.success(`Rodeo "${name.trim()}" creado`))
      window.dispatchEvent(new Event('herd_saved'))

      // Navegar al nuevo rodeo con slug limpio
      router.push(`/dashboard/herds/${toHerdSlug(name.trim())}/datos`)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* ── Header del formulario ─────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-8 py-5 flex items-center gap-4">
        <Link
          href="/dashboard/herds"
          className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-gray-900">Nuevo rodeo</h1>
          <p className="text-[11px] text-gray-400 font-medium">Completá los datos para crear el rodeo</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className={clsx(
            'px-5 py-2.5 rounded-xl text-sm font-bold transition-all',
            canSave && !saving
              ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-200'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          {saving ? 'Guardando…' : 'Crear rodeo'}
        </button>
      </div>

      {/* ── Formulario ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 sm:p-8 space-y-6">

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
              <p className="text-sm font-bold text-red-700">{error}</p>
            </div>
          )}

          {/* ── Nombre ───────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Identificación</h3>
            <div>
              <label className={LABEL}>Nombre del rodeo *</label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ej: Vientres Octubre 2025"
                className={FIELD}
              />
            </div>
          </div>

          {/* ── Categoría Fenológica ──────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
            <div>
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Categoría Fenológica *</h3>
              <p className="text-[10px] text-gray-400 mt-1">
                El estado fisiológico determina el multiplicador de Equivalente Vaca (EV).
              </p>
            </div>

            {FENO_GROUPS.map(group => (
              <div key={group.group}>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {group.group}
                  </p>
                  <p className="text-[9px] text-gray-300 font-medium hidden sm:block">{group.hint}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.opts.map(opt => {
                    const col = CATEGORIA_COLORS[opt.catKey]
                    const sel = fenoOpt?.label === opt.label
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => {
                          setFenoOpt(opt)
                          setBreed('')
                          const def = CATEGORIA_PESO_DEFAULT[opt.catKey]
                          if (def) setWeight(def)
                        }}
                        className={clsx(
                          'flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 text-left transition-all',
                          sel
                            ? 'border-green-500 bg-green-50 shadow-sm'
                            : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-white'
                        )}
                      >
                        <div className={clsx('w-2.5 h-2.5 rounded-full shrink-0', col?.dot ?? 'bg-gray-400')} />
                        <div className="min-w-0 flex-1">
                          <span className={clsx('text-xs font-bold block', sel ? 'text-green-800' : 'text-gray-700')}>
                            {opt.label}
                          </span>
                          <span className="text-[9px] text-gray-400 font-medium">{opt.hint}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ── Datos Operativos ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Datos operativos</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Cabezas *</label>
                <input
                  type="number" min={1}
                  value={count}
                  onChange={e => setCount(e.target.value === '' ? '' : Number(e.target.value))}
                  className={FIELD}
                  placeholder="ej: 250"
                />
              </div>
              <div>
                <label className={LABEL}>
                  Peso prom. (kg)
                  {defaultPeso && <span className="ml-1 text-gray-300 normal-case font-medium">ref. {defaultPeso} kg</span>}
                </label>
                <input
                  type="number" min={1}
                  value={weight}
                  onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  className={FIELD}
                  placeholder={defaultPeso ? String(defaultPeso) : 'ej: 420'}
                />
              </div>
            </div>

            {/* Raza — CustomSelect reemplaza el <select> nativo */}
            {razas.length > 0 && (
              <div>
                <label className={LABEL}>
                  Raza <span className="text-gray-300 font-medium normal-case">(opcional)</span>
                </label>
                <CustomSelect
                  value={breed}
                  onChange={setBreed}
                  options={razaOptions}
                  placeholder="— Sin especificar —"
                />
              </div>
            )}

            <div>
              <label className={LABEL}>Fecha de ingreso</label>
              <input type="date" value={admDate} onChange={e => setAdmDate(e.target.value)} className={FIELD} />
            </div>

            {/* EV calculado */}
            {ev !== null && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs font-black text-green-800">
                    EV total proyectado: {Math.round(ev).toLocaleString('es-AR')} EV
                    {fenoOpt && (
                      <span className="ml-2 text-[10px] font-medium text-green-600/80">
                        (mult. ×{fenoOpt.evMult})
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-green-600 font-medium">
                    Consumo ≈ {Math.round(ev * 11).toLocaleString('es-AR')} kg MS/día
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Botón guardar al final */}
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={clsx(
              'w-full flex items-center justify-center py-3.5 rounded-2xl text-sm font-bold transition-all',
              canSave && !saving
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            )}
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando…</>
              : 'Crear rodeo'
            }
          </button>

        </div>
      </div>
    </div>
  )
}
