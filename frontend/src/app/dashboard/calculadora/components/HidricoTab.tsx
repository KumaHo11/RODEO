'use client'
import React, { useState, useMemo } from 'react'
import clsx from 'clsx'

type Sp = 'Bovinos' | 'Equinos' | 'Ovinos' | 'Caprinos' | 'Porcinos' | 'Aves'
type Cat = { label: string; cbi: (pv: number, extra: number) => number; defaultPv: number; extraLabel?: string; defaultExtra?: number }

const CATS: Record<Sp, Cat[]> = {
  Bovinos: [
    { label: 'Ternero',              defaultPv: 150, cbi: (pv) => pv * 0.085 },
    { label: 'Novillo / vaquillona', defaultPv: 350, cbi: (pv) => pv * 0.025 * 4.0 },
    { label: 'Vaca vacía',           defaultPv: 450, cbi: (pv) => pv * 0.08 },
    { label: 'Vaca gestante',        defaultPv: 450, cbi: (pv) => (pv * 0.08) * 1.3 },
    { label: 'Vaca lactante',        defaultPv: 450, extraLabel: 'Litros de leche', defaultExtra: 10, cbi: (pv, lt) => (pv * 0.08) + (1.5 * lt) },
    { label: 'Toro',                 defaultPv: 600, cbi: (pv) => pv * 0.07 },
    { label: 'Toro en servicio',     defaultPv: 600, cbi: (pv) => (pv * 0.07) * 1.4 },
  ],
  Equinos: [
    { label: 'Caballo adulto en mantenimiento', defaultPv: 500, cbi: (pv) => pv * 0.05 },
    { label: 'Yegua gestante',                  defaultPv: 500, cbi: (pv) => pv * 0.09 },
    { label: 'Yegua en lactancia',              defaultPv: 500, extraLabel: 'Litros leche/día', defaultExtra: 10, cbi: (pv, lt) => (pv * 0.1) + (1.1 * lt) },
    { label: 'Caballo en trabajo/entrenamiento',defaultPv: 500, cbi: (pv) => pv * 0.10 },
    { label: 'Padrillo en servicio',            defaultPv: 550, cbi: (pv) => pv * 0.09 },
    { label: 'Potrillo (crecimiento)',          defaultPv: 200, cbi: (pv) => pv * 0.10 },
  ],
  Ovinos: [
    { label: 'Oveja seca / capón',       defaultPv: 50, cbi: (pv) => pv * 0.08 },
    { label: 'Oveja preñada',            defaultPv: 60, cbi: (pv) => pv * 0.11 },
    { label: 'Oveja en lactancia',       defaultPv: 50, extraLabel: 'Litros leche/día', defaultExtra: 1.5, cbi: (pv, lt) => (pv * 0.08) + (2.5 * lt) },
    { label: 'Borrego / cordero',        defaultPv: 30, cbi: (pv) => pv * 0.10 },
    { label: 'Carnero en servicio',      defaultPv: 80, cbi: (pv) => pv * 0.087 },
  ],
  Caprinos: [
    { label: 'Cabra seca',               defaultPv: 40, cbi: (pv) => pv * 0.095 },
    { label: 'Cabra preñada',            defaultPv: 45, cbi: (pv) => pv * 0.13 },
    { label: 'Cabra en lactancia',       defaultPv: 40, cbi: (pv) => pv * 0.21 },
    { label: 'Chivito (crecimiento)',    defaultPv: 20, cbi: (pv) => pv * 0.115 },
    { label: 'Chivato en servicio',      defaultPv: 60, cbi: (pv) => pv * 0.09 },
  ],
  Porcinos: [
    { label: 'Lechón',                   defaultPv: 10, cbi: (pv) => pv * 0.20 },
    { label: 'Cerdo crecimiento/terminación', defaultPv: 60, extraLabel: 'kg alimento/día', defaultExtra: 2.5, cbi: (_, kg) => kg * 3 },
    { label: 'Cachorra / cerda vacía',   defaultPv: 120, cbi: (pv) => pv * 0.09 },
    { label: 'Cerda gestante',           defaultPv: 150, cbi: (pv) => pv * 0.09 },
    { label: 'Cerda lactante',           defaultPv: 150, extraLabel: 'Cant. lechones', defaultExtra: 10, cbi: (_, lechones) => 15 + (1.5 * lechones) },
    { label: 'Padrillo en servicio',     defaultPv: 180, cbi: (pv) => pv * 0.075 },
  ],
  Aves: [
    { label: 'Pollo engorde (Sem. 1)',   defaultPv: 0.2, cbi: (pv) => pv * 0.2 },
    { label: 'Pollo engorde (Sem. 4)',   defaultPv: 1.0, cbi: (pv) => pv * 0.175 },
    { label: 'Pollo engorde (Sem. 6-7)', defaultPv: 2.5, cbi: (pv) => pv * 0.14 },
    { label: 'Gallina ponedora',         defaultPv: 1.8, cbi: (pv) => pv * 0.16 },
    { label: 'Pollita recría',           defaultPv: 1.0, cbi: (pv) => pv * 0.14 },
    { label: 'Gallo reproductor',        defaultPv: 3.0, cbi: (pv) => pv * 0.10 },
  ],
}

