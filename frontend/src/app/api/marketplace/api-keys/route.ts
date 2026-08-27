import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json([
    { id: 'k_1', key_prefix: 'rdeo_live_', created_at: '2026-08-18T10:00:00Z', last_used_at: new Date().toISOString() }
  ]);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rawKey = crypto.randomBytes(32).toString('hex');
  const apiKey = `rdeo_live_${rawKey}`;
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // In a real implementation: save keyHash to DB

  return NextResponse.json({ 
    success: true, 
    id: 'k_new', 
    api_key: apiKey, // Solo se devuelve una vez
    key_prefix: 'rdeo_live_' 
  }, { status: 201 });
}
