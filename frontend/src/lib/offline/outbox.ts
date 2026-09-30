// Offline compatibility shim — all functions are no-ops (app is online-only)
// This shim prevents build errors in components that still reference old offline functions.
// Can be removed once all call sites are cleaned up.

export const enqueue = async (..._args: any[]) => { /* no-op */ }
export const dbGetAll = async (_store: string) => []
export const dbUpsertMany = async (_store: string, _data: any[]) => {}
export const dbUpsert = async (_store: string, _data: any) => {}
export const dbDelete = async (_store: string, _id: string) => {}
export const dbGetOrg = async () => null
export const dbUpsertOrg = async (_data: any) => {}
export const outboxGetAll = async () => []
export const metaGet = async (_key: string) => null
export const metaSet = async (_key: string, _value: any) => {}
export const savePendingPhoto = async (..._args: any[]) => {}
export const savePendingAudio = async (..._args: any[]) => {}
export const getPendingPhoto = async (_id: string): Promise<Blob | null> => null
export const getPendingAudio = async (_id: string): Promise<Blob | null> => null
export const deletePendingPhoto = async (_id: string) => {}
export const deletePendingAudio = async (_id: string) => {}
export const addToOfflineQueue = (..._args: any[]) => {}
export const useOfflineStatus = () => ({ isOffline: false, isOnline: true })
export const isOffline = async () => false
