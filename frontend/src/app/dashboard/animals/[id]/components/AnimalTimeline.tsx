'use client'

import {
  Baby, Scale, Syringe, HeartHandshake, MapPin, 
  DollarSign, Wifi, FileText, Beef
} from 'lucide-react'

const ICONS: Record<string, { icon: any, color: string, bg: string }> = {
  NACIMIENTO: { icon: Baby, color: 'text-emerald-600', bg: 'bg-emerald-50 border border-emerald-100' },
  PESAJE: { icon: Scale, color: 'text-blue-600', bg: 'bg-blue-50 border border-blue-100' },
  VACUNACION: { icon: Syringe, color: 'text-amber-600', bg: 'bg-amber-50 border border-amber-100' },
  TRATAMIENTO: { icon: Syringe, color: 'text-amber-600', bg: 'bg-amber-50 border border-amber-100' },
  PARTO: { icon: Beef, color: 'text-emerald-600', bg: 'bg-emerald-50 border border-emerald-100' },
  MOVIMIENTO: { icon: MapPin, color: 'text-gray-600', bg: 'bg-gray-50 border border-gray-200' },
  VENTA: { icon: DollarSign, color: 'text-red-600', bg: 'bg-red-50 border border-red-100' },
  FAENA: { icon: DollarSign, color: 'text-red-600', bg: 'bg-red-50 border border-red-100' },
  LECTURA_RFID: { icon: Wifi, color: 'text-purple-600', bg: 'bg-purple-50 border border-purple-100' },
  OBSERVACION: { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-50 border border-gray-200' },
  DEFAULT: { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-50 border border-gray-200' },
}

export function AnimalTimeline({ events }: { events: any[] }) {
  if (!events || events.length === 0) {
    return <div className="text-gray-400 py-8 text-center text-sm">No hay eventos registrados.</div>
  }

  return (
    <div className="relative border-l border-gray-200 ml-4 py-4 space-y-6">
      {events.map((ev, i) => {
        const config = ICONS[ev.event_type] || ICONS.DEFAULT
        const Icon = config.icon

        return (
          <div key={ev.id || i} className="relative pl-6">
            <div className={`absolute -left-3 top-0 w-6 h-6 rounded-full ${config.bg} flex items-center justify-center bg-white`}>
              <Icon className={`w-3.5 h-3.5 ${config.color}`} />
            </div>

            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700">
                {new Date(ev.event_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {ev.event_type}
              </span>
              {ev.source === 'BLUETOOTH_RFID' && (
                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> RFID
                </span>
              )}
            </div>

            <div className="text-sm text-gray-500 mt-1">
              {ev.event_type === 'PESAJE' && ev.details?.peso && (
                <p>&gt; Peso: {ev.details.peso} kg</p>
              )}
              {(ev.event_type === 'VACUNACION' || ev.event_type === 'TRATAMIENTO') && ev.details?.vacuna && (
                <p>&gt; {ev.details.vacuna}</p>
              )}
              {ev.event_type === 'NACIMIENTO' && ev.details?.peso_inicial && (
                <p>&gt; Peso inicial: {ev.details.peso_inicial} kg</p>
              )}
              {ev.event_type === 'MOVIMIENTO' && ev.details?.destino && (
                <p>&gt; Destino: {ev.details.destino}</p>
              )}
              {ev.event_type === 'OBSERVACION' && ev.details?.nota && (
                <p>&gt; {ev.details.nota}</p>
              )}
            </div>

            {ev.photo_urls && ev.photo_urls.length > 0 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {ev.photo_urls.map((url: string, idx: number) => (
                  <img key={idx} src={url} alt="Evento" className="w-16 h-16 object-cover rounded-lg" />
                ))}
              </div>
            )}

            {ev.location && (
              <a href={`https://maps.google.com/?q=${ev.location.coordinates?.[1]},${ev.location.coordinates?.[0]}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-600 hover:text-emerald-700">
                <MapPin className="w-3 h-3" /> Ver en mapa
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}
