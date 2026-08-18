import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json([
    { id: 'g_1', grantee_name: 'Frigorífico Pampas SA', grantee_type: 'EXPORTADOR', access_level: 'READ', expires_at: '2026-12-31T23:59:59Z' },
    { id: 'g_2', grantee_name: 'Banco Nación — Crédito Verde', grantee_type: 'BANCO', access_level: 'REPORT', expires_at: null }
  ]);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  return NextResponse.json({ success: true, id: 'g_new', ...body }, { status: 201 });
}
