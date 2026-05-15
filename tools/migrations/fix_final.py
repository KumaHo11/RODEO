import re

# ── HerdModal fixes ────────────────────────────────────────────────────────────
with open('/Users/javi/RODEO/frontend/src/components/HerdModal.tsx', 'r') as f:
    hm = f.read()

# Baby/ShoppingCart icons - verify same approach
# Activities color neutral (already done), but check if sel state uses colors
# Remove any remaining colored activity backgrounds
hm = re.sub(r"sel \? `\$\{a\.bg\} \$\{a\.color\} \$\{a\.border\}`.*?'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'",
            "sel ? `bg-gray-900 border-gray-900 text-white shadow-md` : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'", hm)
hm = re.sub(r"sel \? a\.dot : 'bg-gray-300'", "sel ? 'bg-white' : 'bg-gray-300'", hm)

with open('/Users/javi/RODEO/frontend/src/components/HerdModal.tsx', 'w') as f:
    f.write(hm)


# ── page.tsx (Grazing Planner) fixes ──────────────────────────────────────────
with open('/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx', 'r') as f:
    page = f.read()

# 1. Fix check icon color inside green circle (selected cards all should have text-white checks)
page = page.replace(
    '<Check className="w-3 h-3 text-gray-900" />',
    '<Check className="w-3 h-3 text-white" />'
)
page = page.replace(
    '<Check className="w-2.5 h-2.5 text-gray-900" />',
    '<Check className="w-2.5 h-2.5 text-white" />'
)

# 2. Top bar buttons: view mode tabs bg-green-600 text-gray-900 → text-white
page = page.replace(
    "viewMode === id ? 'bg-green-600 text-gray-900 shadow-sm'",
    "viewMode === id ? 'bg-green-600 text-white shadow-sm'"
)
# Nueva planificación button
page = page.replace(
    '"flex items-center gap-2 px-4 py-2.5 bg-green-600 text-gray-900 hover:bg-green-700 font-bold text-sm disabled:opacity-50 transition-all"',
    '"flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white hover:bg-green-700 font-bold text-sm disabled:opacity-50 transition-all"'
)
page = page.replace(
    '"flex items-center px-2.5 bg-green-600 text-gray-900 hover:bg-green-700 disabled:opacity-50 transition-all"',
    '"flex items-center px-2.5 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-all"'
)

# 3. Crear planificación / Save changes footer button
page = page.replace(
    '"flex-1 py-3 bg-green-600 text-gray-900 rounded-xl hover:bg-green-700 font-black text-sm shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 disabled:opacity-40"',
    '"flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-black text-sm shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 disabled:opacity-40"'
)

# 4. HOY badge in gantt
page = page.replace(
    'bg-green-600 text-gray-900 text-[8px] font-black px-1.5 py-0.5 rounded-full select-none uppercase tracking-tighter shadow-sm shadow-green-300',
    'bg-green-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full select-none uppercase tracking-tighter shadow-sm shadow-green-300'
)

# 5. Cycle banner selected paddock
page = page.replace(
    "'bg-green-600 text-white border-green-600'",
    "'bg-green-600 text-white border-green-600'"  # already ok
)

# 6. Sugerida / suggested edit herd border only, no full fill → keep light bg
# Herds in manual modal: border-only selection
page = page.replace(
    "isSelected\n                              ? 'border-green-600 bg-green-600 text-white shadow-md'\n                              : 'border-gray-200 bg-white hover:border-gray-300'",
    "isSelected\n                              ? 'border-green-600 bg-white shadow-sm'\n                              : 'border-gray-200 bg-white hover:border-gray-300'"
)
# And fix text color of name/subtext inside manually-selected herds (now bg-white, so text stays dark)
page = page.replace(
    '`text-sm font-bold flex items-center gap-1.5 ${isSelected ? \'text-green-800\' : \'text-gray-800\'}`',
    '`text-sm font-bold flex items-center gap-1.5 ${isSelected ? \'text-green-700\' : \'text-gray-800\'}`'
)
# Check circle fill becomes green border only when selected (no fill)
page = page.replace(
    """                          {isSelected
                            ? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                          }""",
    """                          {isSelected
                            ? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                          }"""
)

# 7. "Ninguno" links in suggest panel - neutral gray instead of red-400
page = page.replace(
    'className="text-[9px] font-black text-red-400 hover:underline">Ninguno</button>',
    'className="text-[9px] font-black text-gray-400 hover:underline">Ninguno</button>'
)

# 8. Remove amber inline data button color
page = page.replace(
    'className="px-4 py-2 bg-amber-500 text-gray-900 rounded-xl text-xs font-black hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1"',
    'className="px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-black hover:bg-gray-900 disabled:opacity-50 flex items-center gap-1"'
)

