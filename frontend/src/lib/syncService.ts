import { getDbPool, queryOne, mutate } from './db'

/**
 * Service to handle Event-Driven Synchronization between modules.
 */

export async function syncGrazingPlanToAgenda(
  orgId: string,
  grazingPlanId: string,
  paddockId: string,
  herdId: string,
  entryDate: string,
  exitDate?: string | null
) {
  try {
    const title = 'Movimiento de Hacienda'
    const eventType = 'MOVEMENT'
    const description = 'Auto-generado desde la carta de pastoreo'

    await mutate(
      `INSERT INTO farm_events 
        (org_id, title, event_type, description, event_date, end_date, related_herd_id, related_paddock_id, impacts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        orgId,
        title,
        eventType,
        description,
        entryDate,
        exitDate || null,
        herdId,
        paddockId,
        JSON.stringify({ grazingPlanId })
      ]
    )
  } catch (err) {
    console.error('Error syncing Grazing Plan to Agenda:', err)
    // No lanzamos el error para no romper la creación del plan, pero lo logueamos
  }
}

/**
 * Cuando se modifica el stock de un Rodeo, validamos si impacta planes.
 * Retorna true si hay planes futuros afectados.
 */
export async function checkHerdUpdateImpact(orgId: string, herdId: string, newTotalEv: number) {
  // Buscamos planes activos o futuros para este rodeo
  const query = `
    SELECT id, entry_date, status 
    FROM grazing_plans 
    WHERE org_id = $1 AND herd_id = $2 
      AND status IN ('PLANNED', 'ACTIVE')
  `
  const result = await getDbPool().query(query, [orgId, herdId])
  return result.rowCount ? result.rowCount > 0 : false
}

/**
 * Cuando se inhabilita un potrero, revisamos si hay planes conflictivos.
 */
export async function checkPaddockDisableImpact(orgId: string, paddockId: string) {
  const query = `
    SELECT id 
    FROM grazing_plans 
    WHERE org_id = $1 AND paddock_id = $2 
      AND status IN ('PLANNED', 'ACTIVE')
  `
  const result = await getDbPool().query(query, [orgId, paddockId])
  return result.rowCount ? result.rowCount > 0 : false
}

/**
 * Optimistic Locking Wrapper
 * Asegura que la versión no haya cambiado antes de actualizar.
 */
export async function optimisticUpdate(
  tableName: string, 
  id: string, 
  orgId: string, 
  clientVersion: number, 
  sets: string[], 
  vals: any[]
) {
  const current = await queryOne<{ version: number }>(
    `SELECT version FROM ${tableName} WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  )

  if (!current) throw new Error('Registro no encontrado')
  if (current.version !== clientVersion) {
    throw new Error('Conflicto: El registro fue modificado por otro usuario. Recarga la página.')
  }

  // Incrementamos versión
  sets.push(`version = version + 1`)
  
  const queryStr = `UPDATE ${tableName} SET ${sets.join(', ')} WHERE id = $${vals.length + 1} AND org_id = $${vals.length + 2}`
  vals.push(id, orgId)
  
  return await mutate(queryStr, vals)
}
