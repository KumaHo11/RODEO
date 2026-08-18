import { NextResponse } from 'next/server';
import { queryOne, mutate } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { rfid_code, timestamp, device_info, paddock_id } = await req.json();

    if (!rfid_code) {
      return NextResponse.json({ error: 'Missing rfid_code' }, { status: 400 });
    }

    // Lookup animal by rfid_code
    const animal = await queryOne(`
      SELECT id, org_id, visual_tag, name, status, current_paddock_id 
      FROM animals 
      WHERE rfid_code = $1
    `, [rfid_code]);

    if (!animal) {
      return NextResponse.json({ found: false, rfid_code });
    }

    // Insert animal_event
    await mutate(`
      INSERT INTO animal_events (org_id, animal_id, event_type, event_date, source, device_info, details)
      VALUES ($1, $2, 'LECTURA_RFID', $3, 'BLUETOOTH_RFID', $4, $5)
    `, [
      animal.org_id,
      animal.id,
      timestamp || new Date().toISOString(),
      device_info || null,
      JSON.stringify({
        paddock_id: paddock_id || animal.current_paddock_id,
        rfid_code
      })
    ]);

    return NextResponse.json({ found: true, animal });

  } catch (error: any) {
    console.error('RFID scan sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