# 9. Deviation badge (tardío/antes) on real dates
page = page.replace(
    "formData.actual_entry_date > formData.entry_date ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-700'",
    "formData.actual_entry_date > formData.entry_date ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700'"
)

# 10. Deviation comparison widget (plan vs real days)
page = page.replace(
    "`text-2xl font-black ${dev > 0 ? 'text-red-500' : dev < 0 ? 'text-blue-500' : 'text-gray-400'}`",
    "`text-2xl font-black ${dev > 0 ? 'text-gray-700' : dev < 0 ? 'text-green-600' : 'text-gray-400'}`"
)
# Plan days still blue → gray
page = page.replace(
    '<p className="text-2xl font-black text-blue-600">{planD}<span className="text-xs text-gray-400 ml-0.5">d</span></p>',
    '<p className="text-2xl font-black text-gray-700">{planD}<span className="text-xs text-gray-400 ml-0.5">d</span></p>'
)

# 11. Orange "grazing now" dot in gantt sidebar
page = page.replace(
    "isGrazing ? 'bg-orange-400' : 'bg-green-400'",
    "isGrazing ? 'bg-green-600' : 'bg-gray-300'"
)

# 12. Orange warning banner for stale data / orange-50 border-orange-200
page = page.replace(
    'className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-gray-800 font-medium flex items-center gap-2"',
    'className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 font-medium flex items-center gap-2"'
)

# 13. Delete button (Trash) - keep subtle, just use gray not red
page = page.replace(
    '"p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"',
    '"p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"'
)

# 14. Remove remaining trash/delete link colors
page = page.replace(
    'className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0"',
    'className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors shrink-0"'
)

# 15. Suggested herd rows in suggest modal - keep border-only selection (no full green bg)
page = page.replace(
    "isSel ? 'border-green-600 bg-green-600 text-white shadow-md' : 'border-gray-100 bg-white hover:border-gray-200'",
    "isSel ? 'border-green-600 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'"
)
# Fix absolute check circle inside suggest herd card (now bg-white so need colored circle)
page = page.replace(
    '{isSel && <div className="absolute top-2 right-2 w-4 h-4 bg-green-600 rounded-full flex items-center justify-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}',
    '{isSel && <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>}'
)
# Text colors for suggested herds (now bg-white, so dark text)
page = page.replace(
    '`text-sm font-bold ${isSel ? \'text-white\' : \'text-gray-900\'}`>{h.name}',
    '`text-sm font-bold ${isSel ? \'text-green-800\' : \'text-gray-800\'}`>{h.name}'
)
page = page.replace(
    "`text-[10px] text-gray-400 font-bold`>{Number(h.total_ev).toFixed(0)} EV · {h.animal_count || '—'} cabezas",
    "`text-[10px] text-gray-400 font-bold`>{Number(h.total_ev).toFixed(0)} EV · {h.animal_count || '—'} cabezas"
)

# 16. Suggest paddock list text same treatment (bg-white selected)
page = page.replace(
    "isSel ? 'border-green-600 bg-green-600 text-white shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-900'",
    "isSel ? 'border-green-600 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'"
)
page = page.replace(
    "`text-sm font-bold ${isSel ? 'text-white' : 'text-gray-900'}`>{p.name}",
    "`text-sm font-bold ${isSel ? 'text-green-800' : 'text-gray-900'}`>{p.name}"
)
# Fix suggest paddock check circle
page = page.replace(
    '? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>\n                            : <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />',
    '? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>\n                            : <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />'
)
page = page.replace(
    "`text-sm font-black ${isSel ? 'text-white' : 'text-green-700'}`>{p.dry_matter_kg_ha || 0}",
    "`text-sm font-black ${isSel ? 'text-green-700' : 'text-green-700'}`>{p.dry_matter_kg_ha || 0}"
)
page = page.replace(
    "`text-[9px] ${isSel ? 'text-green-200' : 'text-gray-400'}`>kg MS/ha",
    "`text-[9px] text-gray-400`>kg MS/ha"
)
page = page.replace(
    "`text-[10px] ${isSel ? 'text-green-100' : 'text-gray-500'}`>{Number(p.area_ha).toFixed(1)} ha",
    "`text-[10px] text-gray-400`>{Number(p.area_ha).toFixed(1)} ha"
)

with open('/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx', 'w') as f:
    f.write(page)

print("Done page.tsx")


# ── PaddockModal: Calidad Relativa 1-5 stars → neutralize colors + remove ★ ──
with open('/Users/javi/RODEO/frontend/src/app/dashboard/mi-campo/components/PaddockModal.tsx', 'r') as f:
    pm = f.read()

