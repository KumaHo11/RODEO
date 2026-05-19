'use client'
import React, { useState, useMemo } from 'react'
import clsx from 'clsx'

type Sp = 'Bovinos' | 'Equinos' | 'Ovinos' | 'Caprinos' | 'Porcinos' | 'Aves'
type Cat = { label: string; cbi: (pv: number, extra: number) => number; needsPV: boolean; extraLabel?: string }

const CATS: Record<Sp, Cat[]> = {
  Bovinos: [
    { label: 'Ternero',              needsPV: true,  cbi: (pv) => pv * 0.085 },
    { label: 'Novillo / vaquillona', needsPV: true,  cbi: (pv) => pv * 0.10 },
    { label: 'Vaca vacía',           needsPV: true,  cbi: (pv) => pv * 0.08 },
    { label: 'Vaca gestante',        needsPV: true,  cbi: (pv) => pv * 0.104 },
    { label: 'Vaca lactante',        needsPV: true,  extraLabel: 'Litros leche/día', cbi: (pv, lt) => (pv * 0.08) + (1.5 * lt) },
    { label: 'Toro',                 needsPV: true,  cbi: (pv) => pv * 0.07 },
    { label: 'Toro en servicio',     needsPV: true,  cbi: (pv) => pv * 0.098 },
  ],
  Equinos: [
    { label: 'Caballo / yegua (reposo)', needsPV: true, cbi: (pv) => pv * 0.06 },
    { label: 'Caballo trabajo intenso',  needsPV: true, cbi: (pv) => pv * 0.10 },
    { label: 'Padrillo',                 needsPV: true, cbi: (pv) => pv * 0.07 },
    { label: 'Potrillo (< 1 año)',       needsPV: true, cbi: (pv) => pv * 0.12 },
  ],
  Ovinos: [
    { label: 'Oveja seca',        needsPV: true, cbi: (pv) => pv * 0.08 },
    { label: 'Oveja con cordero', needsPV: true, cbi: (pv) => pv * 0.12 },
    { label: 'Cordero',           needsPV: true, cbi: (pv) => pv * 0.10 },
  ],
  Caprinos: [
    { label: 'Cabra seca',     needsPV: true, cbi: (pv) => pv * 0.09 },
    { label: 'Cabra lactante', needsPV: true, extraLabel: 'Litros leche/día', cbi: (pv, lt) => (pv * 0.09) + (lt * 1.2) },
    { label: 'Cabrito',        needsPV: true, cbi: (pv) => pv * 0.12 },
  ],
  Porcinos: [
    { label: 'Cerdo engorde',  needsPV: true, extraLabel: 'kg alimento/día', cbi: (_, kg) => kg * 2.5 },
    { label: 'Cerda gestante', needsPV: true, cbi: (pv) => pv * 0.12 },
    { label: 'Cerda lactante', needsPV: true, cbi: (pv) => pv * 0.25 },
  ],
  Aves: [
    { label: 'Pollo parrillero', needsPV: false, extraLabel: 'kg alimento/día/ave', cbi: (_, kg) => kg * 1.8 },
    { label: 'Gallina postura',  needsPV: false, cbi: () => 0.25 },
    { label: 'Pavo',             needsPV: false, cbi: () => 0.45 },
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
            <div className="flex flex-wrap gap-2">
              {SPECIES.map(s => (
                <button
                  key={s}
                  onClick={() => { setSp(s); setCat(0) }}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    sp === s
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
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
            <div className="flex flex-wrap gap-2">
              {cats.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setCat(i)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                    catIdx === i
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
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
          <div className="border-2 border-blue-500 bg-blue-50 rounded-xl p-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">Volumen bebedero</p>
            <p className="text-5xl font-black tabular-nums text-blue-900">{ri.toLocaleString('es')}</p>
            <p className="text-sm text-blue-600 mt-1">L / día</p>
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

          {/* Alerta térmica o nota */}
          {temp > 30 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              ⚠️ <strong>Estrés térmico</strong> — Ft = 1.4 aplicado (+40 % consumo base). Temperatura &gt; 30 °C.
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-500 space-y-0.5">
              <p>CTL = {cri} L × {heads} animales = <strong>{ctl.toLocaleString('es')} L/día</strong></p>
              <p>Bebedero = CTL × 1.20 (margen evaporación) = <strong>{ri.toLocaleString('es')} L/día</strong></p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
