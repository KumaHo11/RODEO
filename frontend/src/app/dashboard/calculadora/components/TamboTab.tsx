'use client'
import React, { useState } from 'react'
import { Card, Num, RO } from './FormulasTab'
import { TamboCalculatorEngine } from '../tamboEngine'

export function TamboTab() {
  // ─── Estado de variables ──────────────────────────────────────────────────
  // Producción
  const [liters, setLiters]       = useState(25)
  const [fatKg, setFatKg]         = useState(0.85) // 3.4% aprox de 25L
  const [proteinKg, setProteinKg] = useState(0.80) // 3.2% aprox de 25L
  
  // Alimentación
  const [liveWeight, setLiveWeight] = useState(600)
  
  // Reproducción
  const [eligible, setEligible]       = useState(100)
  const [inseminated, setInseminated] = useState(60)
  const [pregnant, setPregnant]       = useState(25)
  
  // Rodeo y superficie
  const [milkingCows, setMilkingCows]     = useState(180)
  const [dryCows, setDryCows]             = useState(40)
  const [totalHeads, setTotalHeads]       = useState(250)
  const [cowEquivalent, setCowEquivalent] = useState(1.3)
  const [hectares, setHectares]           = useState(120)

  // ─── Cálculos (TamboCalculatorEngine) ───────────────────────────────────
  let ecm = 0, fcm = 0, dmi = 0, feedEff = 0
  let hdr = 0, cr = 0, pr = 0
  let milkingRatio = 0, stockingRate = 0

  try { ecm = TamboCalculatorEngine.calculateEcm(liters, fatKg, proteinKg) } catch (e) { ecm = NaN }
  try { fcm = TamboCalculatorEngine.calculateFcm(liters, fatKg) } catch (e) { fcm = NaN }
  try { dmi = TamboCalculatorEngine.calculateDmi(liveWeight, fcm) } catch (e) { dmi = NaN }
  try { feedEff = TamboCalculatorEngine.calculateFeedEfficiency(ecm, dmi) } catch (e) { feedEff = NaN }
  
  try { hdr = TamboCalculatorEngine.calculateHeatDetectionRate(inseminated, eligible) } catch (e) { hdr = NaN }
  try { cr = TamboCalculatorEngine.calculateConceptionRate(pregnant, inseminated) } catch (e) { cr = NaN }
  try { pr = TamboCalculatorEngine.calculatePregnancyRate(hdr, cr) } catch (e) { pr = NaN }
  
  try { milkingRatio = TamboCalculatorEngine.calculateMilkingCowsRatio(milkingCows, dryCows) } catch (e) { milkingRatio = NaN }
  try { stockingRate = TamboCalculatorEngine.calculateStockingRate(totalHeads, cowEquivalent, hectares) } catch (e) { stockingRate = NaN }

  return (
    <div className="space-y-8">
      {/* 1. Producción y alimentación */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Producción y alimentación</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card num="T1" title="Leche corregida por energía (ECM)" 
            desc="Estandariza la leche a 3.5% grasa y 3.2% proteína."
            formula="ECM = (0.327 × Litros) + (12.95 × Grasa) + (7.2 × Proteína)"
            result={isNaN(ecm) ? '—' : ecm.toFixed(2)} unit="L/día" resultLabel="ECM">
            <Num label="Producción de leche" value={liters} onChange={setLiters} unit="L/día" step={0.5} />
            <Num label="Grasa producida" value={fatKg} onChange={setFatKg} unit="kg" step={0.01} />
            <Num label="Proteína producida" value={proteinKg} onChange={setProteinKg} unit="kg" step={0.01} />
          </Card>

          <Card num="T2" title="Leche corregida por grasa (FCM 4%)" 
            desc="Estandariza la leche a un contenido fijo del 4% de grasa."
            formula="FCM = (0.4 × Litros) + (15 × Grasa kg)"
            result={isNaN(fcm) ? '—' : fcm.toFixed(2)} unit="L/día" resultLabel="FCM">
            <Num label="Producción de leche" value={liters} onChange={setLiters} unit="L/día" step={0.5} />
            <Num label="Grasa producida" value={fatKg} onChange={setFatKg} unit="kg" step={0.01} />
          </Card>

          <Card num="T3" title="Consumo de materia seca (DMI)" 
            desc="Estima el requerimiento de consumo de materia seca por vaca."
            formula="DMI = (0.02 × Peso vivo) + (0.3 × FCM)"
            result={isNaN(dmi) ? '—' : dmi.toFixed(2)} unit="kg MS/día" resultLabel="Consumo MS">
            <Num label="Peso vivo" value={liveWeight} onChange={setLiveWeight} unit="kg" step={10} />
            <RO label="FCM (calculado arriba)" value={isNaN(fcm) ? '—' : fcm.toFixed(2)} unit="L/día" />
          </Card>

          <Card num="T4" title="Eficiencia de conversión alimenticia" 
            desc="Litros de ECM producidos por kg de MS ingerida."
            formula="Eficiencia = ECM ÷ DMI"
            result={isNaN(feedEff) ? '—' : feedEff.toFixed(2)} unit="L/kg MS" resultLabel="Eficiencia">
            <RO label="ECM" value={isNaN(ecm) ? '—' : ecm.toFixed(2)} unit="L/día" />
            <RO label="DMI" value={isNaN(dmi) ? '—' : dmi.toFixed(2)} unit="kg MS/día" />
          </Card>
        </div>
      </div>

      {/* 2. Reproducción */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Eficiencia reproductiva</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card num="T5" title="Tasa de detección de celo (HDR)" 
            desc="Porcentaje de vacas detectadas en celo e inseminadas."
            formula="HDR = (Inseminadas ÷ Elegibles) × 100"
            result={isNaN(hdr) ? '—' : hdr.toFixed(1)} unit="%" resultLabel="HDR">
            <Num label="Vacas elegibles" value={eligible} onChange={setEligible} unit="cab." step={1} />
            <Num label="Vacas inseminadas" value={inseminated} onChange={setInseminated} unit="cab." step={1} />
          </Card>

          <Card num="T6" title="Tasa de concepción (CR)" 
            desc="Porcentaje de preñez sobre las vacas inseminadas."
            formula="CR = (Preñadas ÷ Inseminadas) × 100"
            result={isNaN(cr) ? '—' : cr.toFixed(1)} unit="%" resultLabel="Concepción">
            <Num label="Vacas inseminadas" value={inseminated} onChange={setInseminated} unit="cab." step={1} />
            <Num label="Vacas preñadas" value={pregnant} onChange={setPregnant} unit="cab." step={1} />
          </Card>

          <Card num="T7" title="Tasa de preñez (PR)" 
            desc="Velocidad a la que las vacas quedan preñadas (ciclo 21 días)."
            formula="PR = (HDR × CR) ÷ 100"
            result={isNaN(pr) ? '—' : pr.toFixed(1)} unit="%" resultLabel="Tasa de preñez">
            <RO label="Detección de celo (HDR)" value={isNaN(hdr) ? '—' : hdr.toFixed(1)} unit="%" />
            <RO label="Tasa de concepción (CR)" value={isNaN(cr) ? '—' : cr.toFixed(1)} unit="%" />
          </Card>
        </div>
      </div>

      {/* 3. Rodeo y superficie */}
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Rodeo y superficie</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card num="T8" title="Relación vacas en ordeño" 
            desc="Proporción de vacas en producción activa."
            formula="VO % = (Vacas en ordeño ÷ Total vacas) × 100"
            result={isNaN(milkingRatio) ? '—' : milkingRatio.toFixed(1)} unit="%" resultLabel="% VO">
            <Num label="Vacas en ordeño (VO)" value={milkingCows} onChange={setMilkingCows} unit="cab." step={1} />
            <Num label="Vacas secas (VS)" value={dryCows} onChange={setDryCows} unit="cab." step={1} />
          </Card>

          <Card num="T9" title="Carga animal (tambo)" 
            desc="Densidad ganadera del tambo en EV/ha."
            formula="Carga = (Cabezas totales × EV promedio) ÷ Superficie"
            result={isNaN(stockingRate) ? '—' : stockingRate.toFixed(2)} unit="EV/ha" resultLabel="Carga">
            <Num label="Cabezas totales" value={totalHeads} onChange={setTotalHeads} unit="cab." step={1} />
            <Num label="Equivalente vaca promedio" value={cowEquivalent} onChange={setCowEquivalent} unit="EV" step={0.1} />
            <Num label="Superficie efectiva" value={hectares} onChange={setHectares} unit="ha" step={1} />
          </Card>
        </div>
      </div>

    </div>
  )
}
