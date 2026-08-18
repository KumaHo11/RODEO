import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await verifyApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Invalid or expired API Key.' }, { status: 401 });
  }

  // Validate basic scopes
  if (!auth.scopes.includes('compliance:read') && !auth.scopes.includes('full')) {
    return NextResponse.json({ error: 'Forbidden. Insufficient scopes for compliance data.' }, { status: 403 });
  }

  // Mock response
  return NextResponse.json(
    { 
      org_id: auth.org_id,
      last_verified: new Date().toISOString(),
      data_sources: ['Sentinel-2 ESA', 'Global Forest Watch', 'Field Data'],
      scores: {
        eudr: 100,
        eov: 85,
        grsb: 92
      },
      status: {
        eudr: 'COMPLIANT',
        eov: 'IN_PROGRESS',
        grsb: 'COMPLIANT'
      }
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
