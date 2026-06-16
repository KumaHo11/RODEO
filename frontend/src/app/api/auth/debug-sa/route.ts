import { NextResponse } from 'next/server';

export async function GET() {
  const b64 = process.env.FIREBASE_ADMIN_CREDENTIALS_BASE64;
  if (!b64) return NextResponse.json({ error: 'No SA' });
  try {
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    return NextResponse.json({ 
      client_email: json.client_email,
      project_id: json.project_id
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}
