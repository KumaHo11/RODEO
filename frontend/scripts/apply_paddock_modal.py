import re

path = '/Users/javi/RODEO/frontend/src/app/dashboard/mi-campo/components/PaddockModal.tsx'
with open(path, 'r') as f:
    content = f.read()

# 1. State changes
content = content.replace(
    'const [noteImage, setNoteImage]           = useState<File | null>(null)',
    'const [noteImages, setNoteImages]         = useState<File[]>([])'
)
content = content.replace(
    'const [noteImagePreview, setNoteImagePreview] = useState<string | null>(null)',
    'const [noteImagePreviews, setNoteImagePreviews] = useState<string[]>([])\n  const [aiUpdateProposal, setAiUpdateProposal] = useState<any>(null)\n  const [lightboxImages, setLightboxImages] = useState<string[]>([])\n  const [lightboxIndex, setLightboxIndex] = useState(0)'
)
content = content.replace(
    'setNoteImage(null); setNoteImagePreview(null);',
    'setNoteImages([]); setNoteImagePreviews([]);'
)

# 2. saveQuickNote
content = content.replace(
    'if (noteExpanded && (noteText || audioTranscript || noteImage || audioBlobRef.current)) {',
    'if (noteExpanded && (noteText || audioTranscript || noteImages.length > 0 || audioBlobRef.current)) {'
)
content = content.replace(
    'if (!content && !noteImage && !effectiveBlob) {',
    'if (!content && noteImages.length === 0 && !effectiveBlob) {'
)
content = content.replace(
    'if (!effectiveBlob && !noteImage) {',
    'if (!effectiveBlob && noteImages.length === 0) {'
)

# Replace the save logic for offline queue and photo uploading
old_save_logic_1 = '''      } else if (noteImage) {
        // Guardar nota con foto
        const offlineId = `offline-${Date.now()}`
        await saveMediaForOfflineUpload({
          id: offlineId,
          blob: noteImage,
          lat: null,
          lng: null,
        }, 'photo')
        const payload: any = {
          paddock_id: paddock.id,
          title: noteTitle.trim() || noteImage.name,
          content,
          tags: noteTags,
          is_offline: true,
          offline_id: offlineId
        }
        if (noteResult) payload.analysis_result = noteResult
        await insertLocalFieldNote(payload)
      } else {'''

new_save_logic_1 = '''      } else if (noteImages.length > 0) {
        // Guardar nota con fotos
        const offlineIds = []
        for (let i = 0; i < noteImages.length; i++) {
          const offlineId = `offline-${Date.now()}-${i}`
          await saveMediaForOfflineUpload({ id: offlineId, blob: noteImages[i], lat: null, lng: null }, 'photo')
          offlineIds.push(offlineId)
        }
        const payload: any = {
          paddock_id: paddock.id,
          title: noteTitle.trim() || noteImages[0].name,
          content,
          tags: noteTags,
          is_offline: true,
          offline_photo_ids: offlineIds
        }
        if (noteResult) payload.analysis_result = noteResult
        await insertLocalFieldNote(payload)
      } else {'''
content = content.replace(old_save_logic_1, new_save_logic_1)

old_save_logic_2 = '''      if (noteImage) {
        const formData = new FormData()
        const compressedImage = await compressImage(noteImage)
        formData.append('file', compressedImage)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!uploadRes.ok) throw new Error('Error subiendo imagen')
        const { url } = await uploadRes.json()
        payload.photo_url = url
      }'''
new_save_logic_2 = '''      if (noteImages.length > 0) {
        const urls = []
        for (const img of noteImages) {
          const formData = new FormData()
          const compressedImage = await compressImage(img)
          formData.append('file', compressedImage)
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
          if (!uploadRes.ok) throw new Error('Error subiendo imagen')
          const { url } = await uploadRes.json()
          urls.push(url)
        }
        payload.photo_urls = urls
        if (urls.length > 0) payload.photo_url = urls[0] // Fallback
      }'''
content = content.replace(old_save_logic_2, new_save_logic_2)

content = content.replace(
    'noteImage?.name ||',
    'noteImages[0]?.name ||'
)

old_offline_quick = '''      } else if (noteImage) {
        const offlineId = `offline-${Date.now()}`
        await saveMediaForOfflineUpload({
          id: offlineId, blob: noteImage, lat: null, lng: null,
        }, 'photo')
        await insertLocalFieldNote({
          paddock_id: paddock.id,
          title: 'Registro rápido (Foto)',
          content: 'Foto capturada offline',
          tags: ['GENERAL'],
          is_offline: true,
          offline_id: offlineId
        })
      }'''
