/**
 * lib/offline/prefetch.ts
 * Pre-fetching automático de datos al detectar conexión online.
 *
 * Descarga de forma incremental (solo si los datos tienen > 5 minutos)
 * y almacena en IndexedDB como fuente de verdad local.
 *
 * Secciones cubiertas:
 *  - Panel (organizations, paddocks, herds)
 *  - Rodeos (herds)
 *  - Potreros / Mi Campo (paddocks, organizations)
 *  - Agenda (farm_events)
 *  - Bitácora (field_notes)
 *  - Tareas (tasks, paddocks)
 *  - Clima (se cachea en el store meta como JSON)
 *  - Calculadora (solo lógica local — no requiere datos)
 */

import {
  dbUpsertMany, dbUpsertOrg, dbUpsert, metaGet, metaSet,
  dbClear,
} from './db'

const PREFETCH_TTL_MS = 5 * 60 * 1000  // 5 minutos

type FetchFn = (url: string, opts?: RequestInit) => Promise<Response>

// ── Internals ─────────────────────────────────────────────────────────────────

let _isPrefetching = false

async function needsRefresh(storeKey: string): Promise<boolean> {
  const lastFetch = await metaGet(`prefetch_ts_${storeKey}`)
  if (!lastFetch) return true
  return Date.now() - lastFetch > PREFETCH_TTL_MS
}

async function markFetched(storeKey: string): Promise<void> {
  await metaSet(`prefetch_ts_${storeKey}`, Date.now())
}

/** Error especial para abortar el prefetch cuando la sesión es inválida */
class AuthExpiredError extends Error {
  constructor() { super('AuthExpired'); this.name = 'AuthExpiredError' }
}

async function safeFetch(url: string, token: string, retries = 2): Promise<any | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000) // 15s
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'same-origin',
        signal: controller.signal,
      })
      clearTimeout(timeout)

      // 401 → sesión expirada: abortar toda la sincronización
      if (res.status === 401) {
        throw new AuthExpiredError()
      }

      if (!res.ok) return null
      return res.json()
    } catch (err: any) {
      if (err instanceof AuthExpiredError) throw err   // propagar sin reintentar

      const isLastAttempt = attempt === retries
      if (isLastAttempt) return null   // error de red / timeout — silencioso

      // Backoff exponencial: 500ms primer reintento, 1000ms segundo
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)))
    }
  }
  return null
}

// ── Main prefetch ─────────────────────────────────────────────────────────────

/**
 * Ejecuta el pre-fetch de todos los stores.
 * - Solo descarga lo que tiene más de 5 minutos (configurable)
 * - No bloquea la UI — corre en background
 * - `token` debe ser el Firebase ID token del usuario actual
 */
export async function prefetchAll(token: string): Promise<void> {
  if (_isPrefetching) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  _isPrefetching = true
  console.log('[prefetch] Starting background prefetch...')

  try {
    // Ejecutamos en paralelo para ser rápidos, pero con límite
    const results = await Promise.allSettled([
      prefetchPaddocks(token),
      prefetchHerds(token),
      prefetchFarmEvents(token),
      prefetchFieldNotes(token),
      prefetchTasks(token),
      prefetchOrganization(token),
      prefetchGrazingPlans(token),
      prefetchTeam(token),
    ])

    // Detectar si alguna promesa falló por sesión expirada (401)
    const authExpired = results.some(
      r => r.status === 'rejected' && r.reason?.name === 'AuthExpiredError'
    )

    if (authExpired) {
      console.warn('[prefetch] Session expired (401) — aborting prefetch and notifying app')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rodeo_auth_expired', {
          detail: { source: 'prefetch' }
        }))
      }
      return
    }

    console.log('[prefetch] Done.')
    // Notificar a la app que los datos están listos
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rodeo_prefetch_done'))
    }
  } finally {
    _isPrefetching = false
  }
}

// ── Individual store fetchers ─────────────────────────────────────────────────

