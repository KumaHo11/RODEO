'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import {
  Plus, Search, Trash2, LayoutGrid, List, Download,
  ChevronUp, ChevronDown, Filter, X, Calendar, Edit3, Loader2, Layers,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import HerdModal, { type HerdData } from '@/components/HerdModal'
import {
  CATEGORIAS_COMERCIALES, CATEGORIA_LABEL_RAE, CATEGORIA_COLORS,
  type CategoriaComercial,
} from '@/lib/categorias'
import { useConfirm } from '@/components/ui/ConfirmModal'
import { toast } from 'sonner'
import { usePlan } from '@/hooks/usePlan'
import { Lock } from 'lucide-react'
import WeatherConditionChip from '@/components/WeatherConditionChip'
import { calculateBaseEV } from '@/lib/grazing/evProjection'
import { fmtDate } from '@/lib/utils/dates'


// ── Helpers ───────────────────────────────────────────────────────────────────
// calculateBaseEV importado desde lib/grazing/evProjection
// fmtDate importado desde lib/utils/dates

type SortKey = 'name' | 'head_count' | 'avg_weight_kg' | 'admission_date' | 'total_ev'

// ── Event type catalogue ─────────────────────────────────────────────────────

const EVENT_TYPES = [
  { key: 'pesada',        label: 'Pesada',                badge: 'bg-blue-100 text-blue-700',      needsQty: true,  needsWeight: true  },
  { key: 'paricion',      label: 'Parición',              badge: 'bg-green-100 text-green-700',    needsQty: true,  needsWeight: false },
  { key: 'destete',       label: 'Destete',               badge: 'bg-teal-100 text-teal-700',      needsQty: true,  needsWeight: true  },
  { key: 'mortandad',     label: 'Mortandad',             badge: 'bg-red-100 text-red-700',        needsQty: true,  needsWeight: false },
  { key: 'compra',        label: 'Compra',                badge: 'bg-emerald-100 text-emerald-700',needsQty: true,  needsWeight: true  },
  { key: 'venta',         label: 'Venta',                 badge: 'bg-orange-100 text-orange-700',  needsQty: true,  needsWeight: true  },
  { key: 'caravana',      label: 'Caravana / Marcación',  badge: 'bg-violet-100 text-violet-700',  needsQty: true,  needsWeight: false },
  { key: 'sanidad',       label: 'Sanidad / Vacuna',      badge: 'bg-yellow-100 text-yellow-700',  needsQty: true,  needsWeight: false },
  { key: 'traslado',      label: 'Traslado de potrero',   badge: 'bg-sky-100 text-sky-700',        needsQty: true,  needsWeight: false },
  { key: 'stock_inicial', label: 'Stock inicial',         badge: 'bg-gray-100 text-gray-600',      needsQty: true,  needsWeight: true  },
  { key: 'nota',          label: 'Nota',                  badge: 'bg-gray-100 text-gray-500',      needsQty: false, needsWeight: false },
] as const

const EVENT_BADGE: Record<string, string> = Object.fromEntries(EVENT_TYPES.map(e => [e.key, e.badge]))
const EVENT_LABEL: Record<string, string> = Object.fromEntries(EVENT_TYPES.map(e => [e.key, e.label]))

// ── Abbreviated labels for card badge ────────────────────────────────────────
const CATEGORIA_ABBR: Record<string, string> = {
  VACAS: 'VAC', VAQUILLONAS: 'VEQ', TERNEROS: 'TER', TERNERAS: 'TRA',
  NOVILLOS: 'NOV', NOVILLITOS: 'NVT', TOROS: 'TOR', MEJ: 'MEJ',
  BUBALINOS: 'BUB',
}

// ── Excel export (client-side SheetJS) ────────────────────────────────────────

