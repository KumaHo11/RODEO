'use client'
import React, { useState, useMemo } from 'react'

type Sp2 = 'Bovinos' | 'Equinos' | 'Ovinos' | 'Caprinos' | 'Porcinos' | 'Aves'

const CATS: Record<Sp2, { label: string; cbi: (pv: number, extra: number) => number; needsPV: boolean; extraLabel?: string }[]> = {
  Bovinos: [
    { label: 'Ternero',         needsPV: true,  cbi: (pv) => pv * 0.085 },
    { label: 'Novillo / vaquillona', needsPV: true, cbi: (pv) => pv * 0.025 * 4.0 },
    { label: 'Vaca vacía',      needsPV: true,  cbi: (pv) => pv * 0.08 },
    { label: 'Vaca gestante',   needsPV: true,  cbi: (pv) => pv * 0.08 * 1.3 },
    { label: 'Vaca lactante',   needsPV: true,  extraLabel: 'Litros leche/día', cbi: (pv, lt) => (pv * 0.08) + (1.5 * lt) },
    { label: 'Toro',            needsPV: true,  cbi: (pv) => pv * 0.07 },
    { label: 'Toro en servicio',needsPV: true,  cbi: (pv) => pv * 0.07 * 1.4 },
  ],
  Equinos: [
    { label: 'Caballo / yegua (reposo)',       needsPV: true, cbi: (pv) => pv * 0.06 },
    { label: 'Caballo trabajo intenso',        needsPV: true, cbi: (pv) => pv * 0.10 },
    { label: 'Padrillo',                       needsPV: true, cbi: (pv) => pv * 0.07 },
    { label: 'Potrillo (< 1 año)',             needsPV: true, cbi: (pv) => pv * 0.12 },
  ],
  Ovinos: [
    { label: 'Oveja seca',        needsPV: true, cbi: (pv) => pv * 0.08 },
    { label: 'Oveja con cordero', needsPV: true, cbi: (pv) => pv * 0.12 },
    { label: 'Cordero',           needsPV: true, cbi: (pv) => pv * 0.10 },
  ],
  Caprinos: [
    { label: 'Cabra seca',        needsPV: true, cbi: (pv) => pv * 0.09 },
    { label: 'Cabra lactante',    needsPV: true, extraLabel: 'Litros leche/día', cbi: (pv, lt) => (pv * 0.09) + (lt * 1.2) },
    { label: 'Cabrito',           needsPV: true, cbi: (pv) => pv * 0.12 },
  ],
  Porcinos: [
    { label: 'Cerdo engorde',    needsPV: true, extraLabel: 'kg alimento/día', cbi: (_, kg) => kg * 2.5 },
    { label: 'Cerda gestante',   needsPV: true, cbi: (pv) => pv * 0.12 },
    { label: 'Cerda lactante',   needsPV: true, cbi: (pv) => pv * 0.25 },
  ],
  Aves: [
    { label: 'Pollo parrillero', needsPV: false, extraLabel: 'kg alimento/día/ave', cbi: (_, kg) => kg * 1.8 },
    { label: 'Gallina postura',  needsPV: false, cbi: () => 0.25 },
    { label: 'Pavo',             needsPV: false, cbi: () => 0.45 },
  ],
}

const SPECIES2 = Object.keys(CATS) as Sp2[]

function ResultCard({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 text-center border ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
      <p className={`text-2xl font-black tabular-nums ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500 font-medium mt-0.5">{unit}</p>
      <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${highlight ? 'text-blue-400' : 'text-gray-400'}`}>{label}</p>
    </div>
  )
}

