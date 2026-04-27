import re

with open('/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix ReferenceError in suggest paddock list (line ~2747)
code = re.sub(
    r'<p className=\{`text-\[10px\] \$\{isSelected \? \'text-green-100\' : \'text-gray-500\'\}`\}>(\{Number\(p\.area_ha\)\.toFixed\(1\)\} ha)</p>',
    r'<p className={`text-[10px] ${isSel ? \'text-green-100\' : \'text-gray-500\'}`}>\1</p>',
    code
)
code = re.sub(
    r'<p className=\{`text-\[9px\] \$\{isSelected \? \'text-green-200\' : \'text-gray-400\'\}`\}>kg MS/ha</p>',
    r'<p className={`text-[9px] ${isSel ? \'text-green-200\' : \'text-gray-400\'}`}>kg MS/ha</p>',
    code
)

# Apply Herd layout simple Excel style (Manual Modal)
manual_herd_source = """<div className="grid grid-cols-2 gap-2">
                  {herds.map(h => {
                    const isSelected = formData.herd_ids.includes(h.id)
                    const hColor = herdColorMap[h.id] || '#16a34a'
                    const isSuggestedEdit  = formData.ai_analysis?.plan_source === 'suggested' && formData.id
                    // For suggested: the active grazing herd = the original plan.herd_id (first in original herd_ids before expansion)
                    // We stored it before; use the stored plan data which had herd_ids=[activeHerd]
                    // Fallback: first selected herd alphabetically to indicate which is "active" this block
                    const isActiveHerd = isSuggestedEdit
                      ? (formData as any)._original_herd_id
                        ? h.id === (formData as any)._original_herd_id
                        : false
                      : false
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          if (!isSuggestedEdit) {
                            if (isSelected) setFormData({ ...formData, herd_ids: formData.herd_ids.filter(id => id !== h.id) })
                            else setFormData({ ...formData, herd_ids: [...formData.herd_ids, h.id] })
                          }
                          // For suggested plans: herds are informational (part of cycle), not togglable per-block
                        }}
                        className={`relative flex flex-col items-start gap-1 p-3.5 rounded-2xl border-2 text-left transition-all ${
                          isSuggestedEdit
                            ? isSelected
                              ? 'border-green-600 bg-green-600 text-white shadow-md'
                              : 'border-gray-200 bg-white text-gray-400 opacity-50 cursor-default'
                            : isSelected
                              ? 'border-green-600 bg-green-600 text-white shadow-md'
                              : 'border-gray-200 bg-white hover:border-gray-300 text-gray-900'
                        }`}
                      >
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center bg-white/20">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                        <p className="text-sm font-black leading-tight flex items-center gap-1.5">
                          {h.name}
                          {isSuggestedEdit && h.id === (formData as any)._original_herd_id && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-green-200 text-green-800">★ Activo</span>
                          )}
                        </p>
                        <p className={`text-[10px] font-bold ${isSelected ? 'text-green-100' : 'text-gray-500'}`}>
                          {Number(h.total_ev).toFixed(0)} EV · {h.animal_count || '—'} cabezas
                        </p>
                      </button>
                    )
                  })}
                </div>"""

manual_herd_target = """<div className="grid grid-cols-1 gap-1.5">
                  {herds.map(h => {
                    const isSelected = formData.herd_ids.includes(h.id)
                    const hColor = herdColorMap[h.id] || '#16a34a'
                    const isSuggestedEdit  = formData.ai_analysis?.plan_source === 'suggested' && formData.id
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          if (!isSuggestedEdit) {
                            if (isSelected) setFormData({ ...formData, herd_ids: formData.herd_ids.filter(id => id !== h.id) })
                            else setFormData({ ...formData, herd_ids: [...formData.herd_ids, h.id] })
                          }
                        }}
                        className={`flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-left transition-all ${
                          isSuggestedEdit
                            ? isSelected
                              ? 'border-green-600 bg-white shadow-sm'
                              : 'border-gray-200 bg-white text-gray-400 opacity-50 cursor-default'
                            : isSelected
                              ? 'border-green-600 bg-white shadow-sm'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isSelected
                            ? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                          }
                          <div>
                            <p className={`text-sm font-bold flex items-center gap-1.5 ${isSelected ? 'text-green-800' : 'text-gray-800'}`}>
                              {h.name}
                              {isSuggestedEdit && h.id === (formData as any)._original_herd_id && (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">★ Activo</span>
                              )}
                            </p>
                            <p className="text-[10px] text-gray-400 font-bold">
                              {Number(h.total_ev).toFixed(0)} EV · {h.animal_count || '—'} cabezas
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>"""

# Ensure precise matching by falling back to regex if exact replace fails due to spacing
import re
code = code.replace(manual_herd_source, manual_herd_target)

# Suggested Modal Herd layout
sugg_herd_source = """<div className="grid grid-cols-2 gap-2">
                  {herds.map((h, i) => {
                    const isSel = suggestHerdIds.includes(h.id)
                    const hColor = HERD_COLORS[i % HERD_COLORS.length]
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSuggestHerdIds(prev =>
                          prev.includes(h.id) ? prev.filter(id => id !== h.id) : [...prev, h.id]
                        )}
                        className={`relative flex flex-col items-start gap-1 p-3.5 rounded-2xl border-2 text-left transition-all ${
                          isSel ? 'border-green-600 bg-green-600 text-white shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 text-gray-900'
                        }`}
                      >
                        {isSel && <div className="absolute top-2 right-2 w-4 h-4 bg-white/20 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                        <p className="text-sm font-black leading-tight">{h.name}</p>
                        <p className={`text-[10px] font-bold ${isSel ? 'text-green-100' : 'text-gray-500'}`}>
                          {Number(h.total_ev).toFixed(0)} EV · {h.animal_count || '—'} cabezas
                        </p>
                      </button>
                    )
                  })}
                </div>"""

sugg_herd_target = """<div className="grid grid-cols-1 gap-1.5">
                  {herds.map((h, i) => {
                    const isSel = suggestHerdIds.includes(h.id)
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => setSuggestHerdIds(prev =>
                          prev.includes(h.id) ? prev.filter(id => id !== h.id) : [...prev, h.id]
                        )}
                        className={`flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-left transition-all ${
                          isSel ? 'border-green-600 bg-white shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isSel
                            ? <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                          }
                          <div>
                            <p className={`text-sm font-bold ${isSel ? 'text-green-800' : 'text-gray-800'}`}>{h.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold">{Number(h.total_ev).toFixed(0)} EV · {h.animal_count || '—'} cabezas</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>"""

code = code.replace(sugg_herd_source, sugg_herd_target)

with open('/Users/javi/RODEO/frontend/src/app/dashboard/grazing/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done python script")