async function exportExcel(herds: HerdData[]) {
  const { utils, writeFile } = await import('xlsx')
  const rows = herds.map(h => ({
    'Nombre':                  h.name,
    'Categoría comercial':     h.categoria ? (CATEGORIA_LABEL_RAE[h.categoria as CategoriaComercial] ?? h.categoria) : h.species,
    'Stock (cabezas)':         h.head_count,
    'Peso promedio (kg)':      h.avg_weight_kg ?? '',
    'Raza':                    h.breed ?? '',
    'Fecha de ingreso':        h.admission_date ?? '',
    'Ev total':                h.total_ev != null ? Number(h.total_ev).toFixed(2) : '',
    'Condición corporal (BCS)': h.bcs_score ?? '',
  }))
  const ws = utils.json_to_sheet(rows)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Rodeos')
  writeFile(wb, `rodeos-${new Date().toISOString().split('T')[0]}.xlsx`)
}

async function exportMovementsExcel(herds: HerdData[]) {
  const { utils, writeFile } = await import('xlsx')
  const { apiFetch } = await import('@/lib/apiFetch')
  const res = await apiFetch('/api/movements?limit=500')
  let movements: any[] = []
  if (res.ok) {
    const data = await res.json()
    movements = data.movements || []
  }
  const herdMap = Object.fromEntries(herds.map(h => [h.id, h.name]))
  const rows = movements.map(m => ({
    'Fecha':           m.occurred_at ? new Date(m.occurred_at).toLocaleString('es-AR') : '',
    'Tipo entidad':    m.entity_type === 'herd' ? 'Rodeo' : 'Potrero',
    'Nombre':          m.entity_name ?? (herdMap[m.entity_id] ?? m.entity_id),
    'Tipo evento':     m.event_type,
    'Cantidad':        m.quantity ?? '',
    'Peso promedio (kg)': m.weight_kg ?? '',
    'BCS':             m.bcs_score ?? '',
    'Categoría':       m.categoria ?? '',
    'Raza':            m.breed ?? '',
    'Fecha ingreso':   m.admission_date ?? '',
    'Notas':           m.notes ?? '',
  }))
  const ws = utils.json_to_sheet(rows.length ? rows : [{ Nota: 'Sin movimientos registrados' }])
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Historial')
  writeFile(wb, `historial-movimientos-${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HerdsPage() {
  const { user } = useAuth()
  const { confirm, ConfirmModal } = useConfirm()
  const [herds,   setHerds]   = useState<HerdData[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search,        setSearch]        = useState('')
  const [filterCat,     setFilterCat]     = useState('all')
  const [filterDateFrom,setFilterDateFrom]= useState('')
  const [filterDateTo,  setFilterDateTo]  = useState('')
  const [showFilters,   setShowFilters]   = useState(false)

  // View - default to list
  const [view, setView] = useState<'cards' | 'list' | 'historial'>('cards')
  const [movements, setMovements] = useState<any[]>([])
  const [loadingMov, setLoadingMov] = useState(false)

  // Sort (list view)
  const [sortKey,  setSortKey]  = useState<SortKey>('name')
  const [sortAsc,  setSortAsc]  = useState(true)

  // Modal
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editingHerd,  setEditingHerd]  = useState<HerdData | null>(null)

  // Event log
  const [eventFilter,   setEventFilter]   = useState('all')
  const [movSearch,     setMovSearch]     = useState('')
  const [showEventForm, setShowEventForm] = useState(false)
  const [savingEvent,   setSavingEvent]   = useState(false)
  const [eventForm, setEventForm] = useState({
    herd_id: '', event_type: 'pesada',
    occurred_at: new Date().toISOString().split('T')[0],
    quantity: '', weight_kg: '', notes: '',
  })

  const { getLimit, hasFeature } = usePlan()
  const maxHerds = getLimit('max_herds')
  const canCreateMore = herds.length < maxHerds

  const loadHerds = async () => {
    if (!user) return
    setLoading(true)
    const res = await apiFetch('/api/herds')
    if (res.ok) { const { herds: data } = await res.json(); setHerds(data || []) }
    setLoading(false)
  }

  const loadMovements = async () => {
    setLoadingMov(true)
    const res = await apiFetch('/api/movements?limit=200')
    if (res.ok) { const d = await res.json(); setMovements(d.movements || []) }
    setLoadingMov(false)
  }

  useEffect(() => { loadHerds() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ────────────────────────────────────────────────────────────

  const totalAnimals = Math.round(herds.reduce((s, h) => s + (h.head_count || 0), 0))
  const totalEV      = Math.round(herds.reduce((s, h) => s + (Number(h.total_ev) || 0), 0))
  const totalMsDay   = Math.round(totalEV * 11)

  const filtered = useMemo(() => {
    let list = herds.filter(h => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        h.name.toLowerCase().includes(q) ||
        (h.breed ?? '').toLowerCase().includes(q) ||
        (h.categoria ? (CATEGORIA_LABEL_RAE[h.categoria as CategoriaComercial] ?? '').toLowerCase().includes(q) : false) ||
        h.species.toLowerCase().includes(q)

      const hCat = h.categoria ?? ''
      const matchCat = filterCat === 'all' || hCat === filterCat

      const ad = h.admission_date ?? ''
      const matchFrom = !filterDateFrom || ad >= filterDateFrom
      const matchTo   = !filterDateTo   || ad <= filterDateTo

      return matchSearch && matchCat && matchFrom && matchTo
    })

    if (view === 'list') {
      list = [...list].sort((a, b) => {
        const av = a[sortKey] ?? ''
        const bv = b[sortKey] ?? ''
        const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
        return sortAsc ? cmp : -cmp
      })
    }

    return list
  }, [herds, search, filterCat, filterDateFrom, filterDateTo, view, sortKey, sortAsc])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const openCreate = () => { setEditingHerd(null); setModalOpen(true) }
  const openEdit   = (h: HerdData) => { setEditingHerd(h); setModalOpen(true) }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: '¿Eliminar este rodeo?',
      description: 'Esta acción es irreversible. Se borrarán todos los datos asociados al rodeo.',
      confirmLabel: 'Sí, eliminar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const res = await apiFetch(`/api/herds/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Error desconocido' }))
        toast.error(`No se pudo eliminar: ${errData.error}`)
      } else {
        setHerds(prev => prev.filter(h => h.id !== id))
        toast.success('Rodeo eliminado correctamente')
      }
    } catch (err: any) {
      toast.error(`No se pudo eliminar: ${err.message}`)
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Rodeos</h1>
          <p className="text-sm text-gray-500 font-medium mt-1 line-clamp-1 sm:line-clamp-none">
            Gestión de lotes de animales por categoría, stock y carga animal.
          </p>
        </div>
        {/* Action buttons — scrollable on mobile so they never overflow */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 sm:overflow-visible sm:pb-0">
          {/* View toggle */}
          <div className="bg-gray-100 rounded-xl p-0.5 flex gap-0.5 shrink-0">
            <button onClick={() => setView('cards')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${view === 'cards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Tarjetas</span>
            </button>
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <List className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button onClick={() => { setView('historial'); loadMovements() }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${view === 'historial' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Historial</span>
            </button>
          </div>
          {/* Per-section export */}
          {view !== 'historial' && (
            <button onClick={() => exportExcel(filtered)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all whitespace-nowrap shrink-0">
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          )}
          {view === 'historial' && (
            <button onClick={() => exportMovementsExcel(herds)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all whitespace-nowrap shrink-0">
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          )}
          {canCreateMore ? (
            <button onClick={openCreate}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm shadow-green-200 whitespace-nowrap shrink-0">
              <Plus className="w-4 h-4 shrink-0" /> Nuevo rodeo
            </button>
          ) : (
            <button onClick={() => toast.info(`Límite alcanzado: Tu plan permite hasta ${maxHerds} rodeo${maxHerds > 1 ? 's' : ''}.`)}
              className="flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2.5 rounded-xl font-bold text-sm border border-gray-200 cursor-not-allowed whitespace-nowrap shrink-0">
              <Lock className="w-3.5 h-3.5 shrink-0" /> Límite {maxHerds}/{maxHerds}
            </button>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Total rodeos</p>
          <p className="text-4xl font-black text-gray-950">{herds.length}</p>
          <p className="text-[9px] text-gray-400 mt-1">{totalAnimals.toLocaleString('es-AR')} animales</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Consumo diario</p>
          <p className="text-4xl font-black text-gray-950">{totalMsDay.toLocaleString('es-AR')}</p>
          <p className="text-[9px] text-gray-400 mt-1 font-medium">kg MS/día totales · {totalEV.toLocaleString('es-AR')} EV</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Carga (EV)</p>
          <p className="text-4xl font-black text-gray-950">{totalEV.toLocaleString('es-AR')}</p>
          <p className="text-[9px] text-gray-400 mt-1 font-medium">Equivalente Vaca (EV) total</p>
        </div>
      </div>

      {/* ── Search + Filters toolbar ── */}
      {view !== 'historial' && (<div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-3">
        <div className="flex gap-3 flex-wrap items-center">
          {/* Unified search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por nombre, categoría o raza..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 transition-colors" />
              </button>
            )}
          </div>

          {/* Category filter */}
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 outline-none cursor-pointer focus:ring-1 focus:ring-green-600 min-w-[130px]">
            <option value="all">Categoría</option>
            {CATEGORIAS_COMERCIALES.map(k => (
              <option key={k} value={k}>{CATEGORIA_LABEL_RAE[k as CategoriaComercial]}</option>
            ))}
          </select>

          {/* Advanced filters toggle */}
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
              showFilters || filterDateFrom || filterDateTo
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
            }`}>
            <Filter className="w-3.5 h-3.5" /> Fechas
          </button>

          {/* Clear filters */}
          {(search || filterCat !== 'all' || filterDateFrom || filterDateTo) && (
            <button onClick={() => { setSearch(''); setFilterCat('all'); setFilterDateFrom(''); setFilterDateTo('') }}
              className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors">
              <X className="w-3.5 h-3.5" /> Limpiar
            </button>
          )}
        </div>

        {/* Date range filter */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="flex gap-3 items-center pt-1 border-t border-gray-100">
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase whitespace-nowrap">Fecha de ingreso</p>
                <div className="flex gap-2 flex-1">
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600" />
                  <span className="text-gray-400 text-sm self-center">—</span>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-600" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>)}

      {/* ── Results count ── */}
      {!loading && view !== 'historial' && (
        <p className="text-[11px] text-gray-400 font-bold tracking-wide">
          {filtered.length} rodeo{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          {filtered.length !== herds.length && ` de ${herds.length}`}
        </p>
      )}

      {/* ════ CARDS VIEW ════ */}
      {view === 'cards' && (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-24 sm:pb-10">
            {[...Array(6)].map((_, i) => <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 mx-auto mb-3 flex items-center justify-center text-gray-300">
              <Layers className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-400">No hay rodeos que mostrar</p>
            <p className="text-[10px] text-gray-300 mt-1">Creá tu primer rodeo o cambiá los filtros</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-24 sm:pb-10">
            <AnimatePresence>
              {filtered.map(herd => {
                const catKey     = herd.categoria as CategoriaComercial | null
                const colors     = catKey ? CATEGORIA_COLORS[catKey] : null
                const catDisp    = catKey ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey) : herd.species
                const ev         = Number(herd.total_ev) || calculateBaseEV(catKey, Number(herd.avg_weight_kg), herd.head_count)
                const msDay      = Math.round(ev * 11)

                return (
                  <motion.div
                    key={herd.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group cursor-pointer"
                    onClick={() => openEdit(herd)}
                  >
                    {/* ── Header: abbr badge + nombre + cat ── */}
                    <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Abbr pill */}
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                          <span className="text-[10px] font-black text-gray-400">
                            {catKey ? (CATEGORIA_ABBR[catKey] ?? catKey.slice(0,3)) : (herd.species ?? '?').slice(0,3).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          {/* Nombre — jerarquía principal */}
                          <h3 className="text-xl font-black text-gray-950 leading-tight truncate">{herd.name}</h3>
                          {/* Categoría — segundo plano */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors?.dot ?? 'bg-gray-300'}`} />
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide truncate">{catDisp}</p>
                            {herd.exit_date && (
                              <span className="ml-1 text-[8px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md tracking-wider">TEMP</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(herd.id!) }}
                        className="shrink-0 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* ── Body: Stock destacado + métricas secundarias ── */}
                    <div className="px-5 pb-4">
                      {/* Cabezas — dato principal + Chip de Clima */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-semibold text-gray-950 tabular-nums leading-none">
                            {Math.round(herd.head_count).toLocaleString('es-AR')}
                          </p>
                          <p className="text-sm font-bold text-gray-400">cabezas</p>
                        </div>
                        <div onClick={e => e.stopPropagation()}>
                          <WeatherConditionChip
                            mode="herd"
                            entityName={herd.name}
                          />
                        </div>
                      </div>

                      {/* EV + Consumo — segundo plano */}
                      <div className="flex items-center gap-4 pt-3 border-t border-gray-50">
                        <div>
                          <p className="text-[9px] font-black text-gray-300 tracking-widest uppercase mb-0.5">EV</p>
                          <p className="text-sm font-black text-gray-500">{Math.round(ev).toLocaleString('es-AR')}</p>
                        </div>
                        <div className="w-px h-6 bg-gray-100" />
                        <div>
                          <p className="text-[9px] font-black text-gray-300 tracking-widest uppercase mb-0.5">Consumo</p>
                          <p className="text-sm font-black text-gray-500">{Math.round(msDay).toLocaleString('es-AR')} <span className="font-medium text-gray-400">kg MS/día</span></p>
                        </div>
                        {herd.admission_date && (
                          <>
                            <div className="w-px h-6 bg-gray-100 ml-auto" />
                            <div className="flex items-center gap-1 text-gray-300">
                              <Calendar className="w-3 h-3 shrink-0" />
                              <p className="text-[9px] font-bold text-gray-400">{fmtDate(herd.admission_date)}</p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* ── Botón Gestionar ── */}
                      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-end">
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(herd) }}
                          className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-xl transition-all shrink-0"
                        >
                          Gestionar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )
      )}

      {/* ════ LIST VIEW ════ */}
      {view === 'list' && (
        loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
            <p className="text-sm font-bold text-gray-400">No hay rodeos que mostrar</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-24 sm:mb-10">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50/70">
                <tr>
                  {(
                    [
                      { key: 'name',           label: 'Nombre' },
                      { key: null,             label: 'Categoría' },
                      { key: 'head_count',     label: 'Stock' },
                      { key: 'avg_weight_kg',  label: 'Peso promedio (kg)' },
                      { key: null,             label: 'Raza' },
                      { key: 'admission_date', label: 'Fecha de ingreso' },
                      { key: 'total_ev',       label: 'Ev total' },
                    ] as { key: SortKey | null; label: string }[]
                  ).map(({ key, label }) => (
                    <th
                      key={label}
                      onClick={key ? () => handleSort(key) : undefined}
                      className={`text-left px-4 py-3 text-[10px] font-black text-gray-400 tracking-widest uppercase select-none ${key ? 'cursor-pointer hover:text-gray-600 transition-colors' : ''}`}
                    >
                      <span className="flex items-center gap-1">
                        {label}
                        {key && <SortIcon k={key} />}
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(herd => {
                  const catKey  = herd.categoria as CategoriaComercial | null
                  const colors  = catKey ? CATEGORIA_COLORS[catKey] : null
                  const catDisp = catKey ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey) : herd.species
                  const ev      = Number(herd.total_ev) || calculateBaseEV(catKey, Number(herd.avg_weight_kg), herd.head_count)
                  return (
                    <tr key={herd.id}
                      className="hover:bg-green-50/30 transition-colors cursor-pointer group"
                      onClick={() => openEdit(herd)}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          {herd.name}
                          {herd.exit_date && (
                            <span className="text-[8px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md tracking-wider">TEMP</span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${colors?.dot ?? 'bg-gray-300'}`} />
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-tighter">
                            {catDisp}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-800">{Math.round(herd.head_count).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{herd.avg_weight_kg ? `${Math.round(herd.avg_weight_kg)} kg` : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{herd.breed || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(herd.admission_date)}</td>
                      <td className="px-4 py-3 text-sm font-black text-gray-950">{Math.round(ev).toLocaleString('es-AR')}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(herd) }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                            Gestionar
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(herd.id!) }}
                            className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ════ HISTORIAL VIEW ════ */}
      {view === 'historial' && (
        <div className="space-y-4">

          {/* Toolbar: search + category dropdown + new event */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={movSearch}
                  onChange={e => setMovSearch(e.target.value)}
                  placeholder="Buscar por rodeo o notas..."
                  className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-green-500 transition-all"
                />
              </div>
              {/* Category dropdown */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={eventFilter}
                  onChange={e => setEventFilter(e.target.value)}
                  className="bg-white border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-sm font-bold text-gray-700 outline-none focus:ring-1 focus:ring-green-500 appearance-none cursor-pointer transition-all"
                >
                  <option value="all">Todas las categorías</option>
                  {EVENT_TYPES.map(et => (
                    <option key={et.key} value={et.key}>{et.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Table */}
          {loadingMov ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (() => {
            const filteredMov = movements
              .filter(m => eventFilter === 'all' || m.event_type === eventFilter)
              .filter(m => {
                if (!movSearch.trim()) return true
                const q = movSearch.toLowerCase()
                const herd = herds.find(h => h.id === m.herd_id)
                return (
                  (herd?.name || '').toLowerCase().includes(q) ||
                  (m.notes || '').toLowerCase().includes(q) ||
                  (EVENT_LABEL[m.event_type] || '').toLowerCase().includes(q)
                )
              })
            return filteredMov.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
                <p className="text-sm font-bold text-gray-400">
                  Sin eventos {eventFilter !== 'all' ? `de tipo "${EVENT_LABEL[eventFilter] ?? eventFilter}"` : movSearch ? `para "${movSearch}"` : 'registrados'}
                </p>
                <p className="text-[10px] text-gray-300 mt-1">Usá el botón «Nuevo evento» para registrar el primero</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="border-b border-gray-100 bg-gray-50/70">
                    <tr>
                      {['Fecha', 'Tipo', 'Rodeo', 'Cantidad', 'Peso prom.', 'Notas'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-black text-gray-400 tracking-widest uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredMov.map((m, i) => {
                      const herdName = herds.find(h => h.id === m.entity_id)?.name ?? m.entity_name ?? '—'
                      const badge = EVENT_BADGE[m.event_type] ?? 'bg-gray-100 text-gray-500'
                      const label = EVENT_LABEL[m.event_type] ?? m.event_type
                      return (
                        <tr key={m.id ?? i} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-xs font-bold text-gray-600 tabular-nums whitespace-nowrap">
                            {m.occurred_at ? new Date(m.occurred_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${badge}`}>{label}</span>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-800">{herdName}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-700">{m.quantity != null ? m.quantity.toLocaleString('es-AR') : '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{m.weight_kg ? `${Math.round(m.weight_kg)} kg` : '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate">{m.notes || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Modal ── */}

      {modalOpen && (
        <HerdModal
          herd={editingHerd}
          allHerds={herds}
          onClose={() => { setModalOpen(false); setEditingHerd(null) }}
          onSaved={loadHerds}
        />
      )}
      <ConfirmModal />
    </div>
  )
}
