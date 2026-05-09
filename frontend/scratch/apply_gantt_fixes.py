#!/usr/bin/env python3
"""Apply all Gantt animal section fixes to grazing/page.tsx"""

FILE = '/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content)

# ─── 1. HerdModal import ───────────────────────────────────────────────────
content = content.replace(
    """} from '@/lib/categorias'


// ─────────────── CONSTANTS ───────────────""",
    """} from '@/lib/categorias'
import HerdModal, { type HerdData } from '@/components/HerdModal'


// ─────────────── CONSTANTS ───────────────""",
    1
)

# ─── 2. onAddHerd tipo + onHerdClick in InteractiveGantt types ────────────
content = content.replace(
    "  onHerdUpdate?: (herdId: string, updates: Record<string, any>) => void\n  onEditEvent?: (evt: any) => void\n  onAddHerd?: () => void\n})",
    "  onHerdUpdate?: (herdId: string, updates: Record<string, any>) => void\n  onEditEvent?: (evt: any) => void\n  onAddHerd?: (tipo?: 'permanente' | 'temporal') => void\n  onHerdClick?: (herd: any) => void\n})",
    1
)

# ─── 3. onHerdClick in destructuring ─────────────────────────────────────
content = content.replace(
    "  isDrawingMode = false, onDrawEnd, onHerdUpdate, onEditEvent, onAddHerd,\n}: {",
    "  isDrawingMode = false, onDrawEnd, onHerdUpdate, onEditEvent, onAddHerd, onHerdClick,\n}: {",
    1
)

# ─── 4. Herd name label → clickable button ────────────────────────────────
content = content.replace(
    '''                        {/* Herd name label */}
                        <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="pl-4 pr-2.5 flex items-center border-r border-gray-200 shrink-0 gap-1 justify-start">
                          <span className="text-[8px] font-black text-gray-700 truncate">{hi + 1}. {herd.name}</span>
                          {herd.category && (
                            <span className="text-[7px] text-gray-400 font-medium shrink-0">({herd.category})</span>
                          )}
                        </div>''',
    '''                        {/* Herd name label — clickable */}
                        <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="pl-4 pr-2.5 flex items-center border-r border-gray-200 shrink-0 gap-1 justify-start">
                          <button
                            className="text-[8px] font-black text-gray-700 truncate hover:text-green-700 hover:underline transition-colors text-left"
                            onClick={() => onHerdClick?.(herd)}
                          >
                            {hi + 1}. {herd.name}
                          </button>
                          {herd.category && (
                            <span className="text-[7px] text-gray-400 font-medium shrink-0">({herd.category})</span>
                          )}
                        </div>''',
    1
)

# ─── 5. Fix per-month EV calc (admission/exit date + correct formula) ──────
content = content.replace(
    """                            const active = monthPlansForHerd.length > 0
                            const currentHeadCount = Number(herd.head_count) || 0
                            const headCount = getDynamicHeadcount(herd.id, currentHeadCount, m.startDate)""",
    """                            const herdEntry = herd.admission_date || '2000-01-01'
                            const herdExit = herd.exit_date || '2100-01-01'
                            const herdActiveThisMonth = herdEntry <= m.endDate && herdExit >= m.startDate
                            const currentHeadCount = Number(herd.head_count) || 0
                            const headCount = herdActiveThisMonth ? getDynamicHeadcount(herd.id, currentHeadCount, m.startDate) : 0""",
    1
)

content = content.replace(
    """                            const peso = Number(herd.avg_weight_kg) || 0
                            const baseEv = Number(herd.total_ev) || 0
                            const ev = currentHeadCount > 0 ? (baseEv / currentHeadCount) * headCount : baseEv
                            const active = monthPlansForHerd.length > 0""",
    """                            const peso = Number(herd.avg_weight_kg) || 0
                            const catKey2 = herd.categoria as string
                            const factor2 = CATEGORIA_DEMAND_FACTOR[catKey2 as keyof typeof CATEGORIA_DEMAND_FACTOR] ?? 1.0
                            const evPerHead2 = peso > 0 ? (peso / 450) * factor2 : (Number(herd.total_ev) || 0) / Math.max(currentHeadCount, 1)
                            const ev = headCount > 0 ? headCount * evPerHead2 : 0
                            const active = monthPlansForHerd.length > 0 && herdActiveThisMonth""",
    1
)

# ─── 6. Subtotal row before "Sumar" button ────────────────────────────────
OLD_SUMAR = """                    <div className="flex border-t border-dashed border-gray-200 bg-white hover:bg-green-50/40 transition-colors group" style={{ minHeight: 28 }}>
                      <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="pl-4 pr-2.5 flex items-center border-r border-gray-200 shrink-0">
                        <button
                          onClick={() => onAddHerd?.()}
                          className="text-[8px] font-bold text-green-600 group-hover:text-green-700 flex items-center gap-1"
                        >
                          <span className="text-sm leading-none">+</span> Sumar rodeo o animales temporarios
                        </button>
                      </div>
                      <div className="flex-1 relative" />
                    </div>

                    {/* Totals row */}
                    <div className="flex border-t border-gray-300 bg-gray-100" style={{ minHeight: 22 }}>"""

