/**
 * lib/offline/db.ts
 * Base de datos IndexedDB central para RODEO offline-first.
 * Usa `idb` como wrapper moderno (1KB gz) sobre la API raw.
 *
 * Stores:
 *  paddocks      → datos de potreros
 *  herds         → rodeos y lotes
 *  farm_events   → eventos (agenda + historial)
 *  field_notes   → bitácora
 *  tasks         → tareas
 *  organizations → datos de la org/campo
 *  grazing_plans → planes de pastoreo
 *  outbox        → cola de operaciones pendientes (Outbox Pattern)
 *  meta          → timestamps, versiones, flags
 */

import { openDB, IDBPDatabase, DBSchema } from 'idb'

// ── Schema ────────────────────────────────────────────────────────────────────

interface OutboxItem {
  id: string
  type: string          // 'farm_event' | 'task' | 'field_note' | 'paddock_update' | ...
  url: string           // endpoint destino
  method: string        // POST | PATCH | DELETE
  body: string          // JSON serializado
  headers: Record<string, string>
  idempotency_key: string
  created_at: number    // timestamp ms
  attempts: number      // reintentos
  last_error?: string
  mediaType?: string
  mediaId?: string
  mediaIds?: any
}

interface RodeoDBSchema extends DBSchema {
  paddocks: {
    key: string
    value: { id: string; data: any; updated_at: number }
    indexes: { by_updated: number }
  }
  herds: {
    key: string
    value: { id: string; data: any; updated_at: number }
    indexes: { by_updated: number }
  }
  farm_events: {
    key: string
    value: { id: string; data: any; updated_at: number }
    indexes: { by_updated: number; by_date: string }
  }
  field_notes: {
    key: string
    value: { id: string; data: any; updated_at: number }
    indexes: { by_updated: number }
  }
  tasks: {
    key: string
    value: { id: string; data: any; updated_at: number }
    indexes: { by_updated: number }
  }
  organizations: {
    key: string
    value: { id: string; data: any; updated_at: number }
  }
  grazing_plans: {
    key: string
    value: { id: string; data: any; updated_at: number }
    indexes: { by_updated: number }
  }
  calculator_state: {
    key: string
    value: { id: string; data: any; updated_at: number }
  }
  dashboard_cache: {
    key: string
    value: { id: string; data: any; updated_at: number }
  }
  team_members: {
    key: string
    value: { id: string; data: any; updated_at: number }
    indexes: { by_updated: number }
  }
  invitations: {
    key: string
    value: { id: string; data: any; updated_at: number; status: string }
    indexes: { by_updated: number; by_status: string }
  }
  outbox: {
    key: string
    value: OutboxItem
    indexes: { by_created: number; by_type: string }
  }
  meta: {
    key: string
    value: { key: string; value: any }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

const DB_NAME    = 'rodeo-offline-db'
const DB_VERSION = 3

let _dbPromise: Promise<IDBPDatabase<RodeoDBSchema>> | null = null

function getDB(): Promise<IDBPDatabase<RodeoDBSchema>> {
  if (!_dbPromise) {
    _dbPromise = openDB<RodeoDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        // ── v1 stores ──────────────────────────────────────────────────────
        if (oldVersion < 1) {
          // paddocks
          const paddockStore = db.createObjectStore('paddocks', { keyPath: 'id' })
          paddockStore.createIndex('by_updated', 'updated_at')

          // herds
          const herdStore = db.createObjectStore('herds', { keyPath: 'id' })
          herdStore.createIndex('by_updated', 'updated_at')

          // farm_events
          const eventsStore = db.createObjectStore('farm_events', { keyPath: 'id' })
          eventsStore.createIndex('by_updated', 'updated_at')
          eventsStore.createIndex('by_date', 'data.event_date')

          // field_notes
          const notesStore = db.createObjectStore('field_notes', { keyPath: 'id' })
          notesStore.createIndex('by_updated', 'updated_at')

          // tasks
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' })
          tasksStore.createIndex('by_updated', 'updated_at')

          // organizations (single record per session)
          db.createObjectStore('organizations', { keyPath: 'id' })

          // grazing_plans
          const plansStore = db.createObjectStore('grazing_plans', { keyPath: 'id' })
          plansStore.createIndex('by_updated', 'updated_at')

          // outbox
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' })
          outboxStore.createIndex('by_created', 'created_at')
          outboxStore.createIndex('by_type', 'type')

          // meta
          db.createObjectStore('meta', { keyPath: 'key' })
        }

        // ── v2 stores: calculadora + dashboard cache ─────────────────────
        if (oldVersion < 2) {
          // calculator_state — persistir inputs/resultados de la calculadora
          if (!db.objectStoreNames.contains('calculator_state')) {
            db.createObjectStore('calculator_state', { keyPath: 'id' })
          }
          // dashboard_cache — cachear datos computados del panel principal
          if (!db.objectStoreNames.contains('dashboard_cache')) {
            db.createObjectStore('dashboard_cache', { keyPath: 'id' })
          }
        }

        // ── v3 stores: equipo + invitaciones ───────────────────────────
        if (oldVersion < 3) {
          // team_members — datos de miembros del equipo para uso offline
          if (!db.objectStoreNames.contains('team_members')) {
            const tmStore = db.createObjectStore('team_members', { keyPath: 'id' })
            tmStore.createIndex('by_updated', 'updated_at')
          }
          // invitations — invitaciones pendientes (se envían al reconectar)
          if (!db.objectStoreNames.contains('invitations')) {
            const invStore = db.createObjectStore('invitations', { keyPath: 'id' })
            invStore.createIndex('by_updated', 'updated_at')
            invStore.createIndex('by_status', 'status')
          }
        }
      },
    })
  }
  return _dbPromise
}

