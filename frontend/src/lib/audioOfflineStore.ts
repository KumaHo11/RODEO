// Offline compatibility shim — all functions are no-ops (app is online-only)
// The return type of getPending* is 'any' to avoid TS errors in call sites
// that used to receive objects with .blob property from the real IDB store.

export const savePendingPhoto = async (..._args: any[]): Promise<void> => {}
export const savePendingAudio = async (..._args: any[]): Promise<void> => {}
export const getPendingPhoto = async (_id: string): Promise<any> => null
export const getPendingAudio = async (_id: string): Promise<any> => null
export const deletePendingPhoto = async (_id: string): Promise<void> => {}
export const deletePendingAudio = async (_id: string): Promise<void> => {}

export interface PendingAudio {
  id: string
  blob: Blob
  durationSecs: number
  lat: number | null
  lng: number | null
  createdAt: string
  title: string
  transcript?: string
}

export interface PendingPhoto {
  id: string
  blob: Blob
  lat: number | null
  lng: number | null
  createdAt: string
  title: string
}
