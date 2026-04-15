'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import {
  Plus, Search, Trash2, LayoutGrid, List, Download,
  ChevronUp, ChevronDown, Filter, X, Calendar, Edit3,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import HerdModal, { type HerdData } from '@/components/HerdModal'
import {
  CATEGORIAS_COMERCIALES, CATEGORIA_LABEL_RAE, CATEGORIA_COLORS,
  type CategoriaComercial,
} from '@/lib/categorias'

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcEV(weight: number, count: number, catKey: string | null): number {
  const FACTORS: Record<string, number> = {
    NOVILLOS: 1.0, NOVILLITOS: 0.9, VAQUILLONAS: 0.9,
    TERNEROS: 0.6, TERNERAS: 0.55, VACAS: 1.0, TOROS: 1.25, MEJ: 0.9, BUBALINOS: 1.1,
  }
  const f = catKey ? (FACTORS[catKey] ?? 1.0) : 1.0
  return parseFloat((Math.pow((weight || 400) / 400, 0.75) * f * count).toFixed(2))
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try {
    // Postgres can return full timestamp — take only the date part
    const datePart = String(iso).slice(0, 10)
    return new Date(datePart + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
  } catch { return String(iso).slice(0, 10) }
}

type SortKey = 'name' | 'head_count' | 'avg_weight_kg' | 'admission_date' | 'total_ev'

// Abbreviated labels for card badge
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
  const [herds,   setHerds]   = useState<HerdData[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search,        setSearch]        = useState('')
  const [filterCat,     setFilterCat]     = useState('all')
  const [filterDateFrom,setFilterDateFrom]= useState('')
  const [filterDateTo,  setFilterDateTo]  = useState('')
  const [showFilters,   setShowFilters]   = useState(false)

  // View
  const [view, setView] = useState<'cards' | 'list'>('cards')

  // Sort (list view)
  const [sortKey,  setSortKey]  = useState<SortKey>('name')
  const [sortAsc,  setSortAsc]  = useState(true)

  // Modal
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editingHerd,  setEditingHerd]  = useState<HerdData | null>(null)

  const loadHerds = async () => {
    if (!user) return
    setLoading(true)
    const res = await apiFetch('/api/herds')
    if (res.ok) { const { herds: data } = await res.json(); setHerds(data || []) }
    setLoading(false)
  }

  useEffect(() => { loadHerds() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ────────────────────────────────────────────────────────────

  const totalAnimals = herds.reduce((s, h) => s + (h.head_count || 0), 0)
  const totalEV      = herds.reduce((s, h) => s + (Number(h.total_ev) || 0), 0)
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
    if (!confirm('¿Eliminar este rodeo? Esta acción es irreversible.')) return
    await apiFetch(`/api/herds/${id}`, { method: 'DELETE' })
    setHerds(prev => prev.filter(h => h.id !== id))
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Rodeos</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Gestión de lotes de animales por categoría, stock y carga animal.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* View toggle */}
          <div className="bg-gray-100 rounded-xl p-0.5 flex gap-0.5">
            <button onClick={() => setView('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'cards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Tarjetas
            </button>
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <List className="w-3.5 h-3.5" /> Lista
            </button>
          </div>
          {/* Excel export */}
          <button onClick={() => exportExcel(filtered)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all">
            <Download className="w-3.5 h-3.5" /> Exportar rodeos
          </button>
          <button onClick={() => exportMovementsExcel(herds)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all">
            <Download className="w-3.5 h-3.5 text-violet-500" /> Historial
          </button>
          {/* New herd */}
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm shadow-green-200">
            <Plus className="w-4 h-4" /> Nuevo rodeo
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Total rodeos</p>
          <p className="text-4xl font-black text-gray-950">{herds.length}</p>
          <p className="text-[9px] text-gray-400 mt-1">{totalAnimals.toLocaleString()} animales</p>
        </div>
        <div className="bg-green-50 rounded-2xl border border-green-100 shadow-sm p-5">
          <p className="text-[10px] font-bold text-green-700 tracking-widest uppercase mb-2">Consumo diario</p>
          <p className="text-4xl font-bold text-green-900">
            {totalMsDay >= 1000 ? `${(totalMsDay / 1000).toFixed(1)}k` : totalMsDay.toLocaleString()}
          </p>
          <p className="text-[9px] text-green-600 mt-1 font-medium">kg MS/día · {totalEV.toFixed(1)} EV</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">Carga (EV)</p>
          <p className="text-4xl font-bold text-green-800">{totalEV.toFixed(1)}</p>
          <p className="text-[9px] text-gray-400 mt-1 font-medium">Equivalente vaca total</p>
        </div>
      </div>

      {/* ── Search + Filters toolbar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-3">
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
      </div>

      {/* ── Results count ── */}
      {!loading && (
        <p className="text-[11px] text-gray-400 font-bold tracking-wide">
          {filtered.length} rodeo{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          {filtered.length !== herds.length && ` de ${herds.length}`}
        </p>
      )}

      {/* ════ CARDS VIEW ════ */}
      {view === 'cards' && (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 mx-auto mb-3 flex items-center justify-center">
              <span className="text-2xl">🐄</span>
            </div>
            <p className="text-sm font-bold text-gray-400">No hay rodeos que mostrar</p>
            <p className="text-[10px] text-gray-300 mt-1">Creá tu primer rodeo o cambiá los filtros</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map(herd => {
                const catKey     = herd.categoria as CategoriaComercial | null
                const colors     = catKey ? CATEGORIA_COLORS[catKey] : null
                const catDisp    = catKey ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey) : herd.species
                const ev         = Number(herd.total_ev) || calcEV(Number(herd.avg_weight_kg), herd.head_count, catKey)
                const evPct      = totalEV > 0 ? (ev / totalEV) * 100 : 0
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
                    {/* Category color bar */}
                    <div className={`h-1 w-full ${colors ? colors.dot.replace('bg-', 'bg-') : 'bg-gray-200'} opacity-60`} />

                    <div className="px-5 pt-4 pb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colors ? colors.bg : 'bg-gray-50 border-gray-200'}`}>
                          <span className={`text-[10px] font-black ${colors?.text ?? 'text-gray-500'}`}>
                            {catKey ? (CATEGORIA_ABBR[catKey] ?? catKey.slice(0,3)) : (herd.species ?? '?').slice(0,3).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-950 leading-tight">{herd.name}</h3>
                          <p className="text-[10px] font-medium text-gray-500 mt-0.5">{catDisp}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Edit icon — visible on hover */}
                        <span className="w-7 h-7 flex items-center justify-center text-gray-400 bg-gray-50 border border-gray-200 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                          <Edit3 className="w-3.5 h-3.5" />
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(herd.id!) }}
                          className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="px-5 py-3 border-t border-gray-50">
                      <div className="mb-3">
                        <p className="text-[9px] font-bold text-green-600 tracking-widest uppercase mb-0.5">Consumo diario</p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-3xl font-bold text-gray-950 tracking-tighter">{msDay.toLocaleString()}</p>
                          <span className="text-xs font-bold text-gray-400">kg MS/día</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">Stock</p>
                          <p className="text-lg font-bold text-gray-700">{herd.head_count}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">Ev total</p>
                          <p className="text-lg font-bold text-green-700">{ev.toFixed(1)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-[9px] font-black text-gray-400 tracking-widest uppercase mb-0.5">Raza</p>
                          <p className="text-xs font-bold text-gray-700 truncate">{herd.breed || '—'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 pb-4 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[9px] font-bold text-gray-400">% carga total</p>
                          <p className="text-[9px] font-black text-gray-600">{evPct.toFixed(1)}%</p>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-green-600 h-1.5 rounded-full transition-all" style={{ width: `${evPct}%` }} />
                        </div>
                      </div>
                      {/* Fecha de alta */}
                      {herd.admission_date && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-gray-300 shrink-0" />
                          <p className="text-[10px] text-gray-400">Alta: {fmtDate(herd.admission_date)}</p>
                        </div>
                      )}
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
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(herd => {
                  const catKey  = herd.categoria as CategoriaComercial | null
                  const colors  = catKey ? CATEGORIA_COLORS[catKey] : null
                  const catDisp = catKey ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey) : herd.species
                  const ev      = Number(herd.total_ev) || calcEV(Number(herd.avg_weight_kg), herd.head_count, catKey)
                  return (
                    <tr key={herd.id}
                      className="hover:bg-green-50/30 transition-colors cursor-pointer group"
                      onClick={() => openEdit(herd)}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-gray-900">{herd.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border ${colors ? `${colors.bg} ${colors.text}` : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${colors?.dot ?? 'bg-gray-400'}`} />
                          {catDisp}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-800">{herd.head_count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{herd.avg_weight_kg ? `${herd.avg_weight_kg} kg` : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{herd.breed || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(herd.admission_date)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-orange-500">{ev.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(herd.id!) }}
                          className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
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
    </div>
  )
}
