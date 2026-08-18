'use client';
import React, { useState } from 'react';

type ParsedScan = {
  eid: string;
  date?: string;
  vid?: string;
};

export function RFIDImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [scans, setScans] = useState<ParsedScan[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const parseFile = async (selectedFile: File) => {
    setFile(selectedFile);
    const text = await selectedFile.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    let parsed: ParsedScan[] = [];
    
    // Check header
    if (lines[0].toLowerCase().includes('eid')) {
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const eidIndex = headers.indexOf('eid');
      const vidIndex = headers.indexOf('vid');
      const dateIndex = headers.findIndex(h => h.includes('date'));
      
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length > eidIndex) {
          const eidStr = parts[eidIndex].replace(/[^0-9]/g, '');
          if (eidStr.length === 15) {
            parsed.push({
              eid: eidStr,
              date: dateIndex !== -1 ? parts[dateIndex] : undefined,
              vid: vidIndex !== -1 ? parts[vidIndex] : undefined,
            });
          }
        }
      }
    } else {
      // Generic one column fallback
      for (const line of lines) {
        const eidStr = line.replace(/[^0-9]/g, '');
        if (eidStr.length === 15) {
          parsed.push({ eid: eidStr });
        }
      }
    }
    
    setScans(parsed);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseFile(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    if (!scans.length) return;
    setImporting(true);
    try {
      const res = await fetch('/api/animals/rfid-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scans: scans.map(s => ({
            rfid_code: s.eid,
            timestamp: s.date ? new Date(s.date).toISOString() : new Date().toISOString(),
            vid: s.vid
          })),
          source: 'USB_IMPORT'
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
      setResult({ errors: ['Network error'] });
    }
    setImporting(false);
  };

  return (
    <div className="border p-4 rounded-lg bg-white shadow-sm mt-4">
      <h3 className="font-semibold mb-2">📁 Importar CSV/USB</h3>
      
      {!file && (
        <div 
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-gray-300 p-8 text-center rounded bg-gray-50 cursor-pointer"
          onClick={() => document.getElementById('rfid-file-upload')?.click()}
        >
          Arrastra un archivo .csv o .txt aquí, o haz clic para seleccionar
          <input 
            id="rfid-file-upload" 
            type="file" 
            accept=".csv,.txt" 
            className="hidden" 
            onChange={e => e.target.files && parseFile(e.target.files[0])}
          />
        </div>
      )}

      {file && (
        <div className="mt-4">
          <p className="text-sm text-gray-600">Archivo: {file.name} - Detectadas {scans.length} lecturas</p>
          
          <div className="max-h-40 overflow-y-auto mt-2 text-sm border p-2 rounded bg-gray-50">
            {scans.slice(0, 10).map((s, i) => (
              <div key={i}>{s.eid} {s.vid ? `(VID: ${s.vid})` : ''}</div>
            ))}
            {scans.length > 10 && <div className="text-gray-400">...y {scans.length - 10} más</div>}
          </div>

          {!result && (
            <button 
              onClick={handleImport} 
              disabled={importing}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {importing ? 'Importando...' : `Importar ${scans.length} lecturas`}
            </button>
          )}

          {result && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
              <p>✅ Importación finalizada.</p>
              <p>Total: {result.total} | Actualizados: {result.matched} | Insertados: {result.inserted}</p>
              {result.not_found?.length > 0 && (
                <p className="text-orange-600 mt-2">⚠️ No encontrados: {result.not_found.length}</p>
              )}
              <button onClick={() => { setFile(null); setScans([]); setResult(null); }} className="mt-2 text-blue-600 underline">
                Importar otro archivo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