NEW_SUMAR = """                    {/* Total row — sum of ALL herds active this month */}
                    <div className="flex border-t border-gray-300 bg-gray-100" style={{ minHeight: 24 }}>
                      <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="px-2.5 flex items-center border-r border-gray-300 shrink-0">
                        <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Total</span>
                      </div>
                      <div className="flex-1 relative">
                        {MONTHS_FOOTER.map(m => {
                          let totalCabMes = 0
                          let totalEvMes = 0
                          activeHerdsInWindow.forEach(h => {
                            const hEntry = h.admission_date || '2000-01-01'
                            const hExit = h.exit_date || '2100-01-01'
                            if (hEntry <= m.endDate && hExit >= m.startDate) {
                              const hc = getDynamicHeadcount(h.id, Number(h.head_count) || 0, m.startDate)
                              const p = Number(h.avg_weight_kg) || 0
                              const cat = h.categoria as string
                              const fac = CATEGORIA_DEMAND_FACTOR[cat as keyof typeof CATEGORIA_DEMAND_FACTOR] ?? 1.0
                              const evPH = p > 0 ? (p / 450) * fac : (Number(h.total_ev) || 0) / Math.max(Number(h.head_count) || 1, 1)
                              totalCabMes += hc
                              totalEvMes += hc * evPH
                            }
                          })
                          return (
                            <div
                              key={m.key}
                              className="absolute inset-y-0 border-r border-gray-300 flex items-center justify-around px-0.5 overflow-hidden"
                              style={{ left: `${m.leftPct}%`, width: `${m.widthPct}%` }}
                            >
                              {totalCabMes > 0 ? (
                                <>
                                  <span className="text-[8px] font-black text-gray-800 flex-[2] text-center truncate">{totalCabMes}</span>
                                  <span className="text-[8px] font-bold text-gray-400 flex-1 text-center truncate">—</span>
                                  <span className="text-[8px] font-bold text-gray-400 flex-1 text-center truncate">—</span>
                                  <span className="text-[8px] font-black text-green-700 flex-1 text-center truncate">{totalEvMes.toFixed(0)}</span>
                                </>
                              ) : (
                                <span className="text-[8px] text-gray-200 w-full text-center truncate">—</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Split button: + Rodeo | + Temporario */}
                    <div className="flex border-t border-dashed border-green-200 bg-green-50/20" style={{ minHeight: 30 }}>
                      <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="pl-4 pr-2 flex items-center border-r border-green-200 shrink-0 gap-1.5">
                        <button
                          onClick={() => onAddHerd?.('permanente')}
                          className="text-[8px] font-bold text-green-700 flex items-center gap-0.5 hover:text-green-900 transition-colors"
                        >
                          <span className="text-xs leading-none">+</span> Rodeo
                        </button>
                        <span className="text-gray-300 text-[10px]">|</span>
                        <button
                          onClick={() => onAddHerd?.('temporal')}
                          className="text-[8px] font-bold text-sky-600 flex items-center gap-0.5 hover:text-sky-800 transition-colors"
                        >
                          <span className="text-xs leading-none">+</span> Temporario
                        </button>
                      </div>
                      <div className="flex-1 relative" />
                    </div>

                    {/* OLD Total row placeholder — REMOVED, now above */}
                    <div className="flex border-t border-gray-300 bg-gray-100 hidden" style={{ minHeight: 22 }}>"""

content = content.replace(OLD_SUMAR, NEW_SUMAR, 1)

# ─── 7. Fix PERIODS to support season lengths ─────────────────────────────
content = content.replace(
    "  const PERIODS = { trimestral: 84, semestral: 180, anual: 365 }\n  const WINDOW_DAYS = PERIODS[ganttPeriod]",
    "  const PERIODS: Record<string, number> = { trimestral: 84, semestral: 180, anual: 365, cerrada: 213, abierta: 212 }\n  const WINDOW_DAYS = PERIODS[ganttPeriod] ?? 365",
    1
)