function Num({ label, value, onChange, unit, step = 1, min }: {
  label: string; value: number; onChange: (v: number) => void
  unit?: string; step?: number; min?: number
}) {
  const [localStr, setLocalStr] = useState<string | null>(null)
  
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-gray-500 font-semibold block tracking-wide">{label}</label>
      <div className="relative">
        <input type="number" 
          value={localStr !== null ? localStr : (isNaN(value) ? '' : value)} 
          step={step} min={min}
          inputMode="decimal"
          onFocus={e => e.target.select()}
          onChange={e => {
            setLocalStr(e.target.value)
            const v = parseFloat(e.target.value)
            onChange(isNaN(v) ? NaN : v)
          }}
          onBlur={() => setLocalStr(null)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none transition-all pr-10" />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium">{unit}</span>}
      </div>
    </div>
  )
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
                  onClick={() => { 
                    setSp(s); 
                    setCat(0);
                    const firstCat = CATS[s][0];
                    setPv(firstCat.defaultPv);
                    setExtra(firstCat.defaultExtra ?? 0);
                  }}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-xs font-bold transition-all',
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
                  onClick={() => {
                    setCat(i);
                    setPv(c.defaultPv);
                    setExtra(c.defaultExtra ?? 0);
                  }}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-xs font-bold transition-all',
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
            <Num label="Cantidad de animales" value={heads} onChange={setHeads} unit="cab." min={1} />
            <Num label="Temperatura máx." value={temp} onChange={setTemp} unit="°C" min={0} step={0.5} />
            <Num label="Peso vivo prom." value={pv} onChange={setPv} unit="kg" min={0.1} step={0.5} />
            {cat.extraLabel && (
              <Num label={cat.extraLabel} value={extra} onChange={setExtra} unit="" min={0} step={0.1} />
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
          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-600 space-y-2">
            {temp > 30 && (
              <div className="text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 mb-2 font-medium">
                ⚠️ Estrés térmico: factor Ft = 1.4 aplicado al consumo base (+40%).
              </div>
            )}
            <ul className="list-disc pl-4 space-y-1 text-[10px] text-gray-500 mb-2 font-medium">
              <li><strong>CRI</strong>: Consumo Real Individual</li>
              <li><strong>CBI</strong>: Consumo Base Individual</li>
              <li><strong>F<sub>t</sub></strong>: Factor por estrés térmico</li>
              <li><strong>CTL</strong>: Consumo Total del Lote</li>
              <li><strong>RI</strong>: Requerimiento de Infraestructura (Bebedero)</li>
            </ul>
            <p>CRI = CBI × F<sub>t</sub> = <strong className="text-gray-900">{cri.toFixed(1)} L/día</strong></p>
            <p>CTL = CRI × {isNaN(heads) ? 0 : heads} animales = <strong className="text-gray-900">{ctl.toLocaleString('es')} L/día</strong></p>
            <p>Bebedero (RI) = CTL × 1.20 (margen infraestructura) = <strong className="text-gray-900">{ri.toLocaleString('es')} L/día</strong></p>
          </div>
        </div>
      </div>
    </div>
  )
}
