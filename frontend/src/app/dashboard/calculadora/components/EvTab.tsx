'use client'
import React, { useState, useMemo } from 'react'
import clsx from 'clsx'

const SPECIES = ['Bovinos', 'Equinos', 'Ovinos', 'Caprinos', 'Bubalinos', 'Ciervos'] as const
type Sp = typeof SPECIES[number]
type Stage = { label: string; coef: number; note: string }

const STAGES: Record<Sp, Stage[]> = {
  Bovinos: [
    { label: 'Vaca sola',               coef: 1.00, note: 'Referencia base (450 kg)' },
    { label: 'Vaca con ternero al pie', coef: 1.30, note: '+30 % por lactación' },
    { label: 'Vaca gestante',           coef: 1.15, note: '+15 % por demanda fetal' },
    { label: 'Novillo / novillito',     coef: 0.90, note: 'Ajuste por peso' },
    { label: 'Vaquillona',              coef: 0.80, note: 'Menor demanda metabólica' },
    { label: 'Ternero / ternera',       coef: 0.45, note: 'Estándar FAO' },
    { label: 'Toro (reposo)',           coef: 1.25, note: 'Mayor masa muscular' },
    { label: 'Toro en servicio',        coef: 1.50, note: '+20 % gasto energético' },
  ],
  Equinos: [
    { label: 'Caballo / yegua (leve)',  coef: 1.25, note: 'Mayor tasa metabólica' },
    { label: 'Caballo deportivo',       coef: 1.80, note: '+44 % en ejercicio intenso' },
    { label: 'Padrillo (reposo)',       coef: 1.50, note: 'Masa corporal elevada' },
    { label: 'Padrillo en servicio',    coef: 1.90, note: '+27 % sobre reposo' },
    { label: 'Potrillo / c/ potro',     coef: 1.10, note: 'Lactación incluida' },
  ],
  Ovinos: [
    { label: 'Oveja seca',             coef: 0.13, note: '65–70 kg ref.' },
    { label: 'Oveja con cordero',      coef: 0.18, note: '+38 % por lactación' },
    { label: 'Oveja gestante',         coef: 0.15, note: '+15 % último tercio' },
    { label: 'Cordero / borrego',      coef: 0.08, note: '≈ 30 kg' },
    { label: 'Carnero',                coef: 0.16, note: '80–90 kg ref.' },
  ],
  Caprinos: [
    { label: 'Cabra seca',             coef: 0.12, note: '55–60 kg ref.' },
    { label: 'Cabra en lactación',     coef: 0.17, note: '+40 % producción láctea' },
    { label: 'Cabra gestante',         coef: 0.14, note: '+17 % último tercio' },
    { label: 'Cabrito',                coef: 0.06, note: '≈ 20 kg' },
    { label: 'Macho cabrío',           coef: 0.15, note: '70–80 kg ref.' },
  ],
  Bubalinos: [
    { label: 'Búfala sola',            coef: 1.10, note: 'Mayor peso que bovino' },
    { label: 'Búfala con cría',        coef: 1.45, note: '+32 % lactación intensa' },
    { label: 'Búfalo toro',            coef: 1.35, note: 'Mayor masa muscular' },
    { label: 'Búfalo novillo',         coef: 1.00, note: 'Equiv. vaca bovino' },
  ],
  Ciervos: [
    { label: 'Cierva sola',            coef: 0.20, note: '80–100 kg ref.' },
    { label: 'Cierva con cervato',     coef: 0.28, note: '+40 % lactación' },
    { label: 'Ciervo macho',           coef: 0.25, note: '120–150 kg ref.' },
  ],
}

const PV_REF: Record<Sp, number> = {
  Bovinos: 450, Equinos: 550, Ovinos: 65, Caprinos: 58, Bubalinos: 450, Ciervos: 100,
}

export function EvTab() {
  const [sp, setSp]       = useState<Sp>('Bovinos')
  const [stIdx, setStIdx] = useState(0)
  const [heads, setHeads] = useState(100)
  const [weight, setWeight] = useState(450)

  const stages = STAGES[sp]
  const stage  = stages[Math.min(stIdx, stages.length - 1)]
  const pvRef  = PV_REF[sp]

  const weightAdj = useMemo(() => Math.pow(weight / pvRef, 0.75), [weight, pvRef])
  const evInd     = +(stage.coef * weightAdj).toFixed(3)
  const evTotal   = +(evInd * heads).toFixed(1)

  return (
    <div className="space-y-5 animate-in fade-in duration-200">

      {/* Layout 2 col en desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">

        {/* ── Columna izquierda: controles ─────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">

          {/* Especie */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Especie</p>
            <div className="flex flex-wrap gap-2">
              {SPECIES.map(s => (
                <button
                  key={s}
                  onClick={() => { setSp(s); setStIdx(0); setWeight(PV_REF[s]) }}
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

          {/* Estadio */}
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Estadio / categoría</p>
            <div className="space-y-1">
              {stages.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStIdx(i)}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all',
                    stIdx === i
                      ? 'border-green-300 bg-green-50'
                      : 'border-transparent hover:bg-gray-50'
                  )}
                >
                  <div>
                    <p className={clsx('text-xs font-semibold', stIdx === i ? 'text-green-800' : 'text-gray-700')}>{s.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.note}</p>
                  </div>
                  <span className={clsx('text-sm font-black tabular-nums shrink-0 ml-3', stIdx === i ? 'text-green-700' : 'text-gray-300')}>
                    ×{s.coef}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Inputs */}
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-medium block">Cabezas</label>
              <input
                type="number" value={isNaN(heads) ? '' : heads} min={1} inputMode="numeric"
                onFocus={e => e.target.select()}
                onChange={e => setHeads(e.target.value === '' ? NaN : parseFloat(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-green-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-medium block">Peso vivo prom. (kg)</label>
              <input
                type="number" value={isNaN(weight) ? '' : weight} min={10} inputMode="decimal"
                onFocus={e => e.target.select()}
                onChange={e => setWeight(e.target.value === '' ? NaN : parseFloat(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-green-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* ── Columna derecha: resultado prominente ────────────────────────── */}
        <div className="space-y-3 lg:sticky lg:top-4">

          {/* EV total — hero */}
          <div className="border-2 border-green-500 bg-green-50 rounded-xl p-6 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mb-2">EV total del lote</p>
            <p className="text-5xl font-black tabular-nums text-green-900">{evTotal}</p>
            <p className="text-sm text-green-600 mt-1">Equivalentes Vaca</p>
          </div>

          {/* EV individual */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">EV individual</p>
              <p className="text-2xl font-black text-gray-900 tabular-nums mt-0.5">{evInd}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Coef. estadio</p>
              <p className="text-2xl font-black text-gray-900 tabular-nums mt-0.5">×{stage.coef}</p>
            </div>
          </div>

          {/* Fórmula */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-800 leading-relaxed">
            EV = {stage.coef} × ({weight}/{pvRef})^0.75 = <strong>{evInd}</strong> × {heads} = <strong>{evTotal} EV</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