# ─── 8. Fix season window dates ────────────────────────────────────────────
content = content.replace(
    """      if (seasonalFilters[0] === 'abierta') {
        const oct = new Date(year, 9, 1)
        setGanttWindow(oct.toISOString().split('T')[0])
        setGanttPeriod('semestral')
      } else if (seasonalFilters[0] === 'cerrada') {
        const mar = new Date(year, 2, 1)
        setGanttWindow(mar.toISOString().split('T')[0])
        setGanttPeriod('semestral')
      }
    } else if (seasonalFilters.length === 2) {
      // ANUAL: compute real span from all plans
      const allDates = plans.flatMap(p => [p.entry_date, p.exit_date].filter(Boolean)) as string[]
      if (allDates.length >= 2) {
        const minDate = allDates.reduce((a, b) => (a < b ? a : b))
        const maxDate = allDates.reduce((a, b) => (a > b ? a : b))
        const spanDays = daysBetween(minDate, maxDate) + 14  // 2-week padding
        // Start window 1 week before first plan
        const startD = new Date(minDate + 'T00:00:00')
        startD.setDate(startD.getDate() - 7)
        setGanttWindow(startD.toISOString().split('T')[0])
        // Pick the best period bucket that covers the full span
        if (spanDays <= 84)        setGanttPeriod('trimestral')
        else if (spanDays <= 180)  setGanttPeriod('semestral')
        else                       setGanttPeriod('anual')
      } else {
        // No plans yet — show current year from Jan
        setGanttWindow(`${year}-01-01`)
        setGanttPeriod('anual')
      }
    }""",
    """      if (seasonalFilters[0] === 'abierta') {
        // Temporada abierta: 1 Oct → 30 Abr año siguiente (~212 días)
        setGanttWindow(`${year}-10-01`)
        setGanttPeriod('abierta')
      } else if (seasonalFilters[0] === 'cerrada') {
        // Temporada cerrada: 1 Abr → 31 Oct (~213 días)
        setGanttWindow(`${year}-04-01`)
        setGanttPeriod('cerrada')
      }
    } else if (seasonalFilters.length === 2) {
      // Anual: 1 Abr → 30 Abr año siguiente (365+ días)
      setGanttWindow(`${year}-04-01`)
      setGanttPeriod('anual')
    }""",
    1
)

# ─── 9. Add editingGanttHerd state + update addHerd modal wiring ──────────
content = content.replace(
    "  const [showAddHerdModal, setShowAddHerdModal] = useState(false)",
    "  const [showAddHerdModal, setShowAddHerdModal] = useState(false)\n  const [editingGanttHerd, setEditingGanttHerd] = useState<HerdData | null>(null)",
    1
)

# ─── 10. Fix EV in add herd modal (/ 500 → (/ 450) * factor) ─────────────
content = content.replace(
    "const ev = heads > 0 && peso > 0 ? (heads * peso * factor / 500).toFixed(1) : '—'",
    "const ev = heads > 0 && peso > 0 ? (heads * (peso / 450) * factor).toFixed(1) : '—'",
    1
)
content = content.replace(
    "return heads > 0 && peso > 0 ? parseFloat((heads * peso * factor / 500).toFixed(2)) : null",
    "return heads > 0 && peso > 0 ? parseFloat((heads * (peso / 450) * factor).toFixed(2)) : null",
    1
)

# ─── 11. Wire onHerdClick + onAddHerd split in InteractiveGantt call ──────
content = content.replace(
    "            onAddHerd={() => setShowAddHerdModal(true)}",
    """            onAddHerd={(tipo) => {
              setAddHerdForm((f: any) => ({ ...f, is_temporary: tipo === 'temporal' }))
              setShowAddHerdModal(true)
            }}
            onHerdClick={(herd) => setEditingGanttHerd(herd as HerdData)}""",
    1
)

# ─── 12. Add HerdModal render for Gantt editing (before showAddHerdModal) ──
content = content.replace(
    "      {/* ── Modal: Sumar rodeo o animales temporarios ─────────────────── */}",
    """      {/* ── Modal: Editar rodeo desde Gantt ─────────────────────────── */}
      {editingGanttHerd && (
        <HerdModal
          herd={editingGanttHerd}
          allHerds={herds as HerdData[]}
          onClose={() => setEditingGanttHerd(null)}
          onSaved={async () => {
            setEditingGanttHerd(null)
            const hRes = await apiFetch('/api/herds')
            if (hRes.ok) {
              const hData = await hRes.json()
              setHerds(Array.isArray(hData) ? hData : hData.herds || [])
            }
          }}
        />
      )}

      {/* ── Modal: Sumar rodeo o animales temporarios ─────────────────── */}""",
    1
)

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. File size: {len(content)} bytes (was {original_len})")
print("Checks:")
print("  HerdModal import:", 'import HerdModal' in content)
print("  onHerdClick prop:", 'onHerdClick?: (herd: any) => void' in content)
print("  onHerdClick destructure:", 'onAddHerd, onHerdClick,' in content)
print("  herdActiveThisMonth:", 'herdActiveThisMonth' in content)
print("  EV formula fix:", '(peso / 450) * factor' in content)
print("  Season fix:", "setGanttPeriod('abierta')" in content)
print("  PERIODS cerrada:", "'cerrada': 213" in content)
print("  Total row:", 'Total row — sum of ALL herds active this month' in content)
print("  Split button:", 'Temporario' in content)
print("  editingGanttHerd state:", 'editingGanttHerd' in content)