// ── Generic helpers ───────────────────────────────────────────────────────────

type StoreNames = 'paddocks' | 'herds' | 'farm_events' | 'field_notes' | 'tasks' | 'organizations' | 'grazing_plans' | 'calculator_state' | 'dashboard_cache' | 'team_members' | 'invitations' | 'outbox'

/** Devuelve todos los registros de un store como array de `data` */
export async function dbGetAll(store: StoreNames): Promise<any[]> {
  try {
    const db = await getDB()
    const all = await db.getAll(store as any)
    return all.map((r: any) => r.data)
  } catch (err) {
    console.warn(`[db] getAll(${store}) failed:`, err)
    return []
  }
}

/** Devuelve un registro por id */
export async function dbGet(store: StoreNames, id: string): Promise<any | null> {
  try {
    const db = await getDB()
    const rec = await db.get(store as any, id)
    return rec ? rec.data : null
  } catch (err) {
    console.warn(`[db] get(${store}, ${id}) failed:`, err)
    return null
  }
}

/** Guarda/actualiza un registro (upsert). Usa `id` del objeto como key. */
export async function dbUpsert(store: StoreNames, data: any): Promise<void> {
  try {
    const db = await getDB()
    const id = data.id ?? `local-${Date.now()}`
    await db.put(store as any, { id, data, updated_at: Date.now() })
  } catch (err) {
    console.warn(`[db] upsert(${store}) failed:`, err)
  }
}

/** Guarda un array completo de registros (bulk upsert) */
export async function dbUpsertMany(store: StoreNames, items: any[]): Promise<void> {
  if (!items?.length) return
  try {
    const db = await getDB()
    const tx = db.transaction(store as any, 'readwrite')
    const now = Date.now()
    await Promise.all([
      ...items.map(item =>
        (tx.store as any).put({ id: item.id ?? `local-${Math.random()}`, data: item, updated_at: now })
      ),
      tx.done,
    ])
  } catch (err) {
    console.warn(`[db] upsertMany(${store}) failed:`, err)
  }
}

/** Elimina un registro por id */
export async function dbDelete(store: StoreNames, id: string): Promise<void> {
  try {
    const db = await getDB()
    await db.delete(store as any, id)
  } catch (err) {
    console.warn(`[db] delete(${store}, ${id}) failed:`, err)
  }
}

/** Limpia todos los registros de un store */
export async function dbClear(store: StoreNames): Promise<void> {
  try {
    const db = await getDB()
    await db.clear(store as any)
  } catch (err) {
    console.warn(`[db] clear(${store}) failed:`, err)
  }
}

// ── Meta helpers ──────────────────────────────────────────────────────────────

export async function metaGet(key: string): Promise<any> {
  try {
    const db = await getDB()
    const rec = await db.get('meta', key)
    return rec ? rec.value : null
  } catch { return null }
}

export async function metaSet(key: string, value: any): Promise<void> {
  try {
    const db = await getDB()
    await db.put('meta', { key, value })
  } catch (err) {
    console.warn(`[db] metaSet(${key}) failed:`, err)
  }
}

// ── Outbox helpers ────────────────────────────────────────────────────────────

export async function outboxPush(item: Omit<OutboxItem, 'id' | 'created_at' | 'attempts'>): Promise<string> {
  const db = await getDB()
  const id = `outbox-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const record: OutboxItem = { ...item, id, created_at: Date.now(), attempts: 0 }
  await db.put('outbox', record)
  return id
}

export async function outboxGetAll(): Promise<OutboxItem[]> {
  try {
    const db = await getDB()
    return await db.getAllFromIndex('outbox', 'by_created')
  } catch { return [] }
}

export async function outboxDelete(id: string): Promise<void> {
  try {
    const db = await getDB()
    await db.delete('outbox', id)
  } catch { /* ignore */ }
}

export async function outboxUpdate(id: string, updates: Partial<OutboxItem>): Promise<void> {
  try {
    const db = await getDB()
    const existing = await db.get('outbox', id)
    if (existing) await db.put('outbox', { ...existing, ...updates })
  } catch { /* ignore */ }
}

export async function outboxCount(): Promise<number> {
  try {
    const db = await getDB()
    return await db.count('outbox')
  } catch { return 0 }
}

// ── Organizations store (single record) ───────────────────────────────────────

export async function dbGetOrg(): Promise<any | null> {
  try {
    const db = await getDB()
    const all = await db.getAll('organizations')
    return all.length > 0 ? all[0].data : null
  } catch { return null }
}

export async function dbUpsertOrg(data: any): Promise<void> {
  try {
    const db = await getDB()
    // Use org id or fallback to 'org'
    const id = data.id ?? 'org'
    await db.put('organizations', { id, data, updated_at: Date.now() })
  } catch (err) {
    console.warn('[db] upsertOrg failed:', err)
  }
}
