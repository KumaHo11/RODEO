'use client'
import React, { useState, useMemo } from 'react'
import clsx from 'clsx'

type Sp = 'Bovinos' | 'Equinos' | 'Ovinos' | 'Caprinos' | 'Porcinos' | 'Aves'
type Cat = { label: string; cbi: (pv: number, extra: number) => number; needsPV: boolean; extraLabel?: string }

const CATS: Record<Sp, Cat[]> = {
  Bovinos: [
    { label: 'Ternero',              needsPV: true,  cbi: (pv) => pv * 0.085 },
    { label: 'Novillo / vaquillona', needsPV: true,  cbi: (pv) => pv * 0.025 * 4.0 },
    { label: 'Vaca vacía',           needsPV: true,  cbi: (pv) => pv * 0.08 },
    { label: 'Vaca gestante',        needsPV: true,  cbi: (pv) => (pv * 0.08) * 1.3 },
    { label: 'Vaca lactante',        needsPV: true,  extraLabel: 'Litros de leche', cbi: (pv, lt) => (pv * 0.08) + (1.5 * lt) },
    { label: 'Toro',                 needsPV: true,  cbi: (pv) => pv * 0.07 },
    { label: 'Toro en servicio',     needsPV: true,  cbi: (pv) => (pv * 0.07) * 1.4 },
  ],
  Equinos: [
    { label: 'Caballo adulto en mantenimiento', needsPV: true, cbi: (pv) => pv * 0.05 },
    { label: 'Yegua gestante',                  needsPV: false, cbi: () => 45 },
    { label: 'Yegua en lactancia',              needsPV: false, extraLabel: 'Litros leche/día', cbi: (_, lt) => 50 + (1.1 * lt) },
    { label: 'Caballo en trabajo/entrenamiento',needsPV: true, cbi: (pv) => pv * 0.05 * 2.0 },
    { label: 'Padrillo en servicio',            needsPV: false, cbi: () => 50 },
    { label: 'Potrillo (crecimiento)',          needsPV: false, cbi: () => 20 },
  ],
  Ovinos: [
    { label: 'Oveja seca / capón',       needsPV: false, cbi: () => 4 },
    { label: 'Oveja preñada',            needsPV: false, cbi: () => 7 },
    { label: 'Oveja en lactancia',       needsPV: false, extraLabel: 'Litros leche/día', cbi: (_, lt) => 4 + (2.5 * lt) },
    { label: 'Borrego / cordero',        needsPV: false, cbi: () => 3 },
    { label: 'Carnero en servicio',      needsPV: false, cbi: () => 7 },
  ],
  Caprinos: [
    { label: 'Cabra seca',               needsPV: false, cbi: () => 3.8 },
    { label: 'Cabra preñada',            needsPV: false, cbi: () => 6 },
    { label: 'Cabra en lactancia',       needsPV: false, cbi: () => 8.5 },
    { label: 'Chivito (crecimiento)',    needsPV: false, cbi: () => 2.3 },
    { label: 'Chivato en servicio',      needsPV: false, cbi: () => 5.5 },
  ],
  Porcinos: [
    { label: 'Lechón',                   needsPV: false, cbi: () => 2 },
    { label: 'Cerdo crecimiento/terminación', needsPV: true, extraLabel: 'kg alimento/día', cbi: (_, kg) => kg * 3 },
    { label: 'Cachorra / cerda vacía',   needsPV: false, cbi: () => 11 },
    { label: 'Cerda gestante',           needsPV: false, cbi: () => 13.5 },
    { label: 'Cerda lactante',           needsPV: false, extraLabel: 'Cant. lechones', cbi: (_, lechones) => 15 + (1.5 * lechones) },
    { label: 'Padrillo en servicio',     needsPV: false, cbi: () => 13.5 },
  ],
  Aves: [
    { label: 'Pollo engorde (Sem. 1)',   needsPV: false, cbi: () => 0.04 },
    { label: 'Pollo engorde (Sem. 4)',   needsPV: false, cbi: () => 0.175 },
    { label: 'Pollo engorde (Sem. 6-7)', needsPV: false, cbi: () => 0.35 },
    { label: 'Gallina ponedora',         needsPV: false, cbi: () => 0.30 },
    { label: 'Pollita recría',           needsPV: false, cbi: () => 0.14 },
    { label: 'Gallo reproductor',        needsPV: false, cbi: () => 0.32 },
  ],
}

const SPECIES = Object.keys(CATS) as Sp[]

