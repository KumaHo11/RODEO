'use client'

/**
 * HerdDatosTab — Tab 1: Datos del rodeo con edición inline.
 * Fase 2: Formulario de edición extraído de HerdModal.
 */

import React, { useState, useMemo } from 'react'
import clsx from 'clsx'
import { Edit3, Save, X, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { useRouter } from 'next/navigation'
import type { HerdData } from '@/components/HerdModal'
import { CATEGORIA_LABEL_RAE, CATEGORIA_PESO_DEFAULT, CATEGORIA_REF, RAZAS_POR_CATEGORIA, type CategoriaComercial } from '@/lib/categorias'
import { PHYSIO_LABEL, calculateBaseEV } from '@/lib/grazing/evProjection'
import { HerdUltimosEventos } from './HerdUltimosEventos'
import { CatCombobox, BreedCombobox } from '@/components/HerdComboboxes'
import { todayISO, fmtDate } from '@/lib/utils/dates'

interface Props {
  herd: HerdData
  onRefresh: () => void
}

const FIELD = 'w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-white'
const LABEL = 'text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block'

export default function HerdDatosTab({ herd, onRefresh }: Props) {
  const router = useRouter()
  const [editing,   setEditing]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Form state (sync from herd prop)
  const catInitial = herd.categoria as CategoriaComercial | null
  const [catKey,   setCatKey]   = useState<CategoriaComercial | null>(catInitial)
  const [catLabel, setCatLabel] = useState(
    catInitial ? (CATEGORIA_LABEL_RAE[catInitial] ?? catInitial) : herd.species
  )
  const [name,      setName]      = useState(herd.name)
  const [breed,     setBreed]     = useState(herd.breed ?? '')
  const [count,     setCount]     = useState<number | ''>(herd.head_count)
  const [weight,    setWeight]    = useState<number | ''>(
    herd.avg_weight_kg != null ? Math.round(Number(herd.avg_weight_kg)) : ''
  )
  const [admDate,   setAdmDate]   = useState(
    herd.admission_date ? String(herd.admission_date).slice(0, 10) : todayISO()
  )
  const [exitDate,  setExitDate]  = useState(
    herd.exit_date ? String(herd.exit_date).slice(0, 10) : ''
  )

  const catRef    = catKey ? CATEGORIA_REF[catKey] : undefined
  const herdId    = herd.id!

  // Computed display values
  const catLabel_display = catKey
    ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey)
    : herd.species

  const physioLabel = herd.physiological_category
    ? (PHYSIO_LABEL[herd.physiological_category as keyof typeof PHYSIO_LABEL] ?? herd.physiological_category)
    : null

  const ev = Number(herd.total_ev) || calculateBaseEV(catKey, Number(herd.avg_weight_kg), herd.head_count)

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim() || !count) return
    setSaving(true); setSaveError(null)
    try {
      const payload = {
        name: name.trim(),
        species: catLabel || catKey || herd.species,
        categoria: catKey,
        breed: breed.trim() || null,
        head_count: Number(count),
        avg_weight_kg: weight !== '' ? Number(weight) : null,
        admission_date: admDate && admDate.length === 10 ? admDate : null,
        exit_date: exitDate && exitDate.length === 10 ? exitDate : null,
        total_ev: weight && count ? calculateBaseEV(catKey, Number(weight), Number(count)) : herd.total_ev,
      }
      const res = await apiFetch(`/api/herds/${herdId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Error ${res.status}`)
      }
      import('sonner').then(({ toast }) => toast.success('Rodeo actualizado'))
      setEditing(false)
      onRefresh()
    } catch (e: any) {
      setSaveError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset to herd prop values
    setCatKey(catInitial)
    setCatLabel(catInitial ? (CATEGORIA_LABEL_RAE[catInitial] ?? catInitial) : herd.species)
    setName(herd.name)
    setBreed(herd.breed ?? '')
    setCount(herd.head_count)
    setWeight(herd.avg_weight_kg != null ? Math.round(Number(herd.avg_weight_kg)) : '')
    setAdmDate(herd.admission_date ? String(herd.admission_date).slice(0, 10) : todayISO())
    setExitDate(herd.exit_date ? String(herd.exit_date).slice(0, 10) : '')
    setEditing(false)
    setSaveError(null)
  }

  return (
    <div className="p-6 sm:p-8 space-y-5 max-w-4xl">

      {/* ── Card: Datos operativos ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-50">
          <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">
            Datos operativos
          </h3>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim() || !count}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all',
                  saving || !name.trim() || !count
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700 shadow-sm shadow-green-200'
                )}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          )}
        </div>

        {saveError && (
          <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs font-bold text-red-700">{saveError}</p>
          </div>
        )}

        {/* Campos */}
        <div className="p-5">
          {!editing ? (
            // ── Vista lectura ────────────────────────────────────────────
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <DataField label="Nombre" value={herd.name} />
              <DataField label="Categoría" value={catLabel_display} />
              {physioLabel && <DataField label="Estado fisiológico" value={physioLabel} />}
              <DataField label="Raza" value={herd.breed || '—'} />
              <DataField label="Cabezas" value={herd.head_count.toLocaleString('es-AR')} highlight />
              <DataField
                label="Peso promedio"
                value={herd.avg_weight_kg ? `${Math.round(Number(herd.avg_weight_kg))} kg` : '—'}
                highlight
              />
              <DataField
                label="EV total"
                value={Math.round(ev).toLocaleString('es-AR')}
                highlight
              />
              {herd.bcs_score != null && (
                <DataField label="Condición corporal" value={`${herd.bcs_score}/5`} />
              )}
              <DataField label="Fecha de ingreso" value={fmtDate(herd.admission_date)} />
              {herd.exit_date && (
                <DataField label="Fecha de salida" value={fmtDate(herd.exit_date)} />
              )}
              {herd.grupo_manejo_nombre && (
                <DataField label="Lote de manejo" value={`📂 ${herd.grupo_manejo_nombre}`} />
              )}
              {herd.lactancia_range && (
                <DataField label="Lactancia" value={herd.lactancia_range} />
              )}
              {herd.estadio_gestacion && (
                <DataField label="Gestación" value={herd.estadio_gestacion} />
              )}
              {herd.daily_gain_kg != null && (
                <DataField label="GDP" value={`${herd.daily_gain_kg} kg/día`} />
              )}
              {herd.ms_dia_kg != null && (
                <DataField label="MS/día" value={`${herd.ms_dia_kg} kg`} />
              )}
            </div>
          ) : (
            // ── Modo edición ────────────────────────────────────────────
            <div className="space-y-4">
              {/* Nombre */}
              <div>
                <label className={LABEL}>Nombre del rodeo *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={FIELD}
                  placeholder="ej: Vientres Octubre"
                />
              </div>

              {/* Categoría + Raza — row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Categoría</label>
                  <CatCombobox
                    value={catLabel}
                    onChange={(label, key) => {
                      setCatLabel(label)
                      setCatKey(key as CategoriaComercial)
                    }}
                  />
                </div>
                <div>
                  <label className={LABEL}>Raza</label>
                  <BreedCombobox
                    value={breed}
                    breeds={catKey ? (RAZAS_POR_CATEGORIA[catKey] ?? []) : []}
                    onChange={setBreed}
                  />
                </div>
              </div>

              {/* Cabezas + Peso — row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Cabezas *</label>
                  <input
                    type="number"
                    min={1}
                    value={count}
                    onChange={e => setCount(e.target.value === '' ? '' : Number(e.target.value))}
                    className={FIELD}
                    placeholder="ej: 250"
                  />
                </div>
                <div>
                  <label className={LABEL}>
                    Peso promedio (kg)
                    {catRef && <span className="ml-1 text-gray-300 normal-case font-medium">{catRef.hintPeso}</span>}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={weight}
                    onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                    className={FIELD}
                    placeholder={catKey ? String(CATEGORIA_PESO_DEFAULT[catKey] ?? '') : 'ej: 420'}
                  />
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Fecha de ingreso</label>
                  <input type="date" value={admDate} onChange={e => setAdmDate(e.target.value)} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>Fecha de salida <span className="text-gray-300 font-medium normal-case">(si es temporario)</span></label>
                  <input type="date" value={exitDate} onChange={e => setExitDate(e.target.value)} className={FIELD} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Últimos eventos ──────────────────────────────────────────────── */}
      <HerdUltimosEventos
        herdId={herdId}
        onViewBitacora={() => router.push(`/dashboard/herds/${herdId}/bitacora`)}
      />
    </div>
  )
}

function DataField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={clsx('text-sm font-bold', highlight ? 'text-gray-900' : 'text-gray-600')}>{value}</p>
    </div>
  )
}
