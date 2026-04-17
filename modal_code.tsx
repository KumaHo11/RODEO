      {/* ─── MODAL: Vista única — diseño unificado ─────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* ─── MODAL HEADER ─── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shrink-0">
              <div>
                {/* Title: distinguish suggested vs manual */}
                <div className="flex items-center gap-2">
                  {formData.id && formData.ai_analysis?.plan_source === 'suggested' && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200 uppercase tracking-widest">⚡ Sugerida</span>
                  )}
                  {formData.id && formData.ai_analysis?.plan_source === 'manual' && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 uppercase tracking-widest">✏ Manual</span>
                  )}
                  <h3 className="text-xl font-black text-gray-950 tracking-tight">
                    {formData.id ? 'Editar movimiento' : 'Nueva planificación'}
                  </h3>
                </div>
                <p className="text-xs text-gray-400 font-medium mt-0.5">
                  {(() => {
                    const isSuggested = formData.ai_analysis?.plan_source === 'suggested'
                    const cycleAllPaddockIds = formData.ai_analysis?.cycle_all_paddock_ids as string[] | undefined
                    const paddockName = paddocks.find(p => p.id === formData.paddock_id)?.name
                    if (isSuggested && cycleAllPaddockIds && cycleAllPaddockIds.length > 0) {
                      const nPaddocks = cycleAllPaddockIds.length
                      const nHerds   = (formData.ai_analysis?.cycle_all_herd_ids as string[] | undefined)?.length || formData.herd_ids.length
                      return `Ciclo ${nPaddocks}P × ${nHerds}R · Bloque en ${paddockName} · ${totalPlanEV.toFixed(0)} EV`
                    }
                    if (formData.paddock_id && formData.herd_ids.length > 0) {
                      return `${paddockName} · ${formData.herd_ids.length} rebaño${formData.herd_ids.length > 1 ? 's' : ''} · ${totalPlanEV > 0 ? `${totalPlanEV.toFixed(0)} EV total` : ''}`
                    }
                    return 'Elegí los rebaños y el potrero de destino'
                  })()}
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>


            {/* ─── MODAL BODY ─── */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* Cycle info banner — only for suggested plans */}
              {formData.id && formData.ai_analysis?.plan_source === 'suggested' && formData.ai_analysis?.cycle_id && (() => {
                const cycleAllPaddockIds = formData.ai_analysis.cycle_all_paddock_ids as string[] | undefined || []
                const cycleAllHerdIds    = formData.ai_analysis.cycle_all_herd_ids    as string[] | undefined || []
                const cyclePaddocks = paddocks.filter(p => cycleAllPaddockIds.includes(p.id))
                const cycleHerds   = herds.filter(h => cycleAllHerdIds.includes(h.id))
                return (
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-violet-600 shrink-0" />
                      <p className="text-xs font-black text-violet-800 uppercase tracking-wider">
                        Ciclo Sugerido — {cyclePaddocks.length} Potreros × {cycleHerds.length} Rebaños
                      </p>
                    </div>
                    {/* Paddocks in cycle */}
                    {cyclePaddocks.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-violet-500 tracking-widest uppercase mb-1.5">Potreros en la rotación</p>
                        <div className="flex flex-wrap gap-1.5">
                          {cyclePaddocks.map(p => (
                            <span
                              key={p.id}
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                                p.id === formData.paddock_id
                                  ? 'bg-violet-600 text-white border-violet-600'
                                  : 'bg-white text-violet-700 border-violet-300'
                              }`}
                            >
                              {p.id === formData.paddock_id ? '✓ ' : ''}{p.name}
                              <span className={`text-[8px] ${p.id === formData.paddock_id ? 'text-violet-200' : 'text-violet-400'}`}>
                                {Number(p.area_ha).toFixed(0)}ha
                              </span>
                              {p.technical_data?.relative_quality && (
                                <span className={`text-[8px] font-black ${p.id === formData.paddock_id ? 'text-amber-300' : 'text-amber-600'}`}>
                                  ★{p.technical_data.relative_quality}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Herds in cycle */}
                    {cycleHerds.length > 0 && (
                      <div>
                        <p className="text-[9px] font-black text-violet-500 tracking-widest uppercase mb-1.5">Rebaños en la rotación</p>
                        <div className="flex flex-wrap gap-1.5">
                          {cycleHerds.map(h => (
                            <span
                              key={h.id}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white text-violet-700 border border-violet-300"
                            >
                              {h.name} · {Number(h.total_ev).toFixed(0)} EV
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[9px] text-violet-500 font-medium">
                      Este bloque corresponde a un giro del ciclo. Editando las fechas sólo afectars este movimiento.
                    </p>
                  </div>
                )
              })()}

              {/* ① REBAÑOS — lo más importante primero, tarjetas grandes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-gray-700 tracking-wide">
                    {formData.ai_analysis?.plan_source === 'suggested' && formData.id
                      ? 'Rebaños del ciclo (este bloque usa el rebaño activo)'
                      : '¿Qué rebaños van a moverse?'
                    }
                  </label>

                  {formData.herd_ids.length > 0 && (
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                      {formData.herd_ids.length} seleccionado{formData.herd_ids.length > 1 ? 's' : ''} · {totalPlanEV.toFixed(0)} EV
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
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
                              ? 'border-violet-400 bg-violet-900 text-white shadow-lg shadow-violet-900/20'
                              : 'border-gray-100 bg-white text-gray-400 opacity-50 cursor-default'
                            : isSelected
                              ? 'border-gray-900 bg-gray-900 text-white shadow-lg shadow-gray-900/20'
                              : 'border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {isSelected && (
                          <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${isSuggestedEdit ? 'bg-violet-500/30' : 'bg-white/20'}`}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="w-8 h-2 rounded-full" style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.4)' : hColor }} />
                        <p className="text-sm font-black leading-tight flex items-center gap-1.5">
                          {h.name}
                          {isSuggestedEdit && h.id === (formData as any)._original_herd_id && (
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-900">★ Activo</span>
                          )}
                        </p>
                        <p className={`text-xs font-bold ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                          {Number(h.total_ev).toFixed(0)} EV · {h.animal_count || '—'} cabezas
                        </p>
                      </button>
                    )
                  })}
                </div>


                {formData.herd_ids.length === 0 && (

                  <p className="text-[10px] text-amber-600 font-bold text-center py-1">👆 Seleccioná al menos un rebaño para continuar</p>
                )}

                {/* Animales Extra */}
                <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Inclusión de Animales Extra (Opcional)</label>
                    <button
                      type="button"
                      onClick={() => setTempAnimals([...tempAnimals, { species: 'Toros', count: 1, weight_kg: 450, entry_date: formData.entry_date || '', exit_date: formData.exit_date || '' }])}
                      className="text-[10px] font-black text-green-600 flex items-center gap-1 hover:underline px-2 py-1 bg-green-50 rounded-lg"
                    >
                      <Plus className="w-3 h-3" /> Agregar grupo extra
                    </button>
                  </div>
                  <div className="space-y-2">
                    {tempAnimals.map((ta, idx) => (
                      <div key={idx} className="flex flex-col gap-1.5 bg-gray-50 p-2.5 rounded-xl border border-gray-100 shadow-sm">
                        {/* Fila 1: Especie + Cantidad + Peso */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={ta.species}
                            onChange={e => { const nm = [...tempAnimals]; nm[idx].species = e.target.value; setTempAnimals(nm) }}
                            placeholder="Ej: Toros"
                            className="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                          <input
                            type="number"
                            min="1"
                            value={ta.count}
                            onChange={e => { const nm = [...tempAnimals]; nm[idx].count = Number(e.target.value); setTempAnimals(nm) }}
                            placeholder="Cant."
                            className="w-16 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 w-24">
                            <input
                              type="number"
                              min="0"
                              value={ta.weight_kg}
                              onChange={e => { const nm = [...tempAnimals]; nm[idx].weight_kg = Number(e.target.value); setTempAnimals(nm) }}
                              className="w-full text-xs font-bold focus:outline-none text-right"
                            />
                            <span className="text-[10px] text-gray-400 font-bold shrink-0">kg</span>
                          </div>
                          <button type="button" onClick={() => setTempAnimals(tempAnimals.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors shrink-0">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {/* Fila 2: Fechas de ingreso/egreso */}
                        <div className="flex items-center gap-2">
                          <label className="text-[9px] font-black text-amber-700 tracking-wider uppercase whitespace-nowrap">Ingreso</label>
                          <input
                            type="date"
                            value={ta.entry_date || ''}
                            onChange={e => { const nm = [...tempAnimals]; nm[idx].entry_date = e.target.value; setTempAnimals(nm) }}
                            className="flex-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          <label className="text-[9px] font-black text-amber-700 tracking-wider uppercase whitespace-nowrap">Egreso</label>
                          <input
                            type="date"
                            value={ta.exit_date || ''}
                            onChange={e => { const nm = [...tempAnimals]; nm[idx].exit_date = e.target.value; setTempAnimals(nm) }}
                            className="flex-1 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                          {/* EV ponderado preview */}
                          {ta.entry_date && ta.exit_date && formData.entry_date && formData.exit_date && (() => {
                            const planD = Math.max(1, Math.ceil((new Date(formData.exit_date).getTime() - new Date(formData.entry_date).getTime()) / 86400000))
                            const oS = ta.entry_date > formData.entry_date ? ta.entry_date : formData.entry_date
                            const oE = ta.exit_date  < formData.exit_date  ? ta.exit_date  : formData.exit_date
                            const oD = Math.max(0, Math.ceil((new Date(oE).getTime() - new Date(oS).getTime()) / 86400000))
                            const ev = ((ta.count * ta.weight_kg) / 450) * (oD / planD)
                            return <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">{ev.toFixed(1)} EV</span>
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Live cascade impact preview (for suggested cycle plans with extra animals) ── */}
                {formData.ai_analysis?.plan_source === 'suggested' && formData.ai_analysis?.cycle_id && tempAnimals.length > 0 && formData.paddock_id && formData.entry_date && formData.exit_date && (() => {
                  const cycleId = formData.ai_analysis.cycle_id as string
                  const paddock = paddocks.find(p => p.id === formData.paddock_id)
                  if (!paddock) return null
                  const area     = Number(paddock.area_ha) || 0
                  const ms       = Number(paddock.dry_matter_kg_ha) || 1800
                  const remnant  = 1100
                  const usableMs = Math.max(0, (ms - remnant) * area)
                  // Base EV from this block's original herd
                  const origHerdId = (formData as any)._original_herd_id || formData.herd_ids[0]
                  const baseHerd = herds.find(h => h.id === origHerdId)
                  const baseEV = baseHerd ? Number(baseHerd.total_ev || 0) : 0
                  // Extra EV weighted
                  const planEntry = new Date(formData.entry_date + 'T00:00:00')
                  const planExit  = new Date(formData.exit_date  + 'T00:00:00')
                  const planDays  = Math.max(1, Math.round((planExit.getTime() - planEntry.getTime()) / 86400000))
                  const extraEV = tempAnimals.reduce((sum, a) => {
                    const evRaw = (a.count * a.weight_kg) / 450
                    if (a.entry_date && a.exit_date) {
                      const aE = new Date(a.entry_date + 'T00:00:00'), aX = new Date(a.exit_date + 'T00:00:00')
                      const oS = aE > planEntry ? aE : planEntry, oE = aX < planExit ? aX : planExit
                      const oD = Math.max(0, Math.round((oE.getTime() - oS.getTime()) / 86400000))
                      return sum + evRaw * (oD / planDays)
                    }
                    return sum + evRaw
                  }, 0)
                  const newTotalEV     = baseEV + extraEV
                  const dailyDemandNew = newTotalEV * 11
                  const newDays        = dailyDemandNew > 0 ? Math.max(1, Math.floor(usableMs / dailyDemandNew)) : planDays
                  const deltaDays      = newDays - planDays // negative = fewer days
                  const siblingsCount  = plans.filter(p => p.ai_analysis?.cycle_id === cycleId && p.entry_date > formData.entry_date).length
                  const extraAnimalEndDate = tempAnimals.reduce((latest, a) => a.exit_date && a.exit_date > latest ? a.exit_date : latest, formData.exit_date)
                  const isMultiMonth = extraAnimalEndDate > formData.exit_date
                  if (Math.abs(deltaDays) === 0) return null
                  return (
                    <div className={`mt-2 p-3 rounded-xl border flex items-start gap-2.5 ${deltaDays < 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${deltaDays < 0 ? 'text-orange-500' : 'text-green-500'}`} />
                      <div>
                        <p className={`text-xs font-black ${deltaDays < 0 ? 'text-orange-800' : 'text-green-800'}`}>
                          {deltaDays < 0
                            ? `⚠ Días reducidos: ${planDays}d → ${newDays}d (${Math.abs(deltaDays)}d menos por mayor demanda EV)`
                            : `↑ Días ampliados: ${planDays}d → ${newDays}d (+${deltaDays}d)`
                          }
                        </p>
                        <p className={`text-[10px] font-medium mt-0.5 ${deltaDays < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {siblingsCount > 0
                            ? `Se correrán automáticamente ${siblingsCount} bloque${siblingsCount > 1 ? 's' : ''} siguiente${siblingsCount > 1 ? 's' : ''} del ciclo.`
                            : 'No hay bloques siguientes en este ciclo.'
                          }
                          {isMultiMonth && ' Los animales extra afectarán también los bloques que se solapan.'}
                        </p>
                      </div>
                    </div>
                  )
                })()}

              </div>

              {/* ② POTRERO DESTINO */}
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 tracking-wide">¿A qué potrero van?</label>
                {paddocks.length <= 6 ? (
                  <div className="grid grid-cols-1 gap-1.5">
                    {paddocks.map(p => {
                      const isSelected = formData.paddock_id === p.id
                      const dmColor = (p.dry_matter_kg_ha || 0) >= 1500 ? 'text-green-600' : (p.dry_matter_kg_ha || 0) >= 800 ? 'text-amber-600' : 'text-red-500'
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, paddock_id: p.id })}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                            isSelected ? 'border-green-600 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {isSelected
                              ? <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-3 h-3 text-white" /></div>
                              : <div className="w-5 h-5 rounded-full border-2 border-gray-200 shrink-0" />
                            }
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className={`text-sm font-bold ${isSelected ? 'text-green-900' : 'text-gray-900'}`}>{p.name}</p>
                                {p.technical_data?.relative_quality && (
                                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800"
                                    title="Calidad Relativa del potrero">
                                    ★{p.technical_data.relative_quality}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400">{Number(p.area_ha).toFixed(1)} ha</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-black ${dmColor}`}>{p.dry_matter_kg_ha || 0}</p>
                            <p className="text-[9px] text-gray-400 font-bold">kg MS/ha</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <select
                    value={formData.paddock_id}
                    onChange={e => setFormData({ ...formData, paddock_id: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 outline-none focus:ring-1 focus:ring-green-600"
                  >
                    <option value="">Seleccionar potrero...</option>
                    {paddocks.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {Number(p.area_ha).toFixed(1)} ha · {p.dry_matter_kg_ha || 0} kg MS/ha</option>
                    ))}
                  </select>
                )}
              </div>

              {/* ③ SUGERENCIA HOLÍSTICA — aparece cuando hay potrero + rebaños */}
              {formData.paddock_id && totalPlanEV > 0 && suggestion.days > 0 && (() => {
                const sugDays = Math.min(suggestion.days, 14)
                return (
                  <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-4 text-white shadow-lg shadow-indigo-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-indigo-200" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Motor holístico</p>
                      {/* Carga Animal chip */}
                      {selectedPaddock && totalPlanEV > 0 && (() => {
                        const ca = totalPlanEV / Math.max(0.1, Number(selectedPaddock.area_ha || 1))
                        const caColor = ca < 3 ? '#4ade80' : ca < 5 ? '#fbbf24' : '#f87171'
                        return (
                          <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full border" style={{ backgroundColor: `${caColor}22`, borderColor: caColor, color: caColor }}>
                            🐄 {ca.toFixed(1)} EV/ha
                          </span>
                        )
                      })()}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-white/15 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider mb-0.5">Estadía</p>
                        <p className={`text-2xl font-black ${sugDays >= 14 ? 'text-amber-300' : 'text-white'}`}>{sugDays}<span className="text-xs ml-0.5 text-indigo-200">d</span></p>
                        {sugDays >= 14 && <p className="text-[8px] text-amber-300 font-bold">límite holístico</p>}
                      </div>
                      <div className="bg-white/15 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider mb-0.5">Descanso</p>
                        <p className="text-2xl font-black text-white">{suggestion.recovery}<span className="text-xs ml-0.5 text-indigo-200">d</span></p>
                      </div>
                      <div className="bg-white/15 rounded-xl p-2.5 text-center">
                        <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-wider mb-0.5">MS útil</p>
                        <p className="text-lg font-black text-white">{Math.round(suggestion.usableMsTotal / 1000).toFixed(1)}<span className="text-xs ml-0.5 text-indigo-200">t</span></p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!formData.entry_date}
                      onClick={() => {
                        if (!formData.entry_date) return
                        setFormData(prev => ({
                          ...prev,
                          exit_date: addDays(prev.entry_date, sugDays),
                          planned_recovery_days: suggestion.recovery
                        }))
                      }}
                      className="w-full py-2 bg-white text-indigo-700 rounded-xl text-xs font-black hover:bg-indigo-50 transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Aplicar sugerencia al plan
                    </button>
                  </div>
                )
              })()}

              {/* ④ PLAN: Fechas planificadas */}
              <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/40 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-100/60 border-b border-blue-100">
                  <div className="w-4 h-4 border-2 border-blue-500 rounded-sm" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(59,130,246,0.35) 2px, rgba(59,130,246,0.35) 4px)' }} />
                  <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Plan — lo que proyectás</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-blue-600 tracking-widest uppercase">Entrada plan</label>
                      <input
                        type="date"
                        value={formData.entry_date}
                        onChange={e => setFormData({ ...formData, entry_date: e.target.value })}
                        className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-1 focus:ring-blue-500 outline-none text-gray-900"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-blue-600 tracking-widest uppercase flex items-center gap-1">
                        Salida plan
                        {formData.exit_date && formData.entry_date && (
                          <span className={`normal-case font-black ml-1 text-xs px-1.5 py-0.5 rounded-full ${
                            daysBetween(formData.entry_date, formData.exit_date) > 14
                              ? 'bg-red-100 text-red-600'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {daysBetween(formData.entry_date, formData.exit_date)}d
                          </span>
                        )}
                      </label>
                      <input
                        type="date"
                        value={formData.exit_date}
                        onChange={e => setFormData({ ...formData, exit_date: e.target.value })}
                        className={`w-full bg-white border-2 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-1 outline-none text-gray-900 ${
                          formData.exit_date && daysBetween(formData.entry_date, formData.exit_date) > 14
                            ? 'border-red-300 focus:ring-red-400'
                            : 'border-blue-200 focus:ring-blue-500'
                        }`}
                      />
                    </div>
                  </div>
                  {formData.exit_date && daysBetween(formData.entry_date, formData.exit_date) > 14 && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <p className="text-[11px] text-red-600 font-bold">Supera el límite holístico de 14 días. Considerá dividir el lote.</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-[9px] font-black text-blue-600 tracking-widest uppercase whitespace-nowrap">Descanso del potrero</label>
                    <div className="flex items-center gap-2 bg-white border border-blue-200 rounded-xl px-3 py-2 flex-1">
                      <input
                        type="number" min={1} max={365}
                        value={formData.planned_recovery_days}
                        onChange={e => setFormData({ ...formData, planned_recovery_days: Number(e.target.value) })}
                        className="w-14 text-sm font-black text-blue-700 bg-transparent outline-none"
                      />
                      <span className="text-xs text-gray-400 font-bold">días</span>
                      {suggestion.recovery > 0 && formData.planned_recovery_days !== suggestion.recovery && (
                        <button
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, planned_recovery_days: suggestion.recovery }))}
                          className="ml-auto text-[9px] text-indigo-600 font-black hover:underline"
                        >
                          Usar sugerido ({suggestion.recovery}d)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* GAP: Dato desactualizado */}
                  {isStaleData && formData.paddock_id && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs font-black text-amber-800 flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" /> Dato de forraje desactualizado (+7 días)
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="kg MS/ha actual"
                          value={inlineDryMatter}
                          onChange={e => setInlineDryMatter(e.target.value)}
                          className="flex-1 bg-white border border-amber-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-amber-400 outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSaveInlineData}
                          disabled={!inlineDryMatter || savingInlineData}
                          className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1"
                        >
                          {savingInlineData ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Actualizar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ⑤ REAL: Fechas reales — solo planes existentes */}
              {formData.id && (
                <div className="rounded-2xl border-2 border-green-200 bg-green-50/40 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-green-100/60 border-b border-green-100">
                    <div className="w-4 h-4 bg-green-600 rounded-sm" />
                    <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Real — lo que ocurrió</span>
                    <span className="ml-auto text-[10px] font-bold rounded-full px-2 py-0.5 border bg-white text-gray-400 border-gray-100">
                      {formData.actual_exit_date ? '✅ Completado' : formData.actual_entry_date ? '🐄 En pastoreo' : '⏳ Pendiente'}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-green-700 tracking-widest uppercase flex items-center gap-1">
                          Entrada real
                          {formData.entry_date && formData.actual_entry_date && (
                            <span className={`normal-case font-black text-[9px] px-1.5 py-0.5 rounded-full ${
                              formData.actual_entry_date > formData.entry_date ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-700'
                            }`}>
                              {formData.actual_entry_date === formData.entry_date ? '= plan'
                                : formData.actual_entry_date > formData.entry_date
                                  ? `+${daysBetween(formData.entry_date, formData.actual_entry_date)}d tardío`
                                  : `−${daysBetween(formData.actual_entry_date, formData.entry_date)}d antes`}
                            </span>
                          )}
                        </label>
                        <input
                          type="date"
                          value={formData.actual_entry_date}
                          onChange={e => setFormData({ ...formData, actual_entry_date: e.target.value })}
                          className="w-full bg-white border-2 border-green-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-1 focus:ring-green-500 outline-none text-gray-900"
                        />
                        {!formData.actual_entry_date && (
                          <button type="button" onClick={() => setFormData(p => ({ ...p, actual_entry_date: new Date().toISOString().split('T')[0] }))}
                            className="text-[9px] text-green-600 font-black hover:underline">
                            🟢 Entraron hoy
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-green-700 tracking-widest uppercase flex items-center gap-1">
                          Salida real
                          {formData.actual_entry_date && formData.actual_exit_date && (
                            <span className="normal-case font-black text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                              {daysBetween(formData.actual_entry_date, formData.actual_exit_date)}d
                            </span>
                          )}
                        </label>
                        <input
                          type="date"
                          value={formData.actual_exit_date}
                          onChange={e => setFormData({ ...formData, actual_exit_date: e.target.value })}
                          disabled={!formData.actual_entry_date}
                          className="w-full bg-white border-2 border-green-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-1 focus:ring-green-500 outline-none text-gray-900 disabled:opacity-40"
                        />
                        {formData.actual_entry_date && !formData.actual_exit_date && (
                          <button type="button" onClick={() => setFormData(p => ({ ...p, actual_exit_date: new Date().toISOString().split('T')[0] }))}
                            className="text-[9px] text-green-600 font-black hover:underline">
                            🔴 Salieron hoy
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Remanente al cierre — aparece al registrar salida real */}
                    {formData.actual_exit_date && (
                      <div className="bg-amber-50 border-2 border-amber-100 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Leaf className="w-3.5 h-3.5 text-amber-600" />
                          <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Pasto remanente al cierre</p>
                          <span className="ml-auto text-[9px] text-amber-500 font-bold">Dato holístico clave</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={5000}
                            placeholder="kg MS/ha"
                            value={remnantAnalysis?.dry_matter_kg_ha || ''}
                            onChange={e => setRemnantAnalysis({ dry_matter_kg_ha: Number(e.target.value) })}
                            className="flex-1 bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-sm font-bold text-gray-900 focus:ring-1 focus:ring-amber-400 outline-none"
                          />
                          <span className="text-xs text-amber-600 font-black whitespace-nowrap">kg MS/ha</span>
                        </div>
                        {remnantAnalysis?.dry_matter_kg_ha > 0 && (
                          <p className="text-[9px] text-amber-600 font-bold">
                            ✓ Se actualizará el potrero al guardar para calibrar el próximo plan
                          </p>
                        )}
                      </div>
                    )}

                    {formData.actual_entry_date && formData.actual_exit_date && formData.exit_date && (() => {
                      const planD = daysBetween(formData.entry_date, formData.exit_date)
                      const realD = daysBetween(formData.actual_entry_date, formData.actual_exit_date)
                      const dev = realD - planD
                      return (
                        <div className="flex items-center justify-around bg-white border-2 border-green-100 rounded-xl px-4 py-3">
                          <div className="text-center">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Plan</p>
                            <p className="text-2xl font-black text-blue-600">{planD}<span className="text-xs text-gray-400 ml-0.5">d</span></p>
                          </div>
                          <div className="text-2xl text-gray-200">→</div>
                          <div className="text-center">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Real</p>
                            <p className="text-2xl font-black text-green-600">{realD}<span className="text-xs text-gray-400 ml-0.5">d</span></p>
                          </div>
                          <div className="text-center">
                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Desvío</p>
                            <p className={`text-2xl font-black ${dev > 0 ? 'text-red-500' : dev < 0 ? 'text-blue-500' : 'text-gray-400'}`}>
                              {dev > 0 ? '+' : ''}{dev}<span className="text-xs ml-0.5">d</span>
                            </p>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

            </div>

            {/* ─── MODAL FOOTER ─── */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 bg-gray-50/60 shrink-0">
              {formData.id && (
                <button type="button" onClick={handleDeletePlan} disabled={saving}
                  className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Eliminar planificación">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button type="button" onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold text-sm transition-all">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.paddock_id || formData.herd_ids.length === 0 || !formData.entry_date || !formData.exit_date}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 font-black text-sm shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
                  : <><Check className="w-4 h-4" /> {formData.id ? 'Guardar cambios' : 'Crear planificación'}</>
                }
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL: PLANIFICACIÓN SUGERIDA (multi-potrero, multi-rebaño) ────── */}
      {showSuggestPanel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-violet-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-950">Planificación Sugerida</h3>
                  <p className="text-xs text-indigo-600 font-bold">Ciclo anual · rotación intercalada · estacionalidad automática</p>
                </div>
              </div>
              <button onClick={() => setShowSuggestPanel(false)} className="w-9 h-9 flex items-center justify-center bg-white/70 hover:bg-white rounded-xl text-gray-500 transition-all border border-indigo-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* Fecha de inicio */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase">Fecha de inicio del ciclo</label>
                <input
                  type="date"
                  value={suggestStartDate}
                  onChange={e => setSuggestStartDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Regla estacional */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5" /> Días de descanso regenerativo por estación (H. Sur)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '🌿 Sep–Feb', sub: 'Prim/Verano', days: 40, color: 'text-green-700 bg-green-50 border-green-200' },
                    { label: '🍂 Mar–May', sub: 'Otoño',       days: 65, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                    { label: '❄️ Jun–Ago', sub: 'Invierno',    days: 92, color: 'text-blue-700 bg-blue-50 border-blue-200'   },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl border p-2.5 text-center ${s.color}`}>
                      <p className="text-[11px] font-black">{s.label}</p>
                      <p className="text-[9px] text-gray-500">{s.sub}</p>
                      <p className="text-2xl font-black mt-0.5">{s.days}<span className="text-xs ml-0.5">d</span></p>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-indigo-500 font-bold">El algoritmo calcula automáticamente estos días según la fecha de salida proyectada de cada turno.</p>
              </div>

              {/* Multi-selección de Potreros */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase">Potreros a incluir en la rotación</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSuggestPaddockIds(paddocks.map(p => p.id))} className="text-[9px] font-black text-indigo-600 hover:underline">Todos</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setSuggestPaddockIds([])} className="text-[9px] font-black text-red-400 hover:underline">Ninguno</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {paddocks.map(p => {
                    const isSel = suggestPaddockIds.includes(p.id)
                    const msColor = (p.dry_matter_kg_ha || 0) >= 1500 ? 'text-green-600' : (p.dry_matter_kg_ha || 0) >= 800 ? 'text-amber-500' : 'text-red-500'
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSuggestPaddockIds(prev =>
                          prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                        )}
                        className={`flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-left transition-all ${
                          isSel ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 bg-white hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSel
                            ? <div className="w-4 h-4 bg-indigo-600 rounded-full flex items-center justify-center shrink-0"><Check className="w-2.5 h-2.5 text-white" /></div>
                            : <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
                          }
                          <div>
                            <p className={`text-sm font-bold ${isSel ? 'text-indigo-900' : 'text-gray-800'}`}>{p.name}</p>
                            <p className="text-[10px] text-gray-400">{Number(p.area_ha).toFixed(1)} ha</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-black ${msColor}`}>{p.dry_matter_kg_ha || 0}</p>
                          <p className="text-[9px] text-gray-400">kg MS/ha</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
                {suggestPaddockIds.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-bold text-center py-1">👆 Seleccioná al menos un potrero</p>
                )}
              </div>

              {/* Multi-selección de Rebaños */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-gray-500 tracking-widest uppercase">Rebaños a rotar</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSuggestHerdIds(herds.map(h => h.id))} className="text-[9px] font-black text-indigo-600 hover:underline">Todos</button>
                    <span className="text-gray-300">|</span>
                    <button type="button" onClick={() => setSuggestHerdIds([])} className="text-[9px] font-black text-red-400 hover:underline">Ninguno</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
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
                        className={`relative flex flex-col items-start p-3 rounded-xl border-2 transition-all ${
                          isSel ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-100 bg-white hover:border-gray-200'
                        }`}
                      >
                        {isSel && <div className="absolute top-2 right-2 w-4 h-4 bg-white/20 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                        <div className="w-7 h-1.5 rounded-full mb-1.5" style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.4)' : hColor }} />
                        <p className="text-sm font-black leading-tight">{h.name}</p>
                        <p className={`text-[10px] font-bold ${isSel ? 'text-gray-300' : 'text-gray-400'}`}>
                          {Number(h.total_ev).toFixed(0)} EV
                        </p>
                      </button>
                    )
                  })}
                </div>
                {suggestHerdIds.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-bold text-center py-1">👆 Seleccioná al menos un rebaño</p>
                )}
              </div>

              {/* Resumen del algoritmo */}
              {suggestPaddockIds.length > 0 && suggestHerdIds.length > 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-1.5">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vista previa de la rotación</p>
                  <p className="text-sm text-gray-700 font-medium">
                    <span className="font-black text-gray-900">{suggestPaddockIds.length} potrero{suggestPaddockIds.length > 1 ? 's' : ''}</span> rotando con{' '}
                    <span className="font-black text-gray-900">{suggestHerdIds.length} rebaño{suggestHerdIds.length > 1 ? 's' : ''}</span> en ciclo intercalado a lo largo de <span className="font-black text-indigo-700">12 meses</span>.
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium">
                    Cada potrero se asignará al siguiente rebaño disponible cuando su período de descanso (40–92 días según estación) haya concluido.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3 bg-gray-50/60 shrink-0">
              <button onClick={() => setShowSuggestPanel(false)} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold text-sm transition-all">
                Cancelar
              </button>
              <button
                onClick={handleGeneratePlanCycle}
                disabled={saving || suggestPaddockIds.length === 0 || suggestHerdIds.length === 0 || !suggestStartDate}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-black text-sm shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando ciclo anual...</>
                  : <><Zap className="w-4 h-4" /> Generar ciclo anual ({suggestPaddockIds.length}P × {suggestHerdIds.length}R)</>
                }
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