# Replace the colored star buttons with neutral gray scale buttons
old_quality = """                  {[
                    { val: 1, label: 'Muy baja', color: 'bg-red-100 text-red-700 border-red-200' },
                    { val: 2, label: 'Baja',     color: 'bg-orange-100 text-orange-700 border-orange-200' },
                    { val: 3, label: 'Media',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                    { val: 4, label: 'Alta',     color: 'bg-lime-100 text-lime-700 border-lime-200' },
                    { val: 5, label: 'Excelente',color: 'bg-green-100 text-green-700 border-green-200' },
                  ].map(q => (
                    <button
                      key={q.val}
                      type="button"
                      onClick={() => setRelativeQuality(relativeQuality === q.val ? 0 : q.val)}
                      className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 text-center transition-all ${
                        relativeQuality === q.val
                          ? `${q.color} border-current shadow-sm`
                          : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                      }`}
                    >
                      <span className="text-lg font-black leading-none">★{q.val}</span>
                      <span className="text-[8px] font-bold leading-tight">{q.label}</span>
                    </button>
                  ))}"""

new_quality = """                  {[
                    { val: 1, label: 'Muy baja' },
                    { val: 2, label: 'Baja' },
                    { val: 3, label: 'Media' },
                    { val: 4, label: 'Alta' },
                    { val: 5, label: 'Excelente' },
                  ].map(q => (
                    <button
                      key={q.val}
                      type="button"
                      onClick={() => setRelativeQuality(relativeQuality === q.val ? 0 : q.val)}
                      className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 text-center transition-all ${
                        relativeQuality === q.val
                          ? 'border-green-600 bg-white text-green-800 shadow-sm'
                          : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-base font-black leading-none">{q.val}</span>
                      <span className="text-[8px] font-bold leading-tight">{q.label}</span>
                    </button>
                  ))}"""

pm = pm.replace(old_quality, new_quality)

# Fix amber text hint below quality buttons
pm = pm.replace(
    '<p className="text-[10px] text-amber-700 font-bold">',
    '<p className="text-[10px] text-gray-500 font-bold">'
)

with open('/Users/javi/RODEO/frontend/src/app/dashboard/mi-campo/components/PaddockModal.tsx', 'w') as f:
    f.write(pm)

print("Done PaddockModal")

# Re-open and fix remaining items
with open('/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx', 'r') as f:
    page = f.read()

# cycle badge selected paddock (line 2056)
page = page.replace(
    "'bg-green-600 text-gray-900 border-green-600'",
    "'bg-green-600 text-white border-green-600'"
)

# Potrero in manual modal still has bg-green-600 fill → change to border only
page = page.replace(
    "isSelected ? 'border-green-600 bg-green-600 text-white shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-900'",
    "isSelected ? 'border-green-600 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'"
)
page = page.replace(
    "`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`>{p.name}",
    "`text-sm font-bold ${isSelected ? 'text-green-800' : 'text-gray-900'}`>{p.name}"
)
page = page.replace(
    "`text-sm font-black ${isSelected ? 'text-white' : 'text-green-700'}`>{p.dry_matter_kg_ha || 0}",
    "`text-sm font-black text-green-700`>{p.dry_matter_kg_ha || 0}"
)
# Check inside potrero manual (bg-white now, use colored circle)
page = page.replace(
    '<div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center justify-center shrink-0"><Check className="w-3 h-3 text-white" /></div>',
    '<div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" /></div>'
)

# Suggest paddock (line 2746) text-white still present
page = page.replace(
    "`text-sm font-bold ${isSel ? 'text-white' : 'text-gray-900'}`>{p.name}",
    "`text-sm font-bold ${isSel ? 'text-green-800' : 'text-gray-900'}`>{p.name}"
)
page = page.replace(
    "`text-sm font-black ${isSel ? 'text-white' : 'text-green-700'}`>{p.dry_matter_kg_ha || 0}",
    "`text-sm font-black text-green-700`>{p.dry_matter_kg_ha || 0}"
)

# bg-orange-100 in real dates deviation badge
page = page.replace(
    "formData.actual_entry_date > formData.entry_date ? 'bg-orange-100 text-gray-600' : 'bg-green-100 text-green-700'",
    "formData.actual_entry_date > formData.entry_date ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700'"
)

# bg-amber-50 in extra animal date fields
page = page.replace(
    'className="flex-1 bg-amber-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-green-500"',
    'className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-green-500"'
)
page = page.replace(
    'return <span className="text-[9px] font-black text-gray-700 bg-amber-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">',
    'return <span className="text-[9px] font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">'
)

# daysDev in list view
page = page.replace(
    "daysDev > 0 ? 'text-red-600' : 'text-blue-600'",
    "daysDev > 0 ? 'text-gray-700' : 'text-green-700'"
)

with open('/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx', 'w') as f:
    f.write(page)
print("Done final pass")
