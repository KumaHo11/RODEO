'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch } from '@/lib/apiFetch'
import {
  Plus, Search, Trash2, List, Download,
  ChevronUp, ChevronDown, Filter, X, Calendar,

  Info, FileSpreadsheet, WifiOff,
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
import { calculateBaseEV, PHYSIO_LABEL } from '@/lib/grazing/evProjection'
import { fmtDate } from '@/lib/utils/dates'
import LoteCard, { type LoteData } from '@/components/LoteCard'
import { IconoRodeos } from '@/components/icons/IconoRodeos'
// ── Types ─────────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'head_count' | 'avg_weight_kg' | 'admission_date' | 'total_ev'

// ── Event type catalogue ─────────────────────────────────────────────────────
const EVENT_TYPES = [
  { key: 'bcs',           label: 'Condición corporal', badge: 'bg-purple-100 text-purple-700' },
  { key: 'pesada',        label: 'Pesada',              badge: 'bg-blue-100 text-blue-700'    },
  { key: 'paricion',      label: 'Parición',            badge: 'bg-green-100 text-green-700'  },
  { key: 'destete',       label: 'Destete',             badge: 'bg-teal-100 text-teal-700'    },
  { key: 'mortandad',     label: 'Mortandad',           badge: 'bg-red-100 text-red-700'      },
  { key: 'compra',        label: 'Compra',              badge: 'bg-emerald-100 text-emerald-700' },
  { key: 'venta',         label: 'Venta',               badge: 'bg-orange-100 text-orange-700'},
  { key: 'caravana',      label: 'Caravana/Marcación',  badge: 'bg-violet-100 text-violet-700'},
  { key: 'sanidad',       label: 'Sanidad/Vacuna',      badge: 'bg-yellow-100 text-yellow-700'},
  { key: 'traslado',      label: 'Traslado potrero',    badge: 'bg-sky-100 text-sky-700'      },
  { key: 'stock_inicial', label: 'Stock inicial',       badge: 'bg-gray-100 text-gray-600'    },
  { key: 'nota',          label: 'Nota',                badge: 'bg-gray-100 text-gray-500'    },
] as const

const EVENT_BADGE: Record<string, string> = Object.fromEntries(EVENT_TYPES.map(e => [e.key, e.badge]))
const EVENT_LABEL: Record<string, string> = Object.fromEntries(EVENT_TYPES.map(e => [e.key, e.label]))

const CATEGORIA_ABBR: Record<string, string> = {
  VACAS: 'VAC', VAQUILLONAS: 'VEQ', TERNEROS: 'TER', TERNERAS: 'TRA',
  NOVILLOS: 'NOV', NOVILLITOS: 'NVT', TOROS: 'TOR', MEJ: 'MEJ', BUBALINOS: 'BUB',
}

// ── Export helpers ────────────────────────────────────────────────────────────

async function exportHerdsExcel(
  herds: HerdData[],
  lotes: LoteData[],
  ungrouped: HerdData[],
) {
  const { utils, writeFile } = await import('xlsx')
  const wb = utils.book_new()

  // ── Sheet 1: Resumen del Establecimiento ──────────────────────────────────
  const totalCabezas = herds.reduce((s, h) => s + (h.head_count || 0), 0)
  const totalEV = herds.reduce((s, h) => s + (Number(h.total_ev) || 0), 0)
  const resumen = [
    ['REPORTE DE RODEOS — RODEO APP', '', '', ''],
    ['Generado', new Date().toLocaleString('es-AR'), '', ''],
    ['', '', '', ''],
    ['TOTALES DEL ESTABLECIMIENTO', '', '', ''],
    ['Total animales (cabezas)', totalCabezas, '', ''],
    ['Total EV', Math.round(totalEV), '', ''],
    ['Consumo MS/día (kg)', Math.round(totalEV * 11), '', ''],
    ['Lotes de manejo', lotes.length, '', ''],
    ['Rodeos individuales (sin lote)', ungrouped.length, '', ''],
    ['Total rodeos', herds.length, '', ''],
    ['', '', '', ''],
  ]
  const wsRes = utils.aoa_to_sheet(resumen)
  utils.book_append_sheet(wb, wsRes, 'Resumen')

  // ── Sheet 2: Detalle por Lote ─────────────────────────────────────────────
  const detRows: any[][] = [
    ['Lote', 'Rodeo / Sub-rodeo', 'Categoría Comercial', 'Cat. Fisiológica',
     'Stock (cab)', 'Peso prom (kg)', 'EV Total', 'Consumo MS/día (kg)',
     'Raza', 'Fecha ingreso', 'BCS'],
  ]
  // Lotes con sus hijos
  for (const lote of lotes) {
    const lt = lote.totales ?? {
      head_count: lote.hijos.reduce((s, h) => s + (h.head_count || 0), 0),
      total_ev: lote.hijos.reduce((s, h) => s + (Number(h.total_ev) || 0), 0),
      consumo_kg_ms_dia: 0,
    }
    detRows.push([
      `📂 ${lote.nombre}`,
      `(${lote.hijos.length} sub-rodeos)`,
      '', '', lt.head_count, '', Math.round(lt.total_ev),
      Math.round(lt.total_ev * 11), '', '', '',
    ])
    for (const h of lote.hijos) {
      const ev = Number(h.total_ev) || calculateBaseEV(h.categoria as any, Number(h.avg_weight_kg), h.head_count)
      detRows.push([
        lote.nombre,
        `  └ ${h.name}`,
        h.categoria ? (CATEGORIA_LABEL_RAE[h.categoria as CategoriaComercial] ?? h.categoria) : h.species,
        h.physiological_category ? (PHYSIO_LABEL[h.physiological_category as keyof typeof PHYSIO_LABEL] ?? h.physiological_category) : '—',
        h.head_count,
        h.avg_weight_kg ? Math.round(Number(h.avg_weight_kg)) : '',
        Math.round(ev),
        Math.round(ev * 11),
        h.breed ?? '',
        h.admission_date ?? '',
        h.bcs_score ?? '',
      ])
    }
    detRows.push(['', '', '', '', '', '', '', '', '', '', ''])
  }
  // Rodeos individuales
  if (ungrouped.length > 0) {
    detRows.push(['RODEOS INDIVIDUALES (sin lote)', '', '', '', '', '', '', '', '', '', ''])
    for (const h of ungrouped) {
      const ev = Number(h.total_ev) || calculateBaseEV(h.categoria as any, Number(h.avg_weight_kg), h.head_count)
      detRows.push([
        '—',
        h.name,
        h.categoria ? (CATEGORIA_LABEL_RAE[h.categoria as CategoriaComercial] ?? h.categoria) : h.species,
        h.physiological_category ? (PHYSIO_LABEL[h.physiological_category as keyof typeof PHYSIO_LABEL] ?? h.physiological_category) : '—',
        h.head_count,
        h.avg_weight_kg ? Math.round(Number(h.avg_weight_kg)) : '',
        Math.round(ev),
        Math.round(ev * 11),
        h.breed ?? '',
        h.admission_date ?? '',
        h.bcs_score ?? '',
      ])
    }
  }
  const wsDet = utils.aoa_to_sheet(detRows)
  utils.book_append_sheet(wb, wsDet, 'Rodeos por Lote')

  writeFile(wb, `rodeos-${new Date().toISOString().split('T')[0]}.xlsx`)
}

async function exportHistorialExcel(
  herds: HerdData[],
  lotes: LoteData[],
) {
  const { utils, writeFile } = await import('xlsx')
  const { apiFetch: fetch } = await import('@/lib/apiFetch')

  // Fetch events fresh so export is never stale
  const [evRes, movRes] = await Promise.all([
    fetch('/api/farm-events?limit=2000'),
    fetch('/api/movements?limit=2000'),
  ])
  const farmEvents: any[] = evRes.ok  ? ((await evRes.json()).events    ?? []) : []
  const movements:  any[] = movRes.ok ? ((await movRes.json()).movements ?? []) : []

  // Normalise to common shape
  const allEvs: any[] = [
    ...farmEvents.map((e: any) => ({
      herd_id:    e.herd_id ?? null,
      event_type: e.event_type ?? '',
      occurred_at: e.event_date ? e.event_date + 'T12:00:00Z' : null,
      quantity:   null,
      weight_kg:  null,
      bcs_score:  null,
      notes:      e.description ?? e.title ?? null,
    })),
    ...movements.map((m: any) => ({
      herd_id:    m.entity_id ?? null,
      event_type: m.event_type ?? '',
      occurred_at: m.occurred_at ?? null,
      quantity:   m.quantity ?? null,
      weight_kg:  m.weight_kg ?? null,
      bcs_score:  m.bcs_score ?? null,
      notes:      m.notes ?? null,
    })),
  ].sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''))

  const herdMap = Object.fromEntries(herds.map(h => [h.id, h]))
  const wb = utils.book_new()

  // ── Sheet 1: Resumen ──────────────────────────────────────────────────────
  const totalCabezas = herds.reduce((s, h) => s + (h.head_count || 0), 0)
  const totalEV      = herds.reduce((s, h) => s + (Number(h.total_ev) || 0), 0)

  const resRows: any[][] = [
    ['HISTORIAL DE EVENTOS — RODEO APP'],
    ['Generado', new Date().toLocaleString('es-AR')],
    [''],
    ['TOTALES DEL ESTABLECIMIENTO'],
    ['Total animales (cabezas)', totalCabezas],
    ['Total EV', Math.round(totalEV)],
    ['Consumo MS/dia (kg)', Math.round(totalEV * 11)],
    ['Total Lotes de Manejo', lotes.length],
    ['Total Rodeos', herds.length],
    ['Total eventos exportados', allEvs.length],
    [''],
    // Detalle de lotes en resumen
    ['LOTES DE MANEJO'],
    ['Lote', 'Sub-rodeos', 'Cabezas', 'EV Total'],
    ...lotes.map(l => {
      const tot = l.totales ?? {
        head_count: l.hijos.reduce((s, h) => s + (h.head_count || 0), 0),
        total_ev:   l.hijos.reduce((s, h) => s + (Number(h.total_ev) || 0), 0),
      }
      return [l.nombre, l.hijos.length, tot.head_count, Math.round(tot.total_ev)]
    }),
    [''],
    ['RODEOS INDIVIDUALES (sin lote)'],
    ['Nombre', 'Categoria', 'Cabezas', 'EV'],
    ...herds
      .filter(h => !h.grupo_manejo_id)
      .map(h => [
        h.name,
        h.categoria ? (CATEGORIA_LABEL_RAE[h.categoria as CategoriaComercial] ?? h.categoria) : h.species,
        h.head_count,
        Math.round(Number(h.total_ev) || 0),
      ]),
  ]
  utils.book_append_sheet(wb, utils.aoa_to_sheet(resRows), 'Resumen')

  // ── Sheet 2: Historial completo de eventos ────────────────────────────────
  // Agrupar por lote
  const byLote = new Map<string, { nombre: string; evs: any[] }>()
  const sinLote: any[] = []

  for (const ev of allEvs) {
    const herd = herdMap[ev.herd_id]
    const gid   = herd?.grupo_manejo_id
    const gnom  = herd?.grupo_manejo_nombre
    if (gid && gnom) {
      if (!byLote.has(gid)) byLote.set(gid, { nombre: gnom, evs: [] })
      byLote.get(gid)!.evs.push({ ...ev, _herdName: herd?.name ?? '' })
    } else {
      sinLote.push({ ...ev, _herdName: herd?.name ?? '' })
    }
  }

  const histRows: any[][] = [
    ['Fecha', 'Tipo de evento', 'Lote', 'Rodeo', 'Cantidad', 'Peso prom. (kg)', 'BCS', 'Notas'],
  ]

  const fmtEvDate = (ev: any): string => {
    const d = ev.occurred_at ?? null
    if (!d) return ''
    try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
    catch { return '' }
  }

  // Lotes agrupados
  for (const [, { nombre, evs }] of byLote) {
    // Separador de lote
    histRows.push([`=== LOTE: ${nombre} (${evs.length} eventos) ===`, '', '', '', '', '', '', ''])
    for (const ev of evs) {
      histRows.push([
        fmtEvDate(ev),
        EVENT_LABEL[ev.event_type] ?? ev.event_type,
        nombre,
        ev._herdName,
        ev.quantity ?? '',
        ev.weight_kg != null ? Math.round(ev.weight_kg) : '',
        ev.bcs_score ?? '',
        ev.notes ?? '',
      ])
    }
    histRows.push(['', '', '', '', '', '', '', '']) // separador vacío
  }

  // Rodeos sin lote
  if (sinLote.length > 0) {
    histRows.push([`=== RODEOS INDIVIDUALES (${sinLote.length} eventos) ===`, '', '', '', '', '', '', ''])
    for (const ev of sinLote) {
      histRows.push([
        fmtEvDate(ev),
        EVENT_LABEL[ev.event_type] ?? ev.event_type,
        '',
        ev._herdName,
        ev.quantity ?? '',
        ev.weight_kg != null ? Math.round(ev.weight_kg) : '',
        ev.bcs_score ?? '',
        ev.notes ?? '',
      ])
    }
  }

  utils.book_append_sheet(wb, utils.aoa_to_sheet(histRows), 'Historial')
  writeFile(wb, `historial-${new Date().toISOString().split('T')[0]}.xlsx`)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HerdsPage() {
  const { user } = useAuth()
  const { confirm, ConfirmModal } = useConfirm()
  const [herds,     setHerds]     = useState<HerdData[]>([])
  const [lotes,     setLotes]     = useState<LoteData[]>([])
  const [ungrouped, setUngrouped] = useState<HerdData[]>([])
  const [loading,   setLoading]   = useState(true)

  // Filters
  const [search,         setSearch]         = useState('')
  const [filterCat,      setFilterCat]      = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')
  const [showFilters,    setShowFilters]    = useState(false)

  // View
  const [view, setView] = useState<'cards' | 'list' | 'historial'>('cards')

  // List view accordion state
  const [listExpandedLotes, setListExpandedLotes] = useState<Set<string>>(new Set())

  // Historial state
  const [allEvents,   setAllEvents]   = useState<any[]>([])
  const [loadingMov,  setLoadingMov]  = useState(false)
  const [eventFilter, setEventFilter] = useState('all')
  const [movSearch,   setMovSearch]   = useState('')

  // Historial accordion
  const [histExpandedLotes, setHistExpandedLotes] = useState<Set<string>>(new Set())

  // Sort (list view)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)

  // Modal
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editingHerd, setEditingHerd] = useState<HerdData | null>(null)

  const { getLimit } = usePlan()
  const maxHerds = getLimit('max_herds')
  const canCreateMore = herds.length < maxHerds

  const [isOfflineData, setIsOfflineData] = useState(false)

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadHerds = async () => {
    if (!user) return
    setLoading(true)
    try {
      // ── Paso 1: IndexedDB inmediata (sin espera) ──────────────────────────
      const { dbGetAll } = await import('@/lib/offline/db')
      const localHerds = await dbGetAll('herds')
      if (localHerds.length > 0) {
        // Mostrar herds como lista plana offline (sin reconstruir lotes)
        setHerds(localHerds as HerdData[])
        setUngrouped(localHerds as HerdData[])
        setLotes([])
        setLoading(false)
        setIsOfflineData(false)
        import('@/lib/analytics').then(({ event }) => event({ action: 'herds_view', category: 'herds', mode: 'offline' }))
      }

      // ── Paso 2: API en background ────────────────────────────────────────
      const res = await apiFetch('/api/herds')
      if (res.ok) {
        const data = await res.json()
        const herdsData = data.herds || []
        setHerds(herdsData)
        setLotes(data.lotes || [])
        setUngrouped(data.ungrouped || herdsData)
        setIsOfflineData(false)
        import('@/lib/analytics').then(({ event }) => event({ action: 'herds_view', category: 'herds', mode: 'online' }))
        // Guardar en IndexedDB
        const { dbUpsertMany } = await import('@/lib/offline/db')
        await dbUpsertMany('herds', herdsData)
        // También en localStorage como respaldo
        try {
          localStorage.setItem('rodeo_cached_herds', JSON.stringify({
            herds: herdsData,
            lotes: data.lotes || [],
            ungrouped: data.ungrouped || herdsData,
          }))
        } catch { /* ignore */ }
      } else {
        throw new Error('API error')
      }
    } catch {
      // Fallback: datos de IndexedDB ya se cargaron arriba
      // Si no había nada en IndexedDB, intentar localStorage
      if (herds.length === 0) {
        try {
          const cached = JSON.parse(localStorage.getItem('rodeo_cached_herds') || 'null')
          if (cached) {
            setHerds(cached.herds || [])
            setLotes(cached.lotes || [])
            setUngrouped(cached.ungrouped || cached.herds || [])
            setIsOfflineData(true)
          }
        } catch { /* ignore */ }
      } else {
        setIsOfflineData(true)
      }
    }
    setLoading(false)
  }


  const loadHistorial = async () => {
    setLoadingMov(true)
    // Fetch both farm-events (paricion/destete/venta/compra/etc.) + movements (BCS/pesada)
    const [evRes, movRes] = await Promise.all([
      apiFetch('/api/farm-events?limit=500'),
      apiFetch('/api/movements?limit=500'),
    ])
    const farmEvents: any[] = evRes.ok ? ((await evRes.json()).events ?? []) : []
    const movements:  any[] = movRes.ok ? ((await movRes.json()).movements ?? []) : []

    // Normalise: give each a common shape { id, herd_id, event_type, occurred_at, quantity, weight_kg, bcs_score, notes }
    const normFarm = farmEvents.map((e: any) => ({
      id:          e.id,
      herd_id:     e.herd_id ?? null,
      entity_id:   e.herd_id ?? null,
      event_type:  e.event_type,
      occurred_at: e.event_date ? e.event_date + 'T12:00:00Z' : null,
      event_date:  e.event_date,
      quantity:    null,
      weight_kg:   null,
      bcs_score:   null,
      notes:       e.description ?? e.title ?? null,
      source:      'farm_event',
    }))
    const normMov = movements.map((m: any) => ({
      id:          m.id,
      herd_id:     m.entity_id ?? null,
      entity_id:   m.entity_id ?? null,
      event_type:  m.event_type,
      occurred_at: m.occurred_at,
      event_date:  null,
      quantity:    m.quantity,
      weight_kg:   m.weight_kg,
      bcs_score:   m.bcs_score,
      notes:       m.notes,
      source:      'movement',
    }))

    // Merge + sort by date desc (most recent first)
    const merged = [...normFarm, ...normMov].sort((a, b) => {
      const da = a.occurred_at ?? ''
      const db = b.occurred_at ?? ''
      return db.localeCompare(da)
    })

    setAllEvents(merged)
    setLoadingMov(false)
  }

  useEffect(() => { loadHerds() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ──────────────────────────────────────────────────────────

  const totalAnimals = Math.round(herds.reduce((s, h) => s + (h.head_count || 0), 0))
  const totalEV      = Math.round(herds.reduce((s, h) => s + (Number(h.total_ev) || 0), 0))
  const totalMsDay   = Math.round(totalEV * 11)

  // Filtered lists for cards view
  const filteredLotes = useMemo(() => {
    if (!search && filterCat === 'all' && !filterDateFrom && !filterDateTo) return lotes
    return lotes
      .map(lote => ({
        ...lote,
        hijos: lote.hijos.filter(h => {
          const q = search.toLowerCase()
          const ms = !q || h.name.toLowerCase().includes(q) || (lote.nombre ?? '').toLowerCase().includes(q) ||
            (h.categoria ? (CATEGORIA_LABEL_RAE[h.categoria as CategoriaComercial] ?? '').toLowerCase().includes(q) : false)
          const mc = filterCat === 'all' || (h.categoria ?? '') === filterCat
          const ad = h.admission_date ?? ''
          return ms && mc && (!filterDateFrom || ad >= filterDateFrom) && (!filterDateTo || ad <= filterDateTo)
        }),
      }))
      .filter(l => l.hijos.length > 0)
  }, [lotes, search, filterCat, filterDateFrom, filterDateTo])

  const filteredUngrouped = useMemo(() =>
    ungrouped.filter(h => {
      const q = search.toLowerCase()
      const ms = !q || h.name.toLowerCase().includes(q) || (h.breed ?? '').toLowerCase().includes(q) ||
        (h.categoria ? (CATEGORIA_LABEL_RAE[h.categoria as CategoriaComercial] ?? '').toLowerCase().includes(q) : false) ||
        h.species.toLowerCase().includes(q)
      const mc = filterCat === 'all' || (h.categoria ?? '') === filterCat
      const ad = h.admission_date ?? ''
      return ms && mc && (!filterDateFrom || ad >= filterDateFrom) && (!filterDateTo || ad <= filterDateTo)
    }),
  [ungrouped, search, filterCat, filterDateFrom, filterDateTo])

  // Flat sorted list for list view (used for ungrouped rows + sort)
  const filteredFlat = useMemo(() => {
    let list = herds.filter(h => {
      const q = search.toLowerCase()
      const ms = !q || h.name.toLowerCase().includes(q) || (h.breed ?? '').toLowerCase().includes(q) ||
        (h.grupo_manejo_nombre ?? '').toLowerCase().includes(q) ||
        (h.categoria ? (CATEGORIA_LABEL_RAE[h.categoria as CategoriaComercial] ?? '').toLowerCase().includes(q) : false) ||
        h.species.toLowerCase().includes(q)
      const mc = filterCat === 'all' || (h.categoria ?? '') === filterCat
      const ad = h.admission_date ?? ''
      return ms && mc && (!filterDateFrom || ad >= filterDateFrom) && (!filterDateTo || ad <= filterDateTo)
    })
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sortAsc ? cmp : -cmp
    })
  }, [herds, search, filterCat, filterDateFrom, filterDateTo, sortKey, sortAsc])

  // Historial events filtered
  const filteredEvents = useMemo(() => {
    return allEvents
      .filter(ev => eventFilter === 'all' || ev.event_type === eventFilter)
      .filter(ev => {
        if (!movSearch.trim()) return true
        const q = movSearch.toLowerCase()
        const herd = herds.find(h => h.id === (ev.herd_id ?? ev.entity_id))
        return (
          (herd?.name ?? '').toLowerCase().includes(q) ||
          (herd?.grupo_manejo_nombre ?? '').toLowerCase().includes(q) ||
          (ev.notes ?? '').toLowerCase().includes(q) ||
          (EVENT_LABEL[ev.event_type] ?? '').toLowerCase().includes(q)
        )
      })
  }, [allEvents, eventFilter, movSearch, herds])

  // Group historial events by lote
  const historialByLote = useMemo(() => {
    const herdMap = Object.fromEntries(herds.map(h => [h.id, h]))
    const byLote = new Map<string, { nombre: string; events: any[] }>()
    const sinLoteEvs: any[] = []

    for (const ev of filteredEvents) {
      const herd = herdMap[ev.herd_id ?? ev.entity_id]
      const gid    = herd?.grupo_manejo_id
      const gnom   = herd?.grupo_manejo_nombre
      if (gid && gnom) {
        if (!byLote.has(gid)) byLote.set(gid, { nombre: gnom, events: [] })
        byLote.get(gid)!.events.push({ ...ev, _herd: herd })
      } else {
        sinLoteEvs.push({ ...ev, _herd: herd })
      }
    }
    return { byLote: Array.from(byLote.entries()), sinLote: sinLoteEvs }
  }, [filteredEvents, herds])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const toggleListLote = (id: string) => setListExpandedLotes(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleHistLote = (id: string) => setHistExpandedLotes(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const openCreate = () => { 
    import('@/lib/analytics').then(({ event }) => event({ action: 'herds_create_click', category: 'herds' }))
    setEditingHerd(null); 
    setModalOpen(true) 
  }
  const openEdit   = (h: HerdData) => { 
    import('@/lib/analytics').then(({ event }) => event({ action: 'herds_edit_click', category: 'herds' }))
    setEditingHerd(h); 
    setModalOpen(true) 
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: '¿Eliminar este rodeo?',
      description: 'Esta acción es irreversible.',
      confirmLabel: 'Sí, eliminar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
    })
    if (!ok) return
    const res = await apiFetch(`/api/herds/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error desconocido' }))
      toast.error(`No se pudo eliminar: ${err.error}`)
    } else {
      import('@/lib/analytics').then(({ event }) => event({ action: 'herds_delete', category: 'herds' }))
      setHerds(p => p.filter(h => h.id !== id))
      setUngrouped(p => p.filter(h => h.id !== id))
      setLotes(p => p.map(l => ({ ...l, hijos: l.hijos.filter(h => h.id !== id) })).filter(l => l.hijos.length > 0))
      toast.success('Rodeo eliminado')
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null

  // ── Shared table columns ──────────────────────────────────────────────────

  const TABLE_COLS: { key: SortKey | null; label: string }[] = [
    { key: 'name',           label: 'Nombre'           },
    { key: null,             label: 'Categoría'        },
    { key: 'head_count',     label: 'Stock'            },
    { key: 'avg_weight_kg',  label: 'Peso prom.'       },
    { key: null,             label: 'Raza'             },
    { key: 'admission_date', label: 'Ingreso'          },
    { key: 'total_ev',       label: 'EV'               },
  ]

  function HerdRow({ herd, indent = false }: { herd: HerdData; indent?: boolean }) {
    const catKey  = herd.categoria as CategoriaComercial | null
    const colors  = catKey ? CATEGORIA_COLORS[catKey] : null
    const catDisp = catKey ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey) : herd.species
    const ev      = Number(herd.total_ev) || calculateBaseEV(catKey, Number(herd.avg_weight_kg), herd.head_count)
    return (
      <tr
        className="hover:bg-green-50/30 transition-colors cursor-pointer group"
        onClick={() => openEdit(herd)}
      >
        <td className="px-4 py-2.5">
          <p className={`text-sm font-bold text-gray-900 flex items-center gap-2 ${indent ? 'pl-5' : ''}`}>
            {indent && <span className="text-gray-300 text-xs">└</span>}
            {herd.name}
            {herd.exit_date && <span className="text-[8px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">TEMP</span>}
          </p>
          {herd.physiological_category && (
            <p className={`text-[9px] font-bold text-green-700/70 uppercase tracking-wider mt-0.5 ${indent ? 'pl-5' : ''}`}>
              {PHYSIO_LABEL[herd.physiological_category as keyof typeof PHYSIO_LABEL] ?? herd.physiological_category}
            </p>
          )}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full shrink-0 ${colors?.dot ?? 'bg-gray-300'}`} />
            <span className="text-xs font-bold text-gray-600 uppercase tracking-tighter">{catDisp}</span>
          </div>
        </td>
        <td className="px-4 py-2.5 text-sm font-bold text-gray-800">{Math.round(herd.head_count).toLocaleString('es-AR')}</td>
        <td className="px-4 py-2.5 text-sm text-gray-600">{herd.avg_weight_kg ? `${Math.round(Number(herd.avg_weight_kg))} kg` : '—'}</td>
        <td className="px-4 py-2.5 text-sm text-gray-500">{herd.breed || '—'}</td>
        <td className="px-4 py-2.5 text-sm text-gray-500">{fmtDate(herd.admission_date)}</td>
        <td className="px-4 py-2.5 text-sm font-black text-gray-900">{Math.round(ev).toLocaleString('es-AR')}</td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={e => { e.stopPropagation(); openEdit(herd) }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-xl transition-all opacity-0 group-hover:opacity-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Editar
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
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Rodeos</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Gestión de lotes de manejo, estados fisiológicos y carga animal.</p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
          {/* View toggle */}
          <div className="bg-gray-100 rounded-xl p-0.5 flex gap-0.5 shrink-0">
            {(['cards', 'list', 'historial'] as const).map(v => (
              <button key={v}
                onClick={() => { 
                  import('@/lib/analytics').then(({ event }) => event({ action: 'herds_change_view', category: 'herds', view_mode: v }))
                  setView(v); 
                  if (v === 'historial') loadHistorial() 
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {v === 'cards' && <IconoRodeos className="w-3.5 h-3.5 shrink-0" />}
                {v === 'list'  && <List   className="w-3.5 h-3.5 shrink-0" />}
                {v === 'historial' && <Calendar className="w-3.5 h-3.5 shrink-0" />}
                <span className="hidden sm:inline capitalize">{v === 'cards' ? 'Lotes' : v === 'list' ? 'Lista' : 'Historial'}</span>
              </button>
            ))}
          </div>
          {/* Export */}
          {view === 'historial' ? (
            <button
              onClick={() => {
                import('@/lib/analytics').then(({ event }) => event({ action: 'herds_export_historial', category: 'herds' }))
                exportHistorialExcel(herds, lotes)
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all shrink-0">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar historial</span>
            </button>
          ) : (
            <button
              onClick={() => {
                import('@/lib/analytics').then(({ event }) => event({ action: 'herds_export_excel', category: 'herds' }))
                exportHerdsExcel(herds, lotes, ungrouped)
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all shrink-0">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          )}
          {canCreateMore ? (
            <button onClick={openCreate}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-sm shadow-green-200 whitespace-nowrap shrink-0">
              <Plus className="w-4 h-4 shrink-0" /> Nuevo rodeo
            </button>
          ) : (
            <button onClick={() => toast.info(`Límite: Tu plan permite hasta ${maxHerds} rodeos.`)}
              className="flex items-center gap-2 bg-gray-100 text-gray-400 px-4 py-2.5 rounded-xl font-bold text-sm border border-gray-200 cursor-not-allowed whitespace-nowrap shrink-0">
              <Lock className="w-3.5 h-3.5" /> {maxHerds}/{maxHerds}
            </button>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      {/* ── Banner de datos sin conexión ── */}
      {isOfflineData && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700">
          <WifiOff className="w-4 h-4 shrink-0" />
          <p className="text-xs font-bold">Mostrando últimos datos guardados · Sin conexión</p>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div className="sm:col-span-1 bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-5 text-white shadow-md shadow-green-200">
          <p className="text-[10px] font-black tracking-widest uppercase text-green-100 mb-2">Establecimiento</p>
          <p className="text-4xl font-black tabular-nums leading-none">{totalAnimals.toLocaleString('es-AR')}</p>
          <p className="text-sm font-bold text-green-100 mt-1">animales totales</p>
          <div className="mt-3 pt-3 border-t border-green-500/40 flex items-center gap-4">
            <div>
              <p className="text-[9px] font-black text-green-200 uppercase tracking-widest">EV Total</p>
              <p className="text-lg font-black">{totalEV.toLocaleString('es-AR')}</p>
            </div>
            <div>
              <p className="text-[9px] font-black text-green-200 uppercase tracking-widest">MS/día</p>
              <p className="text-lg font-black">{totalMsDay.toLocaleString('es-AR')} <span className="text-xs font-medium text-green-200">kg</span></p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-2">
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Lotes de manejo</p>
            <Info className="w-3.5 h-3.5 text-gray-300" />
          </div>
          <p className="text-4xl font-black text-gray-950">{lotes.length}</p>
          <p className="text-[9px] text-gray-400 mt-1 font-medium">{lotes.length === 1 ? 'lote activo' : 'lotes activos'}</p>
          <div className="mt-3 pt-3 border-t border-gray-50">
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Sub-rodeos</p>
            <p className="text-xl font-black text-gray-700">{herds.length - ungrouped.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Rodeos individuales</p>
          <p className="text-4xl font-black text-gray-950">{ungrouped.length}</p>
          <p className="text-[9px] text-gray-400 mt-1 font-medium">sin agrupar en lote</p>
          <div className="mt-3 pt-3 border-t border-gray-50">
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mb-0.5">EV individual</p>
            <p className="text-xl font-black text-gray-700">
              {Math.round(ungrouped.reduce((s, h) => s + (Number(h.total_ev) || 0), 0)).toLocaleString('es-AR')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Search + Filters (no en historial) ── */}
      {view !== 'historial' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-3">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por nombre, lote, categoría o raza..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-50 border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-1 focus:ring-green-600 outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-700 outline-none cursor-pointer focus:ring-1 focus:ring-green-600 min-w-[130px]">
              <option value="all">Categoría</option>
              {CATEGORIAS_COMERCIALES.map(k => (
                <option key={k} value={k}>{CATEGORIA_LABEL_RAE[k as CategoriaComercial]}</option>
              ))}
            </select>
            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                showFilters || filterDateFrom || filterDateTo
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'
              }`}>
              <Filter className="w-3.5 h-3.5" /> Fechas
            </button>
            {(search || filterCat !== 'all' || filterDateFrom || filterDateTo) && (
              <button onClick={() => { setSearch(''); setFilterCat('all'); setFilterDateFrom(''); setFilterDateTo('') }}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors">
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </div>
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
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
      )}

      {/* ── Results count ── */}
      {!loading && view === 'cards' && (
        <p className="text-[11px] text-gray-400 font-bold tracking-wide">
          {filteredLotes.length > 0 && `${filteredLotes.length} lote${filteredLotes.length !== 1 ? 's' : ''}`}
          {filteredLotes.length > 0 && filteredUngrouped.length > 0 && ' · '}
          {filteredUngrouped.length > 0 && `${filteredUngrouped.length} individual${filteredUngrouped.length !== 1 ? 'es' : ''}`}
        </p>
      )}
      {!loading && view === 'list' && (
        <p className="text-[11px] text-gray-400 font-bold tracking-wide">
          {filteredFlat.length} rodeo{filteredFlat.length !== 1 ? 's' : ''} encontrado{filteredFlat.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* ════ CARDS VIEW ════ */}
      {view === 'cards' && (
        loading ? (
          <div className="space-y-4 pb-24 sm:pb-10">
            {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : filteredLotes.length === 0 && filteredUngrouped.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
            <IconoRodeos className="w-6 h-6 mx-auto text-gray-200 mb-2" />
            <p className="text-sm font-bold text-gray-400">No hay rodeos que mostrar</p>
            <p className="text-[10px] text-gray-300 mt-1">Creá tu primer rodeo o cambiá los filtros</p>
          </div>
        ) : (
          <div className="space-y-4 pb-24 sm:pb-10">
            {filteredLotes.length > 0 && (
              <>
                {filteredUngrouped.length > 0 && (
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Lotes de manejo</p>
                )}
                <AnimatePresence>
                  {filteredLotes.map(lote => (
                    <motion.div key={lote.grupo_manejo_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2 }}>
                      <LoteCard lote={lote} onManageHerd={openEdit} onDeleteHerd={handleDelete} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}
            {filteredUngrouped.length > 0 && (
              <>
                {filteredLotes.length > 0 && (
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mt-2">Rodeos individuales</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {filteredUngrouped.map(herd => {
                      const catKey  = herd.categoria as CategoriaComercial | null
                      const colors  = catKey ? CATEGORIA_COLORS[catKey] : null
                      const catDisp = catKey ? (CATEGORIA_LABEL_RAE[catKey] ?? catKey) : herd.species
                      const ev      = Number(herd.total_ev) || calculateBaseEV(catKey, Number(herd.avg_weight_kg), herd.head_count)
                      return (
                        <motion.div key={herd.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2 }}
                          className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group cursor-pointer" onClick={() => openEdit(herd)}>
                          <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="shrink-0 w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                                <span className="text-[10px] font-black text-gray-400">
                                  {catKey ? (CATEGORIA_ABBR[catKey] ?? catKey.slice(0,3)) : (herd.species ?? '?').slice(0,3).toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-xl font-black text-gray-950 leading-tight truncate">{herd.name}</h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors?.dot ?? 'bg-gray-300'}`} />
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide truncate">{catDisp}</p>
                                </div>
                                {herd.physiological_category && (
                                  <p className="text-[9px] font-bold text-green-700/70 uppercase tracking-wider mt-0.5 truncate">
                                    {PHYSIO_LABEL[herd.physiological_category as keyof typeof PHYSIO_LABEL] ?? herd.physiological_category}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button onClick={e => { e.stopPropagation(); handleDelete(herd.id!) }}
                              className="shrink-0 w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="px-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-baseline gap-2">
                                <p className="text-3xl font-semibold text-gray-950 tabular-nums">{Math.round(herd.head_count).toLocaleString('es-AR')}</p>
                                <p className="text-sm font-bold text-gray-400">cabezas</p>
                              </div>
                              <div onClick={e => e.stopPropagation()}>
                                <WeatherConditionChip mode="herd" entityName={herd.name} />
                              </div>
                            </div>
                            <div className="flex items-center gap-4 pt-3 border-t border-gray-50">
                              <div>
                                <p className="text-[9px] font-black text-gray-300 tracking-widest uppercase mb-0.5">EV</p>
                                <p className="text-sm font-black text-gray-500">{Math.round(ev).toLocaleString('es-AR')}</p>
                              </div>
                              <div className="w-px h-6 bg-gray-100" />
                              <div>
                                <p className="text-[9px] font-black text-gray-300 tracking-widest uppercase mb-0.5">MS/día</p>
                                <p className="text-sm font-black text-gray-500">{Math.round(ev * 11).toLocaleString('es-AR')} <span className="text-gray-400 font-medium">kg</span></p>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
                              <button onClick={e => { e.stopPropagation(); openEdit(herd) }}
                                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-green-700 bg-green-600/10 hover:bg-green-600/20 border border-green-600 rounded-xl transition-all">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                                Editar
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        )
      )}

      {/* ════ LIST VIEW — Acordeón ════ */}
      {view === 'list' && (
        loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : filteredFlat.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
            <p className="text-sm font-bold text-gray-400">No hay rodeos que mostrar</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-24 sm:mb-10">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50/70">
                <tr>
                  {TABLE_COLS.map(({ key, label }) => (
                    <th key={label} onClick={key ? () => handleSort(key) : undefined}
                      className={`text-left px-4 py-3 text-[10px] font-black text-gray-400 tracking-widest uppercase select-none ${key ? 'cursor-pointer hover:text-gray-600 transition-colors' : ''}`}>
                      <span className="flex items-center gap-1">{label}{key && <SortIcon k={key} />}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {/* ── Lotes agrupados ── */}
                {filteredLotes.map(lote => {
                  const expanded = listExpandedLotes.has(lote.grupo_manejo_id)
                  const safeTot  = lote.totales ?? {
                    head_count: lote.hijos.reduce((s, h) => s + (h.head_count || 0), 0),
                    total_ev:   lote.hijos.reduce((s, h) => s + (Number(h.total_ev) || 0), 0),
                    consumo_kg_ms_dia: 0,
                  }
                  return (
                    <React.Fragment key={lote.grupo_manejo_id}>
                      {/* Fila Lote (header expandible) */}
                      <tr
                        className="bg-green-50/60 cursor-pointer hover:bg-green-100/40 transition-colors border-b border-green-100/50 group"
                        onClick={() => toggleListLote(lote.grupo_manejo_id)}
                      >
                        <td className="px-4 py-3" colSpan={7}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-100 to-emerald-200 border border-green-200 flex items-center justify-center shrink-0">
                              <IconoRodeos className="w-3.5 h-3.5 text-green-700" />
                            </div>
                            <div>
                              <span className="text-sm font-black text-gray-900">{lote.nombre}</span>
                              <span className="ml-2 text-[9px] font-black bg-green-600 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">LOTE</span>
                            </div>
                            <span className="text-xs text-gray-400 font-medium ml-1">
                              {lote.hijos.length} sub-rodeo{lote.hijos.length !== 1 ? 's' : ''} · {safeTot.head_count.toLocaleString('es-AR')} cab · EV {Math.round(safeTot.total_ev).toLocaleString('es-AR')}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <div className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${expanded ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* Filas hijos */}
                      {expanded && lote.hijos.map(herd => (
                        <HerdRow key={herd.id} herd={herd} indent />
                      ))}
                    </React.Fragment>
                  )
                })}

                {/* ── Rodeos individuales (sin grupo) ── */}
                {filteredUngrouped.length > 0 && filteredLotes.length > 0 && (
                  <tr className="bg-gray-50/50">
                    <td colSpan={8} className="px-4 py-2">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Rodeos individuales</span>
                    </td>
                  </tr>
                )}
                {filteredUngrouped.map(herd => (
                  <HerdRow key={herd.id} herd={herd} />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ════ HISTORIAL VIEW ════ */}
      {view === 'historial' && (
        <div className="space-y-4">
          {/* Toolbar historial */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input type="text" value={movSearch} onChange={e => setMovSearch(e.target.value)}
                placeholder="Buscar por rodeo, lote o notas..."
                className="w-full bg-gray-50 border-none rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-green-500" />
              {movSearch && (
                <button onClick={() => setMovSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              )}
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select value={eventFilter} onChange={e => setEventFilter(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 text-sm font-bold text-gray-700 outline-none focus:ring-1 focus:ring-green-500 appearance-none cursor-pointer">
                <option value="all">Todos los eventos</option>
                {EVENT_TYPES.map(et => <option key={et.key} value={et.key}>{et.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Table historial */}
          {loadingMov ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 py-20 text-center shadow-sm">
              <Calendar className="w-6 h-6 mx-auto text-gray-200 mb-2" />
              <p className="text-sm font-bold text-gray-400">Sin eventos registrados</p>
              <p className="text-[10px] text-gray-300 mt-1">Gestioná un rodeo para registrar el primer evento</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-24 sm:mb-10">
              <table className="w-full">
                <thead className="border-b border-gray-100 bg-gray-50/70">
                  <tr>
                    {['Fecha', 'Tipo', 'Rodeo', 'Cantidad', 'Peso', 'Notas'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-black text-gray-400 tracking-widest uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* ── Eventos por Lote ── */}
                  {historialByLote.byLote.map(([gid, { nombre, events }]) => {
                    const expanded = histExpandedLotes.has(gid)
                    return (
                      <React.Fragment key={gid}>
                        {/* Fila Lote expandible */}
                        <tr
                          className="bg-green-50/60 cursor-pointer hover:bg-green-100/40 transition-colors group"
                          onClick={() => toggleHistLote(gid)}
                        >
                          <td colSpan={5} className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-green-100 to-emerald-200 border border-green-200 flex items-center justify-center shrink-0">
                                <IconoRodeos className="w-3 h-3 text-green-700" />
                              </div>
                              <span className="text-sm font-black text-gray-900">{nombre}</span>
                              <span className="text-[9px] font-black bg-green-600 text-white px-2 py-0.5 rounded-full tracking-widest uppercase">LOTE</span>
                              <span className="text-xs text-gray-400 font-medium">{events.length} evento{events.length !== 1 ? 's' : ''}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end">
                              <div className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${expanded ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </div>
                            </div>
                          </td>
                        </tr>
                        {/* Filas de eventos */}
                        {expanded && events.map((ev, i) => {
                          const badge = EVENT_BADGE[ev.event_type] ?? 'bg-gray-100 text-gray-500'
                          const label = EVENT_LABEL[ev.event_type] ?? ev.event_type
                          const dateStr = ev.occurred_at
                            ? new Date(ev.occurred_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
                            : ev.event_date
                            ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
                            : '—'
                          return (
                            <tr key={ev.id ?? i} className="bg-white hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-2.5 pl-10 text-xs font-bold text-gray-500 tabular-nums whitespace-nowrap">
                                <span className="text-gray-300 mr-1">└</span>{dateStr}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${badge}`}>{label}</span>
                              </td>
                              <td className="px-4 py-2.5 text-sm font-bold text-gray-800">{ev._herd?.name ?? '—'}</td>
                              <td className="px-4 py-2.5 text-sm font-bold text-gray-700">{ev.quantity != null ? ev.quantity.toLocaleString('es-AR') : '—'}</td>
                              <td className="px-4 py-2.5 text-sm text-gray-500">{ev.weight_kg ? `${Math.round(ev.weight_kg)} kg` : '—'}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[220px] truncate">{ev.notes ?? '—'}</td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}

                  {/* ── Eventos sin Lote ── */}
                  {historialByLote.sinLote.length > 0 && (
                    <>
                      {historialByLote.byLote.length > 0 && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={6} className="px-4 py-2">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Rodeos individuales</span>
                          </td>
                        </tr>
                      )}
                      {historialByLote.sinLote.map((ev, i) => {
                        const badge = EVENT_BADGE[ev.event_type] ?? 'bg-gray-100 text-gray-500'
                        const label = EVENT_LABEL[ev.event_type] ?? ev.event_type
                        const dateStr = ev.occurred_at
                          ? new Date(ev.occurred_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
                          : ev.event_date
                          ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: '2-digit' })
                          : '—'
                        return (
                          <tr key={ev.id ?? i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-2.5 text-xs font-bold text-gray-500 tabular-nums whitespace-nowrap">{dateStr}</td>
                            <td className="px-4 py-2.5"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${badge}`}>{label}</span></td>
                            <td className="px-4 py-2.5 text-sm font-bold text-gray-800">{ev._herd?.name ?? '—'}</td>
                            <td className="px-4 py-2.5 text-sm font-bold text-gray-700">{ev.quantity != null ? ev.quantity.toLocaleString('es-AR') : '—'}</td>
                            <td className="px-4 py-2.5 text-sm text-gray-500">{ev.weight_kg ? `${Math.round(ev.weight_kg)} kg` : '—'}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[220px] truncate">{ev.notes ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}
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
