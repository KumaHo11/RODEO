import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-auth';
// Import db query if needed: import { serviceQuery } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await verifyApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Invalid or expired API Key.' }, { status: 401 });
  }

  // Get params
  const url = new URL(req.url);
  const metricType = url.searchParams.get('metric_type');
  const paddockId = url.searchParams.get('paddock_id');
  const dateFrom = url.searchParams.get('date_from');
  const dateTo = url.searchParams.get('date_to');
  const limit = parseInt(url.searchParams.get('limit') || '100');

  // Validate basic scopes
  if (!auth.scopes.includes('metrics:read') && !auth.scopes.includes('full')) {
    return NextResponse.json({ error: 'Forbidden. Insufficient scopes.' }, { status: 403 });
  }

  // Mock response for the B2B API v2
  const mockData = [
    {
      id: 'm_123',
      metric_type: metricType || 'NDVI',
      value: 0.65,
      paddock_id: paddockId || 'p_456',
      date: dateTo || new Date().toISOString().split('T')[0],
      source: 'Sentinel-2'
    },
    {
      id: 'm_124',
      metric_type: metricType || 'NDVI',
      value: 0.63,
      paddock_id: paddockId || 'p_456',
      date: dateFrom || new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
      source: 'Sentinel-2'
    }
  ];

  return NextResponse.json(
    { 
      org_id: auth.org_id,
      count: mockData.length,
      data: mockData.slice(0, limit)
    },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-RODEO-API-Key, Authorization'
      }
    }
  );
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-RODEO-API-Key, Authorization'
    }
  });
}