new_offline_quick = '''      } else if (noteImages.length > 0) {
        const offlineIds = []
        for (let i = 0; i < noteImages.length; i++) {
          const offlineId = `offline-${Date.now()}-${i}`
          await saveMediaForOfflineUpload({ id: offlineId, blob: noteImages[i], lat: null, lng: null }, 'photo')
          offlineIds.push(offlineId)
        }
        await insertLocalFieldNote({
          paddock_id: paddock.id,
          title: 'Registro rápido (Foto)',
          content: 'Foto capturada offline',
          tags: ['GENERAL'],
          is_offline: true,
          offline_photo_ids: offlineIds
        })
      }'''
content = content.replace(old_offline_quick, new_offline_quick)

content = content.replace(
    '[noteText, audioTranscript, noteImage, noteResult, paddock.id, loadNotes, noteTitle, recording, resetNoteCapture]',
    '[noteText, audioTranscript, noteImages, noteResult, paddock.id, loadNotes, noteTitle, recording, resetNoteCapture]'
)

# 3. analyzeNoteImage
old_analyze = '''  const analyzeNoteImage = useCallback(async () => {
    if (!noteImage) return
    setNoteAnalyzing(true); setNoteError(null); setNoteResult(null)
    try {
      const compressedImage = await compressImage(noteImage)
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1]
          resolve(base64String)
        }
      })
      reader.readAsDataURL(compressedImage)
      const base64Data = await base64Promise

      const reqBody = {
        imagesBase64: [base64Data],
        areaHa,
        paddockName: paddock.name
      }
      const res = await fetch('/api/analyze-biomass', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody)
      })
      if (!res.ok) throw new Error('Error al analizar imagen')
      const data = await res.json()
      setNoteResult(data.result)
    } catch (e: any) { setNoteError(e.message || 'Error de conexión') }
    setNoteAnalyzing(false)
  }, [noteImage, areaHa])'''

new_analyze = '''  const analyzeNoteImage = useCallback(async () => {
    if (noteImages.length === 0) return
    setNoteAnalyzing(true); setNoteError(null); setNoteResult(null); setAiUpdateProposal(null)
    try {
      const imagesBase64 = []
      for (const img of noteImages) {
        const compressedImage = await compressImage(img)
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1]
            resolve(base64String)
          }
        })
        reader.readAsDataURL(compressedImage)
        const base64Data = await base64Promise
        imagesBase64.push(base64Data)
      }

      const reqBody = {
        imagesBase64,
        areaHa,
        paddockName: paddock.name
      }
      const res = await fetch('/api/analyze-biomass', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody)
      })
      if (!res.ok) throw new Error('Error al analizar imagen')
      const data = await res.json()
      setNoteResult(data.result)
      setAiUpdateProposal(data.result)
    } catch (e: any) { setNoteError(e.message || 'Error de conexión') }
    setNoteAnalyzing(false)
  }, [noteImages, areaHa])'''

content = content.replace(old_analyze, new_analyze)

# 4. Inputs and renderings
old_inputs = '''                            <input ref={noteImageRef} type="file" accept="image/*" className="sr-only"
                              onChange={e => { const f = e.target.files?.[0]; if (f) { setNoteImage(f); setNoteImagePreview(URL.createObjectURL(f)); setNoteResult(null) } }} />
                            <input ref={noteCameraRef} type="file" accept="image/*" capture="environment" className="sr-only"
                              onChange={e => { const f = e.target.files?.[0]; if (f) { setNoteImage(f); setNoteImagePreview(URL.createObjectURL(f)); setNoteResult(null) } }} />
                            {noteImagePreview && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={noteImagePreview} alt="preview" className="w-full max-h-36 object-cover rounded-xl" />
                            )}
                            {noteImage && canAiInsight && ('''

new_inputs = '''                            <input ref={noteImageRef} type="file" multiple accept="image/*" className="sr-only"
                              onChange={e => {
                                const files = Array.from(e.target.files || [])
                                if (files.length === 0) return
                                if (noteImages.length + files.length > 5) {
                                  toast.error('Máximo 5 fotos')
                                  return
                                }
                                setNoteImages(prev => [...prev, ...files])
                                setNoteImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
                                setNoteResult(null)
                              }} />
                            <input ref={noteCameraRef} type="file" accept="image/*" capture="environment" className="sr-only"
                              onChange={e => {
                                const files = Array.from(e.target.files || [])
                                if (files.length === 0) return
                                if (noteImages.length + files.length > 5) {
                                  toast.error('Máximo 5 fotos')
                                  return
                                }
                                setNoteImages(prev => [...prev, ...files])
                                setNoteImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
                                setNoteResult(null)
                              }} />
                            {noteImagePreviews.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {noteImagePreviews.map((preview, idx) => (
                                  <div key={idx} className="relative w-20 h-20 group">
                                    <img src={preview} alt="preview" className="w-full h-full object-cover rounded-xl" />
                                    <button type="button" onClick={() => {
                                      setNoteImages(prev => prev.filter((_, i) => i !== idx))
                                      setNoteImagePreviews(prev => prev.filter((_, i) => i !== idx))
                                      setNoteResult(null)
                                    }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {noteImages.length > 0 && canAiInsight && ('''
