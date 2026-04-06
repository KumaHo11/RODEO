'use client'

import { useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'

/**
 * Tipos de entidades soportadas para trazabilidad.
 * Extender según crezcan los módulos.
 */
export type TrackedEntityType =
  | 'paddock'
  | 'herd'
  | 'task'
  | 'field_note'
  | 'grazing_plan'
  | 'farm_event'
  | 'bitacora_entry'

export interface RecordContext {
  entityType: TrackedEntityType
  entityId?: string
}

/**
 * useRecordWithContext
 *
 * Hook genérico de trazabilidad. Inyecta automáticamente:
 * - `created_by`  → ID del usuario logueado (profiles.id)
 * - `org_id`      → Organización del usuario
 * - `entity_type` → Tipo de entidad contextual
 * - `entity_id`   → ID de la entidad (ej. paddockId, bitacoraId)
 *
 * Uso:
 * ```ts
 * const { createRecord, updateRecord } = useRecordWithContext({
 *   entityType: 'paddock',
 *   entityId: currentPaddockId,
 * })
 *
 * // Crea nota de campo con trazabilidad completa automática
 * await createRecord('/api/field-notes', {
 *   title: 'Foto post-pastoreo',
 *   content: 'Cobertura del 80%',
 *   photo_url: uploadedUrl,
 * })
 * ```
 */
export function useRecordWithContext(context: RecordContext) {
  const { user, profile } = useAuth()

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return { 'Content-Type': 'application/json' }
    const idToken = await user.getIdToken()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    }
  }, [user])

  /**
   * Inyecta los campos de trazabilidad en el payload
   */
  const enrichPayload = useCallback(
    (data: Record<string, unknown>): Record<string, unknown> => {
      const enriched: Record<string, unknown> = { ...data }

      // Inyectar created_by si no viene en el payload
      if (profile?.id && !enriched.created_by) {
        enriched.created_by = profile.id
      }

      // Inyectar org_id si no viene
      if (profile?.organization_id && !enriched.org_id) {
        enriched.org_id = profile.organization_id
      }

      // Inyectar entity_id según el contexto
      if (context.entityId && !enriched[`${context.entityType}_id`]) {
        enriched[`${context.entityType}_id`] = context.entityId
      }

      return enriched
    },
    [profile, context]
  )

  /**
   * Crea un registro con trazabilidad automática
   * @param endpoint - ruta de la API ej. '/api/field-notes'
   * @param data     - payload a enviar (se enriquece automáticamente)
   */
  const createRecord = useCallback(
    async (
      endpoint: string,
      data: Record<string, unknown>
    ): Promise<{ ok: boolean; data: any; status: number }> => {
      const headers = await getAuthHeaders()
      const enriched = enrichPayload(data)

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(enriched),
      })

      const json = await res.json().catch(() => ({}))
      return { ok: res.ok, data: json, status: res.status }
    },
    [getAuthHeaders, enrichPayload]
  )

  /**
   * Actualiza un registro existente
   * @param endpoint - ruta de la API ej. '/api/field-notes/[id]'
   * @param data     - campos a actualizar
   */
  const updateRecord = useCallback(
    async (
      endpoint: string,
      data: Record<string, unknown>
    ): Promise<{ ok: boolean; data: any; status: number }> => {
      const headers = await getAuthHeaders()

      // Para updates no inyectamos created_by, solo org_id como context
      const enriched: Record<string, unknown> = { ...data }
      if (profile?.organization_id && !enriched.org_id) {
        enriched.org_id = profile.organization_id
      }

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(enriched),
      })

      const json = await res.json().catch(() => ({}))
      return { ok: res.ok, data: json, status: res.status }
    },
    [getAuthHeaders, profile]
  )

  /**
   * Elimina un registro
   */
  const deleteRecord = useCallback(
    async (endpoint: string): Promise<{ ok: boolean; status: number }> => {
      const headers = await getAuthHeaders()
      const res = await fetch(endpoint, { method: 'DELETE', headers })
      return { ok: res.ok, status: res.status }
    },
    [getAuthHeaders]
  )

  return {
    createRecord,
    updateRecord,
    deleteRecord,
    enrichPayload,
    profileId: profile?.id,
    orgId: profile?.organization_id,
  }
}
