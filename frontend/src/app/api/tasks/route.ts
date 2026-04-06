/**
 * GET  /api/tasks  — Lista de tareas de la organización
 * POST /api/tasks  — Crea una nueva tarea (con notificación automática al asignado)
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseToken } from '@/lib/firebase/verify-token'
import { queryOne, query, mutate } from '@/lib/db'
import { sendEmail } from '@/lib/email'

async function getOrgId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim() || ''
  if (!token) return null
  const decoded = await verifyFirebaseToken(token)
  if (!decoded) return null
  const profile = await queryOne<{ organization_id: string; id: string }>(
    'SELECT organization_id, id FROM profiles WHERE firebase_uid = $1',
    [decoded.uid]
  )
  if (!profile?.organization_id) return null
  return { orgId: profile.organization_id, uid: decoded.uid, profileId: profile.id }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const pending = url.searchParams.get('pending') // "true" for count only
    const today = url.searchParams.get('from_date')
    const limit = url.searchParams.get('limit')

    let sql = `
      SELECT t.*,
        json_build_object('name', p.name) AS paddock,
        json_build_object('first_name', pr.first_name, 'last_name', pr.last_name) AS assignee
      FROM tasks t
      LEFT JOIN paddocks p ON p.id = t.paddock_id
      LEFT JOIN profiles pr ON pr.id = t.assigned_to
      WHERE t.org_id = $1`
    const vals: any[] = [auth.orgId]
    let i = 2

    if (status) { sql += ` AND t.status = $${i++}`; vals.push(status) }
    if (status === null && !pending) {
      // no filter
    }
    if (today) { sql += ` AND t.due_date >= $${i++}`; vals.push(today) }

    sql += ' ORDER BY t.created_at DESC'
    if (limit) { sql += ` LIMIT $${i++}`; vals.push(parseInt(limit)) }

    const tasks = await query(sql, vals)

    return NextResponse.json({ tasks })
  } catch (err: any) {
    console.error('GET /api/tasks error:', err)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getOrgId(req)
    if (!auth) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const {
      title, description, task_type, paddock_id,
      assigned_to, due_date, priority, status
    } = body

    if (!title) return NextResponse.json({ error: 'Título requerido' }, { status: 400 })

    const result = await mutate(
      `INSERT INTO tasks
         (org_id, created_by, title, description, task_type, paddock_id,
          assigned_to, due_date, priority, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        auth.orgId, auth.profileId || null,
        title, description || null,
        task_type || 'GENERAL',
        paddock_id || null, assigned_to || null,
        due_date || null, priority || 'NORMAL',
        status || 'PENDIENTE',
      ]
    )

    const taskId = result.rows[0]?.id as string

    // ── Fire-and-forget: notification + email when task is assigned ───────────
    if (assigned_to && taskId) {
      ;(async () => {
        try {
          const assignee = await queryOne<any>(
            'SELECT id, email, first_name, last_name FROM profiles WHERE id = $1',
            [assigned_to]
          )
          if (!assignee) return

          // In-app notification
          await mutate(
            `INSERT INTO notifications
               (org_id, profile_id, user_id, type, title, message, body, entity_id, entity_type)
             VALUES ($1, $2, $2, 'TAREA', $3, $4, $4, $5, 'task')`,
            [
              auth.orgId,
              assignee.id,
              `Nueva tarea asignada: ${title}`,
              description
                ? `${description}${due_date ? ` • Vence: ${due_date}` : ''}`
                : due_date ? `Vence: ${due_date}` : 'Revisá las tareas pendientes.',
              taskId,
            ]
          )

          // Email notification (fire-and-forget — no await at outer level)
          if (assignee.email) {
            const creator = await queryOne<any>(
              'SELECT first_name, last_name FROM profiles WHERE id = $1',
              [auth.profileId]
            )
            const creatorName = creator
              ? [creator.first_name, creator.last_name].filter(Boolean).join(' ')
              : 'El propietario'
            const assigneeName = [assignee.first_name, assignee.last_name].filter(Boolean).join(' ')
              || assignee.email

            await sendEmail('task_assigned', assignee.email, {
              assigneeName,
              creatorName,
              taskTitle: title,
              taskDescription: description || '',
              dueDate: due_date || '',
              priority: priority || 'NORMAL',
              dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/tareas`,
            }).catch(err => console.warn('[task email] failed:', err.message))
          }
        } catch (notifErr: any) {
          console.warn('[task notification] failed:', notifErr.message)
        }
      })()
    }

    return NextResponse.json({ id: taskId }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/tasks error:', err)
    return NextResponse.json({ error: 'Error del servidor: ' + err.message }, { status: 500 })
  }
}
