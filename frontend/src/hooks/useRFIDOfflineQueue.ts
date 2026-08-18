import { useState, useEffect, useCallback } from 'react';
import { openDB, DBSchema } from 'idb';

export type PendingScan = {
  id?: number;
  rfid_code: string;
  timestamp: string;
  device_info?: any;
  paddock_id?: string;
  synced: boolean;
  sync_error?: string;
};

interface RFIDQueueDB extends DBSchema {
  'pending-scans': {
    key: number;
    value: PendingScan;
    indexes: { 'by-timestamp': string; 'by-rfid': string };
  };
}

const DB_NAME = 'rodeo-rfid-queue';
const DB_VERSION = 1;

export function useRFIDOfflineQueue() {
  const [queue, setQueue] = useState<PendingScan[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(typeof window !== 'undefined' ? navigator.onLine : true);
  }, []);

  const initDB = async () => {
    return openDB<RFIDQueueDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pending-scans')) {
          const store = db.createObjectStore('pending-scans', { keyPath: 'id', autoIncrement: true });
          store.createIndex('by-timestamp', 'timestamp');
          store.createIndex('by-rfid', 'rfid_code');
        }
      },
    });
  };

  const loadQueue = useCallback(async () => {
    try {
      const db = await initDB();
      const allScans = await db.getAll('pending-scans');
      const pending = allScans.filter(s => !s.synced);
      setQueue(allScans);
      setPendingCount(pending.length);
    } catch (error) {
      console.error('Failed to load queue:', error);
    }
  }, []);

  const add = async (scan: PendingScan) => {
    try {
      const db = await initDB();
      await db.add('pending-scans', scan);
      await loadQueue();
    } catch (error) {
      console.error('Failed to add scan:', error);
    }
  };

  const syncAll = async () => {
    try {
      const db = await initDB();
      const allScans = await db.getAll('pending-scans');
      const pending = allScans.filter(s => !s.synced);
      
      if (pending.length === 0) return { total: 0, synced: 0, errors: 0 };

      const response = await fetch('/api/animals/rfid-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scans: pending, source: 'BLUETOOTH_RFID' }),
      });

      if (!response.ok) throw new Error('Sync failed');

      const data = await response.json();
      
      const tx = db.transaction('pending-scans', 'readwrite');
      for (const scan of pending) {
        scan.synced = true;
        await tx.store.put(scan as PendingScan & { id: number });
      }
      await tx.done;
      
      await loadQueue();
      return { total: pending.length, synced: data.inserted || pending.length, errors: 0 };
    } catch (error: any) {
      console.error('Sync error:', error);
      return { total: 0, synced: 0, errors: 1 };
    }
  };

  const clearSynced = async () => {
    try {
      const db = await initDB();
      const tx = db.transaction('pending-scans', 'readwrite');
      const store = tx.store;
      let cursor = await store.openCursor();
      while (cursor) {
        if (cursor.value.synced) {
          await cursor.delete();
        }
        cursor = await cursor.continue();
      }
      await tx.done;
      await loadQueue();
    } catch (error) {
      console.error('Failed to clear synced scans:', error);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncAll();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    loadQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadQueue]);

  return {
    queue,
    pendingCount,
    add,
    syncAll,
    clearSynced,
    isOnline
  };
}
