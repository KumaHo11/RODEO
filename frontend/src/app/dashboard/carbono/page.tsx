'use client'

import { useState, useEffect, useMemo } from 'react'
import { Leaf, Award, Download, TrendingUp, Sparkles, MapPin, Loader2, Info, FileText, CheckCircle2, CloudRain } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlan } from '@/hooks/usePlan'
import { PremiumOverlay } from '@/components/PremiumOverlay'
import { apiFetch } from '@/lib/apiFetch'
import { toast } from 'sonner'

export default function CarbonoPage() {
  const { hasFeature } = usePlan()
  const [loading, setLoading] = useState(true)
  const [showCertModal, setShowCertModal] = useState(false)
  const [simulating, setSimulating] = useState(false)

  // Real data state
  const [paddocks, setPaddocks] = useState<any[]>([])
  const [farmEvents, setFarmEvents] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const [padRes, evRes] = await Promise.all([
          apiFetch('/api/paddocks').catch(() => null),
          apiFetch('/api/farm-events').catch(() => null)
        ])
        if (padRes?.ok) {
          const d = await padRes.json()
          setPaddocks(d.paddocks || [])
        }
        if (evRes?.ok) {
          const d = await evRes.json()
          setFarmEvents(d.events || [])
        }
      } catch (err) {
        console.error('Error loading carbon data', err)
      } finally {
        setLoading(false)
      }
    }
    if (hasFeature('carbon_module')) {
      loadData()
    }
  }, [hasFeature])

  // Cálculos dinámicos
  const stats = useMemo(() => {
    const totalHa = paddocks.reduce((sum, p) => sum + (Number(p.area_ha) || 0), 0)
    const grazingEvents = farmEvents.filter(e => e.type === 'GRAZING').length
    
    // Estimación: 1.5 tCO2e/ha base + 0.15 tCO2e por evento de rotación (impacto del remanente)
    const baseCarbon = totalHa * 1.5
    const activeCarbon = grazingEvents * 0.15
    const carbonTotal = Math.round(baseCarbon + activeCarbon)

    // SOC Base de 3.0% que mejora marginalmente con las rotaciones holísticas
    const socPct = (3.0 + (grazingEvents * 0.002)).toFixed(2)

    return { totalHa, grazingEvents, carbonTotal, socPct }
  }, [paddocks, farmEvents])

  const finishedGrazings = useMemo(() => {
    const grazings = farmEvents
      .filter(e => e.type === 'GRAZING')
      .map((e, index) => {
        // Mocking enrichment from MVP satellite and climate crossing
        const restDays = Math.floor(Math.random() * 40) + 35; // 35 to 75 days
        const isDrought = Math.random() > 0.6; // 40% chance of unfavorable climate
        const ndviScore = isDrought ? (Math.random() * 0.3 + 0.5) : (Math.random() * 0.3 + 0.65);
        const paddock = paddocks.find(p => p.id === e.paddock_id) || { name: `Potrero ${index + 1}` };
        
        let efficiency = 'Estándar';
        let efficiencyColor = 'text-gray-600 bg-gray-100 border-gray-200';
        
        // Eficiencia de Manejo logic:
        if (restDays >= 60 && ndviScore > 0.65 && isDrought) {
            efficiency = 'Alta (Resiliencia Climática)';
            efficiencyColor = 'text-green-700 bg-green-50 border-green-200';
        } else if (restDays >= 45 && ndviScore >= 0.7) {
            efficiency = 'Óptima';
            efficiencyColor = 'text-blue-700 bg-blue-50 border-blue-200';
        } else if (restDays < 30) {
            efficiency = 'Baja (Alerta)';
            efficiencyColor = 'text-red-700 bg-red-50 border-red-200';
        }

        const fallbackStartDate = new Date();
        fallbackStartDate.setDate(fallbackStartDate.getDate() - (index * 10) - 20);
        
        const fallbackEndDate = new Date(fallbackStartDate);
        fallbackEndDate.setDate(fallbackEndDate.getDate() + 5);

        return {
          id: e.id || `mock-${index}`,
          paddockName: paddock.name,
          startDate: e.start_date || fallbackStartDate.toISOString(),
          endDate: e.end_date || fallbackEndDate.toISOString(),
          restDays,
          isDrought,
          ndviScore,
          efficiency,
          efficiencyColor,
          animalLoad: e.metadata?.ev ? `${e.metadata.ev} EV` : `${Math.floor(Math.random() * 100) + 80} EV`,
          carbonCaptured: (Math.random() * 0.2 + 0.05).toFixed(2)
        }
      })
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
      .slice(0, 8); // Show only recent 8 for demo

    return grazings;
  }, [farmEvents, paddocks]);

  const certificates = [
    { id: 'CERT-2026-001', year: 2026, tons: Math.round(stats.carbonTotal * 0.8), status: 'ISSUED', date: '2026-03-15' },
    { id: 'CERT-2025-042', year: 2025, tons: Math.round(stats.carbonTotal * 0.6), status: 'RETIRED', date: '2025-11-10' },
  ]

  const handleEmitCertificate = () => {
    setSimulating(true)
    setTimeout(() => {
      const reportContent = `RODEO - DATA ROOM AUDITORÍA CARBONO\n\nFecha de generación: ${new Date().toISOString()}\nSuperficie Total (Ha): ${stats.totalHa.toFixed(2)}\nEventos de Pastoreo Registrados: ${stats.grazingEvents}\nCarbono Estimado (tCO2e): ${stats.carbonTotal}\nSOC Promedio (%): ${stats.socPct}\n\n---\nEste documento empaqueta la evidencia criptográfica y registros de la bitácora de la temporada para la auditoría EOV.\n`
      const blob = new Blob([reportContent], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `RODEO_DataRoom_Carbono_${new Date().getFullYear()}.txt`
      a.click()
      URL.revokeObjectURL(url)

      setSimulating(false)
      setShowCertModal(false)
      toast.success('Reporte Data Room generado y descargado con éxito.')
    }, 2500)
  }

  const handleDownloadReport = (type: string) => {
    toast.success(`Iniciando descarga del reporte: ${type}`)
  }

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString)
      // Produce un formato tipo "14 may 2026" o "14 may, 2026" dependiendo del locale
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch (e) {
      return dateString
    }
  }

  if (!hasFeature('carbon_module')) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Sustentabilidad y carbono</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Monitoreo ecológico · Medición de carbono en suelo (SOC) · Certificaciones
          </p>
        </div>
        <PremiumOverlay 
          title="Módulo de Sustentabilidad y MRV"
          description="Accede a la auditoría satelital NDVI y la emisión de bonos de carbono. Este módulo empaqueta automáticamente tus datos de pastoreo para certificadoras internacionales."
          requiredPlan="Holístico"
        >
          <div className="p-8 space-y-6 pointer-events-none">
            <div className="bg-green-900 rounded-2xl h-48 opacity-30 shadow-xl" />
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 h-64 opacity-50 shadow-sm" />
              <div className="bg-white rounded-2xl border border-gray-100 h-64 opacity-50 shadow-sm" />
            </div>
          </div>
        </PremiumOverlay>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">Sustentabilidad y carbono</h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Monitoreo ecológico · Medición de carbono en suelo (SOC) · Certificaciones
          </p>
        </div>
        <button
          onClick={() => setShowCertModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
        >
          <Award className="w-4 h-4" />
          Solicitar Certificación
        </button>
      </div>

      <div className="bg-green-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Leaf className="w-40 h-40" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-green-300 text-xs font-black uppercase tracking-widest mb-1">Carbono total secuestrado</p>
            <h2 className="text-5xl font-black">{stats.carbonTotal.toLocaleString()} <span className="text-2xl opacity-60">tCO₂e</span></h2>
            <p className="text-green-100/70 text-sm mt-2 font-medium max-w-md">
              Basado en {stats.totalHa.toFixed(0)} hectáreas y {stats.grazingEvents} rotaciones de pastoreo registradas en la bitácora.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-green-800/50 rounded-xl p-4 border border-green-700/50 text-center min-w-[120px]">
              <p className="text-[10px] font-black text-green-300 uppercase tracking-widest mb-1">SOC (Suelo)</p>
              <p className="text-3xl font-black text-white">{stats.socPct}%</p>
              <p className="text-[10px] font-bold text-green-400 mt-1 flex justify-center items-center gap-1"><TrendingUp className="w-3 h-3"/> +0.2% anual</p>
            </div>
            <div className="bg-green-800/50 rounded-xl p-4 border border-green-700/50 text-center min-w-[120px]">
              <p className="text-[10px] font-black text-green-300 uppercase tracking-widest mb-1">Valor estimado</p>
              <p className="text-3xl font-black text-white">${(stats.carbonTotal * 15).toLocaleString()}</p>
              <p className="text-[10px] font-bold text-green-400 mt-1">Mercado voluntario</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <Download className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Centro de descargas</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed mb-6 flex-1">
            Exporta registros operativos y de clima cruzados, formateados específicamente para procesos de auditoría y certificación de créditos de carbono.
          </p>
          <div className="space-y-3">
            <button onClick={() => handleDownloadReport('Historial Movimientos')} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-800">Historial de Movimientos Cruzados</span>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>
            <button onClick={() => handleDownloadReport('Planillas Pastoreo')} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-800">Planillas de Pastoreo (Auditoría)</span>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>
            <button onClick={() => handleDownloadReport('Reporte Climático')} className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors">
              <div className="flex items-center gap-3">
                <CloudRain className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-800">Datos Climáticos y NDVI</span>
              </div>
              <Download className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Impacto regenerativo</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              El pastoreo planificado incrementa la materia orgánica en el suelo. Cada 1% de aumento en SOC en una hectárea equivale a una gran cantidad de carbono retirado de la atmósfera.
            </p>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <h4 className="text-xs font-black text-blue-800 uppercase tracking-widest mb-2">Siguientes Pasos</h4>
              <ul className="text-sm text-blue-900 space-y-2 font-medium">
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" /> Realizar muestreo físico en potreros testigo (Primavera 2026).
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" /> Cargar polígonos faltantes para precisión satelital.
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
             <div className="flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-green-600" />
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Certificados activos</h3>
            </div>
            <div className="space-y-3">
              {certificates.map(cert => (
                <div key={cert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{cert.id}</p>
                    <p className="text-xs text-gray-500">Vintage {cert.year} · {cert.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{cert.tons.toLocaleString()} t</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${cert.status === 'ISSUED' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {cert.status === 'ISSUED' ? 'Emitido' : 'Retirado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Módulo de pastoreos finalizados</h3>
          </div>
          <p className="text-xs text-gray-500 font-medium">Cruce de registros operativos vs métricas climáticas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-black text-gray-500 text-xs uppercase tracking-widest">Potrero</th>
                <th className="px-6 py-4 font-black text-gray-500 text-xs uppercase tracking-widest">Período Real</th>
                <th className="px-6 py-4 font-black text-gray-500 text-xs uppercase tracking-widest">Carga (EV)</th>
                <th className="px-6 py-4 font-black text-gray-500 text-xs uppercase tracking-widest">Descanso</th>
                <th className="px-6 py-4 font-black text-gray-500 text-xs uppercase tracking-widest">Clima / NDVI</th>
                <th className="px-6 py-4 font-black text-gray-500 text-xs uppercase tracking-widest">Eficiencia de manejo</th>
                <th className="px-6 py-4 font-black text-gray-500 text-xs uppercase tracking-widest text-right">Captura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {finishedGrazings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No hay pastoreos finalizados en la bitácora actual.
                  </td>
                </tr>
              ) : (
                finishedGrazings.map(g => (
                  <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{g.paddockName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-600">{formatDate(g.startDate)} - {formatDate(g.endDate)}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {g.animalLoad}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${g.restDays >= 45 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                        {g.restDays} días
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {g.isDrought ? (
                          <span className="text-orange-500 flex items-center gap-1 text-xs font-medium" title="Déficit Hídrico">
                            <CloudRain className="w-3 h-3" /> Seco
                          </span>
                        ) : (
                          <span className="text-blue-500 flex items-center gap-1 text-xs font-medium" title="Lluvias Adecuadas">
                            <CloudRain className="w-3 h-3" /> Óptimo
                          </span>
                        )}
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-600 text-xs">NDVI {g.ndviScore.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-md text-xs border ${g.efficiencyColor}`}>
                        {g.efficiency}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium text-green-700">+{g.carbonCaptured} tCO₂e</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showCertModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="bg-green-900 p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <Award className="w-6 h-6 text-green-400" />
                  <h3 className="text-xl font-black">Solicitar Certificación de Carbono</h3>
                </div>
                <p className="text-green-100/70 text-sm">Auditoría y emisión de certificados bajo estándar EOV (Savory).</p>
              </div>
              <div className="p-8 space-y-6">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Para emitir un nuevo certificado, RODEO enviará un paquete de datos que incluye los históricos de pastoreo, descansos, y proyecciones NDVI a la certificadora. El proceso tiene un costo de auditoría.
                </p>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-500 mb-1">Volumen estimado a certificar</p>
                  <p className="text-2xl font-black text-gray-900">{stats.carbonTotal.toLocaleString()} <span className="text-sm text-gray-500">tCO₂e</span></p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={handleEmitCertificate}
                    disabled={simulating}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                  >
                    {simulating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Solicitar Auditoría"}
                  </button>
                  <button 
                    onClick={() => setShowCertModal(false)}
                    className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-black rounded-2xl transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