export function HidricoTab() {
  const [sp, setSp] = useState<Sp2>('Bovinos')
  const [catIdx, setCatIdx] = useState(0)
  const [heads, setHeads] = useState(100)
  const [temp, setTemp] = useState(25)
  const [pv, setPv] = useState(450)
  const [extra, setExtra] = useState(0)

  const cats = CATS[sp]
  const cat = cats[Math.min(catIdx, cats.length - 1)]

  const { cri, ctl, ri } = useMemo(() => {
    const cbi = cat.cbi(pv, extra)
    const ft = temp > 30 ? 1.4 : 1.0
    const cri = +(cbi * ft).toFixed(1)
    const ctl = +(cri * heads).toFixed(0)
    const ri = +(ctl * 1.20).toFixed(0)
    return { cri, ctl, ri }
  }, [cat, pv, extra, temp, heads])

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <p className="text-xs font-black text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-3">Balance hídrico y dimensionamiento de bebederos</p>
        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          Estimación de la demanda de agua diaria por especie, categoría y condición ambiental. Incluye factor de corrección por estrés térmico y margen de infraestructura hídrica.
        </p>
      </div>

      {/* Especie */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Especie</p>
        <div className="flex flex-wrap gap-2">
          {SPECIES2.map(s => (
            <button key={s} onClick={() => { setSp(s); setCatIdx(0) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${sp === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Categoría + variables */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Categoría</p>
        <div className="flex flex-wrap gap-2">
          {cats.map((c, i) => (
            <button key={i} onClick={() => setCatIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${catIdx === i ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-medium block">Cantidad de animales</label>
            <input type="number" value={isNaN(heads) ? '' : heads} min={1} inputMode="numeric"
              onFocus={e => e.target.select()}
              onChange={e => setHeads(e.target.value === '' ? NaN : parseFloat(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-green-500 outline-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-medium block">Temperatura máx. esperada (°C)</label>
            <input type="number" value={isNaN(temp) ? '' : temp} min={0} max={50} inputMode="decimal"
              onFocus={e => e.target.select()}
              onChange={e => setTemp(e.target.value === '' ? NaN : parseFloat(e.target.value))}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-green-500 outline-none" />
          </div>
          {cat.needsPV && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-medium block">Peso vivo promedio (kg)</label>
              <input type="number" value={isNaN(pv) ? '' : pv} min={1} inputMode="decimal"
                onFocus={e => e.target.select()}
                onChange={e => setPv(e.target.value === '' ? NaN : parseFloat(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-green-500 outline-none" />
            </div>
          )}
          {cat.extraLabel && (
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-medium block">{cat.extraLabel}</label>
              <input type="number" value={isNaN(extra) ? '' : extra} min={0} step={0.1} inputMode="decimal"
                onFocus={e => e.target.select()}
                onChange={e => setExtra(e.target.value === '' ? NaN : parseFloat(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-green-500 outline-none" />
            </div>
          )}
        </div>
      </div>

      {/* Factor térmico */}
      {temp > 30 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          ⚠️ <strong>Estrés térmico activo</strong> — temperatura &gt; 30 °C aplica factor Ft = 1.4 (+40% de consumo base).
        </div>
      )}

      {/* Resultados */}
      <div className="grid grid-cols-3 gap-3">
        <ResultCard label="Consumo individual" value={cri.toFixed(1)} unit="L/día/animal" />
        <ResultCard label="Demanda total del lote" value={`${ctl.toLocaleString('es')}`} unit="L/día" />
        <ResultCard label="Volumen bebedero" value={`${ri.toLocaleString('es')}`} unit="L/día" highlight />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-1.5 text-[11px] text-gray-500">
        <p><span className="font-bold text-gray-700">CBI</span> = fórmula fisiológica por categoría</p>
        <p><span className="font-bold text-gray-700">CRI</span> = CBI × Ft ({temp > 30 ? '1.4 — estrés térmico' : '1.0 — temperatura normal'})</p>
        <p><span className="font-bold text-gray-700">CTL</span> = CRI × {heads} animales = <strong>{ctl.toLocaleString('es')} L/día</strong></p>
        <p><span className="font-bold text-gray-700">RI (bebedero)</span> = CTL × 1.20 (+20 % evaporación/limpieza) = <strong>{ri.toLocaleString('es')} L/día</strong></p>
      </div>
    </div>
  )
}
