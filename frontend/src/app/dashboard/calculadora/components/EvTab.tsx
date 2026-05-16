'use client'
import React, { useState, useMemo } from 'react'

const SPECIES = ['Bovinos','Equinos','Ovinos','Caprinos','Bubalinos','Ciervos'] as const
type Sp = typeof SPECIES[number]

type Stage = { label: string; coef: number; note: string }

const STAGES: Record<Sp, Stage[]> = {
  Bovinos: [
    { label: 'Vaca sola (450 kg ref.)',     coef: 1.00, note: 'Referencia base EV = 1.0' },
    { label: 'Vaca con ternero al pie',      coef: 1.30, note: '+30 % por demanda lactación' },
    { label: 'Vaca gestante (último tercio)',coef: 1.15, note: '+15 % por demanda fetal' },
    { label: 'Novillo / novillito',          coef: 0.90, note: 'Ajuste por peso y conversión' },
    { label: 'Vaquillona',                   coef: 0.80, note: 'Menor peso y demanda metabólica' },
    { label: 'Ternero / ternera',            coef: 0.45, note: 'Coef. estándar FAO' },
    { label: 'Toro (reposo)',                coef: 1.25, note: 'Mayor masa muscular' },
    { label: 'Toro en servicio',             coef: 1.50, note: '+20 % sobre toro reposo por gasto energético' },
  ],
  Equinos: [
    { label: 'Caballo castrado / yegua (trabajo leve)', coef: 1.25, note: 'Mayor tasa metabólica base que bovinos' },
    { label: 'Caballo deportivo / trabajo intenso',     coef: 1.80, note: '+44 % por gasto energético en ejercicio' },
    { label: 'Padrillo (reposo)',                       coef: 1.50, note: 'Mantenimiento de masa corporal elevada' },
    { label: 'Padrillo en servicio',                    coef: 1.90, note: '+27 % sobre padrillo reposo' },
    { label: 'Potrillo / yegua con potro',              coef: 1.10, note: 'Peso menor, lactación incluida' },
  ],
  Ovinos: [
    { label: 'Oveja seca',           coef: 0.13, note: '65–70 kg ref.' },
    { label: 'Oveja con cordero',    coef: 0.18, note: '+38 % por lactación' },
    { label: 'Oveja gestante',       coef: 0.15, note: '+15 % último tercio gestación' },
    { label: 'Cordero / borrego',    coef: 0.08, note: 'Peso ≈ 30 kg' },
    { label: 'Carnero',              coef: 0.16, note: '80–90 kg ref.' },
  ],
  Caprinos: [
    { label: 'Cabra seca',           coef: 0.12, note: '55–60 kg ref.' },
    { label: 'Cabra en lactación',   coef: 0.17, note: '+40 % por producción láctea' },
    { label: 'Cabra gestante',       coef: 0.14, note: '+17 % último tercio' },
    { label: 'Cabrito',              coef: 0.06, note: 'Peso ≈ 20 kg' },
    { label: 'Macho cabrío',         coef: 0.15, note: '70–80 kg ref.' },
  ],
  Bubalinos: [
    { label: 'Búfala sola',          coef: 1.10, note: 'Mayor peso corporal que bovino promedio' },
    { label: 'Búfala con cría',      coef: 1.45, note: '+32 % por lactación intensa' },
    { label: 'Búfalo toro',          coef: 1.35, note: 'Mayor masa que toro bovino' },
    { label: 'Bufalo novillo',        coef: 1.00, note: 'Equivalente a vaca bovino de referencia' },
  ],
  Ciervos: [
    { label: 'Cierva sola',          coef: 0.20, note: '80–100 kg ref.' },
    { label: 'Cierva con cervato',   coef: 0.28, note: '+40 % lactación' },
    { label: 'Ciervo macho',         coef: 0.25, note: '120–150 kg ref.' },
  ],
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
      <p className="text-2xl font-black text-gray-900 tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{label}</p>
    </div>
  )
}

export function EvTab() {
  const [sp, setSp] = useState<Sp>('Bovinos')
  const [stIdx, setStIdx] = useState(0)
  const [heads, setHeads] = useState(100)
  const [weightKg, setWeightKg] = useState(450)

  const stages = STAGES[sp]
  const stage = stages[Math.min(stIdx, stages.length - 1)]

  const weightAdj = useMemo(() => {
    if (sp === 'Bovinos' || sp === 'Bubalinos') return Math.pow(weightKg / 450, 0.75)
    if (sp === 'Equinos') return Math.pow(weightKg / 550, 0.75)
    if (sp === 'Ovinos') return Math.pow(weightKg / 65, 0.75)
    if (sp === 'Caprinos') return Math.pow(weightKg / 58, 0.75)
    if (sp === 'Ciervos') return Math.pow(weightKg / 100, 0.75)
    return 1
  }, [sp, weightKg])

  const evInd = +(stage.coef * weightAdj).toFixed(3)
  const evTotal = +(evInd * heads).toFixed(1)

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <p className="text-xs font-black text-gray-800 uppercase tracking-widest border-b border-gray-100 pb-3">Calculadora de EV por especie y estadio</p>
        <p className="text-xs text-gray-500 mt-3 leading-relaxed">
          El coeficiente de Equivalente Vaca (EV) se ajusta por especie, estadio fisiológico y peso vivo real usando la fórmula metabólica (PV/PV_ref)^0.75.
        </p>
      </div>

      {/* Especie */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Especie</p>
        <div className="flex flex-wrap gap-2">
          {SPECIES.map(s => (
            <button key={s} onClick={() => { setSp(s); setStIdx(0) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${sp === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Estadio */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estadio / categoría</p>
        <div className="space-y-1.5">
          {stages.map((s, i) => (
            <button key={i} onClick={() => setStIdx(i)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${stIdx === i ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-300'}`}>
              <div>
                <p className={`text-xs font-bold ${stIdx === i ? 'text-green-800' : 'text-gray-700'}`}>{s.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.note}</p>
              </div>
              <span className={`text-sm font-black tabular-nums ${stIdx === i ? 'text-green-700' : 'text-gray-500'}`}>×{s.coef}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Variables */}
      <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Variables del lote</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-medium block">Cabezas</label>
            <input type="number" value={heads} min={1} onChange={e => setHeads(+e.target.value || 1)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-green-500 outline-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 font-medium block">Peso vivo prom. (kg)</label>
            <input type="number" value={weightKg} min={10} onChange={e => setWeightKg(+e.target.value || 10)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:border-green-500 outline-none" />
          </div>
        </div>
      </div>

      {/* Resultados */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill label="Coef. base" value={`×${stage.coef}`} />
        <StatPill label="EV individual" value={evInd.toFixed(3)} />
        <StatPill label="EV total del lote" value={`${evTotal} EV`} />
      </div>
      <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-800 leading-relaxed">
        <strong>Fórmula aplicada:</strong> EV = {stage.coef} (coef. estadio) × ({weightKg}/{sp === 'Equinos' ? 550 : sp === 'Ovinos' ? 65 : sp === 'Caprinos' ? 58 : sp === 'Ciervos' ? 100 : 450} kg ref.)^0.75 = <strong>{evInd}</strong> EV/animal · {heads} animales = <strong>{evTotal} EV</strong>
      </div>
    </div>
  )
}
