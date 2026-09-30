'use client'
// Offline compatibility shim — OfflineManager is removed. App is online-only.
export const addToOfflineQueue = (..._args: any[]) => {}
export const useOfflineStatus = () => ({ isOffline: false, isOnline: true })
export default function OfflineManager() { return null }