async function prefetchPaddocks(token: string): Promise<void> {
  if (!(await needsRefresh('paddocks'))) return
  const data = await safeFetch('/api/paddocks', token)
  if (!data) return
  const paddocks = data.paddocks ?? []
  await dbUpsertMany('paddocks', paddocks)
  await markFetched('paddocks')
  console.log(`[prefetch] paddocks: ${paddocks.length} records`)
}

async function prefetchHerds(token: string): Promise<void> {
  if (!(await needsRefresh('herds'))) return
  const data = await safeFetch('/api/herds', token)
  if (!data) return
  const herds = data.herds ?? []
  await dbUpsertMany('herds', herds)
  await markFetched('herds')
  console.log(`[prefetch] herds: ${herds.length} records`)
}

async function prefetchFarmEvents(token: string): Promise<void> {
  if (!(await needsRefresh('farm_events'))) return
  // Últimos 500 eventos es suficiente para uso offline
  const data = await safeFetch('/api/farm-events?limit=500', token)
  if (!data) return
  const events = data.events ?? []
  await dbUpsertMany('farm_events', events)
  await markFetched('farm_events')
  console.log(`[prefetch] farm_events: ${events.length} records`)
}

async function prefetchFieldNotes(token: string): Promise<void> {
  if (!(await needsRefresh('field_notes'))) return
  const data = await safeFetch('/api/field-notes?limit=200', token)
  if (!data) return
  const notes = data.notes ?? []
  await dbUpsertMany('field_notes', notes)
  await markFetched('field_notes')
  console.log(`[prefetch] field_notes: ${notes.length} records`)
}

async function prefetchTasks(token: string): Promise<void> {
  if (!(await needsRefresh('tasks'))) return
  const data = await safeFetch('/api/tasks', token)
  if (!data) return
  const tasks = data.tasks ?? []
  await dbUpsertMany('tasks', tasks)
  await markFetched('tasks')
  console.log(`[prefetch] tasks: ${tasks.length} records`)
}

async function prefetchOrganization(token: string): Promise<void> {
  if (!(await needsRefresh('organization'))) return
  const data = await safeFetch('/api/organizations', token)
  if (!data) return
  const org = data.organization ?? data.org ?? null
  if (org) {
    await dbUpsertOrg(org)
    await markFetched('organization')
    console.log('[prefetch] organization: 1 record')
  }
}

async function prefetchGrazingPlans(token: string): Promise<void> {
  if (!(await needsRefresh('grazing_plans'))) return
  const data = await safeFetch('/api/grazing-plans', token)
  if (!data) return
  const plans = data.plans ?? []
  await dbUpsertMany('grazing_plans', plans)
  await markFetched('grazing_plans')
  console.log(`[prefetch] grazing_plans: ${plans.length} records`)
}

async function prefetchTeam(token: string): Promise<void> {
  if (!(await needsRefresh('team'))) return
  const data = await safeFetch('/api/team', token)
  if (!data) return
  const members = data.members ?? []
  const invitations = data.invitations ?? []
  await dbUpsertMany('team_members', members)
  await dbUpsertMany('invitations', invitations)
  await markFetched('team')
  console.log(`[prefetch] team: ${members.length} members, ${invitations.length} invitations`)
}

// ── Force refresh ─────────────────────────────────────────────────────

/** Fuerza un re-fetch completo ignorando TTL */
export async function prefetchForce(token: string): Promise<void> {
  await Promise.allSettled([
    metaSet('prefetch_ts_paddocks', 0),
    metaSet('prefetch_ts_herds', 0),
    metaSet('prefetch_ts_farm_events', 0),
    metaSet('prefetch_ts_field_notes', 0),
    metaSet('prefetch_ts_tasks', 0),
    metaSet('prefetch_ts_organization', 0),
    metaSet('prefetch_ts_grazing_plans', 0),
    metaSet('prefetch_ts_team', 0),
  ])
  await prefetchAll(token)
}