export function HidricoTab() {
  const [sp, setSp]       = useState<Sp>('Bovinos')
  const [catIdx, setCat]  = useState(0)
  const [heads, setHeads] = useState(100)
  const [temp, setTemp]   = useState(25)
  const [pv, setPv]       = useState(450)
  const [extra, setExtra] = useState(0)

  const cats = CATS[sp]
  const cat  = cats[Math.min(catIdx, cats.length - 1)]

  const { cri, ctl, ri, ft } = useMemo(() => {
    const cbi = cat.cbi(pv, extra)
    const ft  = temp > 30 ? 1.4 : 1.0
    const cri = +(cbi * ft).toFixed(1)
    const ctl = +(cri * heads).toFixed(0)
    const ri  = +(ctl * 1.20).toFixed(0)
    return { cri, ctl, ri, ft }
  }, [cat, pv, extra, temp, heads])

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">

        {/* ── Controles ────────────────────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">

          {/* Especie */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Especie</p>
            <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
              {SPECIES.map(s => (
                <button
                  key={s}
                  onClick={() => { setSp(s); setCat(0) }}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-xs font-black transition-all',
                    sp === s
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Categoría */}
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Categoría</p>
            <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-2xl w-fit">
              {cats.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setCat(i)}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-xs font-black transition-all',
                    catIdx === i
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Variables */}
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-medium block">Cantidad de animales</label>
              <input type="number" value={isNaN(heads) ? '' : heads} min={1} inputMode="numeric"
                onFocus={e => e.target.select()}
                onChange={e => setHeads(e.target.value === '' ? NaN : parseFloat(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-blue-500 outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-medium block">Temperatura máx. (°C)</label>
              <input type="number" value={isNaN(temp) ? '' : temp} min={0} max={50} inputMode="decimal"
                onFocus={e => e.target.select()}
                onChange={e => setTemp(e.target.value === '' ? NaN : parseFloat(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-blue-500 outline-none" />
            </div>
            {cat.needsPV && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-medium block">Peso vivo prom. (kg)</label>
                <input type="number" value={isNaN(pv) ? '' : pv} min={1} inputMode="decimal"
                  onFocus={e => e.target.select()}
                  onChange={e => setPv(e.target.value === '' ? NaN : parseFloat(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-blue-500 outline-none" />
              </div>
            )}
            {cat.extraLabel && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 font-medium block">{cat.extraLabel}</label>
                <input type="number" value={isNaN(extra) ? '' : extra} min={0} step={0.1} inputMode="decimal"
                  onFocus={e => e.target.select()}
                  onChange={e => setExtra(e.target.value === '' ? NaN : parseFloat(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-blue-500 outline-none" />
              </div>
            )}
          </div>
        </div>

        {/* ── Resultado hero ───────────────────────────────────────────────── */}
        <div className="space-y-3 lg:sticky lg:top-4">

          {/* Bebedero — hero */}
          <div className="border border-gray-200 bg-gray-50 rounded-xl p-6 text-center shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Volumen bebedero</p>
            <p className="text-5xl font-black tabular-nums text-gray-900">{ri.toLocaleString('es')}</p>
            <p className="text-sm text-gray-500 mt-1">L / día</p>
          </div>

          {/* Consumo individual + total */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Individual</p>
              <p className="text-2xl font-black text-gray-900 tabular-nums mt-0.5">{cri.toFixed(1)}<span className="text-xs text-gray-400 ml-1">L/día</span></p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total lote</p>
              <p className="text-2xl font-black text-gray-900 tabular-nums mt-0.5">{ctl.toLocaleString('es')}<span className="text-xs text-gray-400 ml-1">L/día</span></p>
            </div>
          </div>

          {/* Fórmulas y desglose */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-500 space-y-2">
            {temp > 30 && (
              <div className="text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 mb-2 font-medium">
                ⚠️ Estrés térmico: factor Ft = 1.4 aplicado al consumo base (+40%).
              </div>
            )}
            <ul className="list-disc pl-4 space-y-1 text-[10px] text-gray-400 mb-2">
              <li><strong>CRI</strong>: Consumo Real Individual</li>
              <li><strong>CBI</strong>: Consumo Base Individual</li>
              <li><strong>F<sub>t</sub></strong>: Factor por estrés térmico</li>
              <li><strong>CTL</strong>: Consumo Total del Lote</li>
              <li><strong>RI</strong>: Requerimiento de Infraestructura (Bebedero)</li>
            </ul>
            <p>CRI = CBI × F<sub>t</sub> = <strong>{cri.toFixed(1)} L/día</strong></p>
            <p>CTL = CRI × {isNaN(heads) ? 0 : heads} animales = <strong>{ctl.toLocaleString('es')} L/día</strong></p>
            <p>Bebedero (RI) = CTL × 1.20 (margen infraestructura) = <strong>{ri.toLocaleString('es')} L/día</strong></p>
          </div>
        </div>
      </div>
    </div>
  )
}
