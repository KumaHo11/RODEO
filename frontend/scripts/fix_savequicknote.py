import re

path = '/Users/javi/RODEO/frontend/src/app/dashboard/mi-campo/components/PaddockModal.tsx'
with open(path, 'r') as f:
    content = f.read()

# Fix online upload loop
online_old = """      let photo_url: string | null = null
      if (noteImages.length > 0) {
        try {
          const compressedImage = await compressImage(noteImages[0])
          const fd = new FormData()
          fd.append('file', compressedImage)
          fd.append('folder', 'field-notes')
          const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
          if (up.ok) {
            const upData = await up.json().catch(() => ({}))
            photo_url = upData.url || null
          } else {
            console.warn('[saveQuickNote] photo upload failed:', up.status)
          }
        } catch (err) {
          console.error('[saveQuickNote] compress/upload error:', err)
          throw err // re-throw para que caiga en el catch externo (fallback offline)
        }

        if (!photo_url) {
          toast.error('No se pudo subir la foto al servidor. Verificá tu conexión e intentá de nuevo.')
          setNoteSaving(false)
          return false
        }
      }"""

online_new = """      let photo_url: string | null = null
      let photo_urls: string[] = []
      if (noteImages.length > 0) {
        try {
          for (const img of noteImages) {
            const compressedImage = await compressImage(img)
            const fd = new FormData()
            fd.append('file', compressedImage)
            fd.append('folder', 'field-notes')
            const up = await apiFetch('/api/upload', { method: 'POST', body: fd })
            if (up.ok) {
              const upData = await up.json().catch(() => ({}))
              if (upData.url) photo_urls.push(upData.url)
            } else {
              console.warn('[saveQuickNote] photo upload failed:', up.status)
            }
          }
        } catch (err) {
          console.error('[saveQuickNote] compress/upload error:', err)
          throw err // re-throw para que caiga en el catch externo (fallback offline)
        }

        if (photo_urls.length === 0) {
          toast.error('No se pudieron subir las fotos al servidor. Verificá tu conexión e intentá de nuevo.')
          setNoteSaving(false)
          return false
        }
        photo_url = photo_urls[0]
      }"""
content = content.replace(online_old, online_new)

# Fix fetch payload to include photo_urls
fetch_old = """          content: resolvedContent,
          photo_url,
          audio_url,"""
fetch_new = """          content: resolvedContent,
          photo_url,
          photo_urls,
          audio_url,"""
content = content.replace(fetch_old, fetch_new)

# Fix offline loop
offline_old = """      } else if (noteImages.length > 0) {
        const { savePendingPhoto } = await import('@/lib/audioOfflineStore')
        await savePendingPhoto({
          id: offlineId, blob: noteImages[0], lat: null, lng: null,
          createdAt: new Date().toISOString(), title: offlineTitle,
        }).catch(() => {})
        addToOfflineQueue({
          type: 'field_note',
          data: { paddock_id: paddock.id, category: 'GENERAL', tags: ['GENERAL'], title: offlineTitle, sync_status: 'PENDING' },
          timestamp: Date.now(), mediaType: 'photo', mediaId: offlineId,
        } as any)
      }"""

offline_new = """      } else if (noteImages.length > 0) {
        const { savePendingPhoto } = await import('@/lib/audioOfflineStore')
        const ppIds = []
        for (const img of noteImages) {
          const id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`)
          await savePendingPhoto({
            id: id, blob: img, lat: null, lng: null,
            createdAt: new Date().toISOString(), title: offlineTitle,
          }).catch(() => {})
          ppIds.push(id)
        }
        addToOfflineQueue({
          type: 'field_note',
          data: { paddock_id: paddock.id, category: 'GENERAL', tags: ['GENERAL'], title: offlineTitle, sync_status: 'PENDING' },
          timestamp: Date.now(), mediaType: 'photo', mediaIds: { photos: ppIds },
        } as any)
      }"""
content = content.replace(offline_old, offline_new)

with open(path, 'w') as f:
    f.write(content)
print("Updated saveQuickNote.")
