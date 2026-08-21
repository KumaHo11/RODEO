'use client';

import React from 'react';
import { useBluetoothRFID } from '@/hooks/useBluetoothRFID';
import { useRFIDOfflineQueue } from '@/hooks/useRFIDOfflineQueue';
import { RFIDImporter } from '@/components/RFIDImporter';
import { Bluetooth, AlertTriangle, RefreshCw, Check, ClipboardList } from 'lucide-react';

export default function RFIDScanPage() {
  const {
    status,
    device,
    scanHistory,
    isSupported,
    errorMsg,
    connect,
    disconnect
  } = useBluetoothRFID();

  const {
    pendingCount,
    syncAll,
    isOnline
  } = useRFIDOfflineQueue();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Bluetooth className="w-6 h-6 text-blue-600" /> Escaneo RFID
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Lector Bluetooth */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Lector Bluetooth</h3>
          
          <div className="flex items-center gap-2 mb-4">
            <span className="text-gray-500">Estado:</span>
            <span className={`${status === 'connected' || status === 'reading' ? 'text-emerald-600 font-semibold' : 'text-gray-500 font-medium'}`}>
              {status === 'idle' ? '● Desconectado' : 
               status === 'scanning' ? '● Buscando...' : 
               `● Conectado (${device?.name || 'Dispositivo'})`}
            </span>
          </div>

          {!isSupported && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Web Bluetooth no está soportado en este navegador. Usa la importación USB.
            </div>
          )}

          {errorMsg && (
            <div className="text-sm text-red-600 mb-4">
              Error: {errorMsg}
            </div>
          )}

          {status === 'idle' || status === 'error' ? (
            <button
              onClick={connect}
              disabled={!isSupported}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Conectar lector Bluetooth
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="w-full border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl py-2.5 font-semibold"
            >
              Desconectar
            </button>
          )}
        </div>

        {/* Importador USB / CSV */}
        <RFIDImporter />
      </div>

      {/* Queue Offline */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 font-semibold text-amber-800">
                <RefreshCw className="w-4 h-4" />
                Pendientes de sync: {pendingCount}
              </div>
              <p className="text-sm text-amber-700">Lecturas guardadas localmente.</p>
            </div>
          <button
            onClick={syncAll}
            disabled={!isOnline}
            className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 font-semibold"
          >
            Sincronizar ahora
          </button>
        </div>
      )}

      {/* Historial de sesión */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 font-semibold text-gray-900 mb-4">
          <ClipboardList className="w-4 h-4 text-gray-500" />
          Lecturas de esta sesión ({scanHistory.length})
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="pb-3 font-semibold">EID</th>
                <th className="pb-3 font-semibold">Animal</th>
                <th className="pb-3 font-semibold">Hora</th>
                <th className="pb-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {scanHistory.map((scan, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
                  <td className="py-3 font-mono text-sm text-gray-900">{scan.rfid}</td>
                  <td className="py-3 text-sm">
                    {scan.animal ? (
                      <span className="font-medium text-gray-900">{scan.animal.visual_tag || scan.animal.name || 'Sin Caravana'}</span>
                    ) : (
                      <span className="text-gray-500 italic">No encontrado</span>
                    )}
                  </td>
                  <td className="py-3 text-sm text-gray-500">
                    {scan.timestamp.toLocaleTimeString()}
                  </td>
                  <td className="py-3 text-sm">
                    {scan.animal ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Sync
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> Nuevo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {scanHistory.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500 text-sm">
                    No hay lecturas en esta sesión.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
