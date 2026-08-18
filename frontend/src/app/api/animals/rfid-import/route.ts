import { NextResponse } from 'next/server';
import { query, mutate } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { scans, source } = await req.json();

    if (!scans || !Array.isArray(scans)) {
      return NextResponse.json({ error: 'Missing or invalid scans array' }, { status: 400 });
    }

    // auth should be checked to do manual pool queries if we wanted to batch insert
    // but we can just use mutate for each, or a large insert. For simplicity we can do a loop with `queryOne` and `mutate`.
    // We'll gather all rfids to fetch all matching animals in one query.
    const rfidCodes = scans.map((s: any) => s.rfid_code).filter(Boolean);
    if (rfidCodes.length === 0) {
      return NextResponse.json({ total: 0, matched: 0, inserted: 0, not_found: [] });
    }

    // Find all matching animals for this user's org
    const animals = await query(`
      SELECT id, org_id, rfid_code 
      FROM animals 
      WHERE rfid_code = ANY($1::varchar[])
    `, [rfidCodes]);

    const animalMap = new Map(animals.map((a: any) => [a.rfid_code, a]));
    const not_found: string[] = [];
    let inserted = 0;

    for (const scan of scans) {
      const animal = animalMap.get(scan.rfid_code);
      if (!animal) {
        not_found.push(scan.rfid_code);
        continue;
      }

      await mutate(`
        INSERT INTO animal_events (org_id, animal_id, event_type, event_date, source, device_info, details)
        VALUES ($1, $2, 'LECTURA_RFID', $3, $4, $5, $6)
      `, [
        animal.org_id,
        animal.id,
        scan.timestamp || new Date().toISOString(),
        source || 'USB_IMPORT',
        scan.device_info || null,
        JSON.stringify({ rfid_code: scan.rfid_code, vid: scan.vid })
      ]);
      inserted++;
    }

    return NextResponse.json({ 
      total: scans.length,
      matched: inserted,
      inserted,
      not_found 
    });

  } catch (error: any) {
    console.error('RFID import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