content = content.replace(old_inputs, new_inputs)

content = content.replace(
    '{noteImage && !canAiInsight && (',
    '{noteImages.length > 0 && !canAiInsight && ('
)

# 5. AI Update Proposal UI replacing noteResult
old_note_result = '''                            {noteResult && (
                              <div className="bg-violet-50 px-3 py-2 rounded-xl border border-violet-200 flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">🌿</span>
                                  <div>
                                    <p className="text-[9px] font-black text-violet-500 tracking-widest uppercase">Resultado IA · Gemini</p>
                                    <p className="text-sm font-black text-violet-900">{Number(noteResult.dry_matter_kg_ha).toLocaleString('es')} kg MS/ha</p>
                                  </div>
                                </div>
                                {(noteResult.pasture_type || noteResult.protein_content_pct) && (
                                  <div className="pl-8 flex flex-col gap-0.5">
                                    {noteResult.pasture_type && <p className="text-xs text-violet-700 font-medium"><span className="font-bold">Tipo:</span> {noteResult.pasture_type}</p>}
                                    {noteResult.protein_content_pct && <p className="text-xs text-violet-700 font-medium"><span className="font-bold">Proteína:</span> {noteResult.protein_content_pct}%</p>}
                                  </div>
                                )}
                              </div>
                            )}'''

new_note_result = '''                            {aiUpdateProposal && (
                              <div className="bg-violet-50 px-3 py-2 rounded-xl border border-violet-200 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">✨</span>
                                    <div>
                                      <p className="text-[9px] font-black text-violet-500 tracking-widest uppercase">Análisis completado</p>
                                      <p className="text-sm font-black text-violet-900">Resultados listos</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="pl-8 flex flex-col gap-0.5 text-xs text-violet-700 font-medium">
                                  <p><span className="font-bold">Materia Seca:</span> {Math.round(aiUpdateProposal.dry_matter_kg_ha)} kg MS/ha</p>
                                  {aiUpdateProposal.pasture_type && <p><span className="font-bold">Tipo:</span> {aiUpdateProposal.pasture_type}</p>}
                                  {aiUpdateProposal.protein_content_pct && <p><span className="font-bold">Proteína:</span> {aiUpdateProposal.protein_content_pct}%</p>}
                                  {aiUpdateProposal.weeds_detected && aiUpdateProposal.weeds_detected.length > 0 && <p><span className="font-bold">Malezas:</span> {aiUpdateProposal.weeds_detected.join(', ')}</p>}
                                </div>
                                <div className="mt-1 flex items-center justify-end gap-2">
                                  <button type="button" onClick={() => setAiUpdateProposal(null)} className="px-3 py-1.5 text-xs font-bold text-violet-600 bg-white border border-violet-200 rounded-lg hover:bg-violet-50">Descartar</button>
                                  <button type="button" onClick={() => {
                                    setMsHa(String(Math.round(aiUpdateProposal.dry_matter_kg_ha)))
                                    if (aiUpdateProposal.weeds_detected?.length > 0) setHasPests(true)
                                    setAiUpdateProposal(null)
                                    toast.success('Valores aplicados al potrero.')
                                  }} className="px-3 py-1.5 text-xs font-bold text-white bg-violet-600 rounded-lg hover:bg-violet-700">Aplicar Datos</button>
                                </div>
                              </div>
                            )}'''
content = content.replace(old_note_result, new_note_result)

content = content.replace(
    '(noteText || audioTranscript || noteImage || audioBlob)',
    '(noteText || audioTranscript || noteImages.length > 0 || audioBlob)'
)

# 6. History rendering - short and long
old_history_photo = '''                              {hasPhoto && (
                                note.photo_url?.startsWith('/uploads/') ? (
                                  <div className="flex items-center gap-1.5 text-[9px] text-gray-400 bg-gray-50 px-3 py-2">
                                    <Camera className="w-3 h-3" />
                                    <span>Imagen no disponible en este entorno</span>
                                  </div>
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={note.photo_url} alt="Evidencia" className="w-full max-h-24 object-cover"
                                    onError={(e) => { const el = e.currentTarget; el.style.display='none'; const fb = document.createElement('div'); fb.className='flex items-center gap-1.5 text-[9px] text-gray-400 bg-gray-50 px-3 py-2'; fb.innerHTML='<span>Imagen no disponible</span>'; el.parentNode?.insertBefore(fb, el.nextSibling) }}
                                  />
                                )
                              )}'''
new_history_photo = '''                              {hasPhoto && (() => {
                                const urls = note.photo_urls?.length ? note.photo_urls : (note.photo_url ? [note.photo_url] : [])
                                return (
                                  <div className={`grid gap-1 px-3 pb-2 ${urls.length === 1 ? 'grid-cols-1' : urls.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                    {urls.map((u: string, idx: number) => u.startsWith('/uploads/') ? (
                                      <div key={idx} className="flex items-center gap-1.5 text-[9px] text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
                                        <Camera className="w-3 h-3" />
                                        <span>Imagen no disponible</span>
                                      </div>
                                    ) : (
                                      <button key={idx} type="button" onClick={() => { setLightboxImages(urls); setLightboxIndex(idx) }} className="relative w-full aspect-square overflow-hidden rounded-lg group">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={u} alt="Evidencia" className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                          onError={(e) => { const el = e.currentTarget; el.style.display='none'; const fb = document.createElement('div'); fb.className='flex items-center justify-center h-full w-full bg-gray-50'; fb.innerHTML='<span class="text-[9px] text-gray-400">Error</span>'; el.parentNode?.insertBefore(fb, el.nextSibling) }}
                                        />
                                      </button>
                                    ))}
                                  </div>
                                )
                              })()}'''
content = content.replace(old_history_photo, new_history_photo)

old_history_photo_2 = '''                              {hasPhoto && (
                                note.photo_url?.startsWith('/uploads/') ? (
                                  <div className="flex items-center gap-1.5 text-[9px] text-gray-400 bg-gray-50 px-3 py-2">
                                    <Camera className="w-3 h-3" />
                                    <span>Imagen no disponible en este entorno</span>
                                  </div>
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={note.photo_url} alt="Evidencia" className="w-full max-h-32 object-cover"
                                    onError={(e) => { const el = e.currentTarget; el.style.display='none'; const fb = document.createElement('div'); fb.className='flex items-center gap-1.5 text-[9px] text-gray-400 bg-gray-50 px-3 py-2'; fb.innerHTML='<span>Imagen no disponible</span>'; el.parentNode?.insertBefore(fb, el.nextSibling) }}
                                  />
                                )
                              )}'''
content = content.replace(old_history_photo_2, new_history_photo)

content = content.replace(
    'line-clamp-3">{note.content}</p>',
    'line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">{note.content}</p>'
)

# 7. Lightbox UI
end_index = content.find('  if (typeof document === \'undefined\') return null')
if end_index != -1:
    lightbox_str = '''  const lightboxModal = lightboxImages.length > 0 ? (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="absolute top-4 right-4 flex gap-4">
        <button onClick={() => setLightboxImages([])} className="text-white hover:text-gray-300 p-2">
          <X className="w-8 h-8" />
        </button>
      </div>
      {lightboxImages.length > 1 && (
        <>
          <button onClick={() => setLightboxIndex(i => (i > 0 ? i - 1 : lightboxImages.length - 1))} className="absolute left-4 text-white hover:text-gray-300 p-2 bg-black/50 rounded-full">
            <ChevronDown className="w-8 h-8 rotate-90" />
          </button>
          <button onClick={() => setLightboxIndex(i => (i < lightboxImages.length - 1 ? i + 1 : 0))} className="absolute right-4 text-white hover:text-gray-300 p-2 bg-black/50 rounded-full">
            <ChevronDown className="w-8 h-8 -rotate-90" />
          </button>
        </>
      )}
      <img src={lightboxImages[lightboxIndex]} alt="fullscreen" className="max-w-full max-h-full object-contain" />
    </div>
  ) : null

'''
    content = content[:end_index] + lightbox_str + content[end_index:]

content = content.replace(
    '{createPortal(waterCalcModal ?? <></>, document.body)}\n    </>',
    '{createPortal(waterCalcModal ?? <></>, document.body)}\n      {createPortal(lightboxModal ?? <></>, document.body)}\n    </>'
)

with open(path, 'w') as f:
    f.write(content)
print("Applied successfully.")
