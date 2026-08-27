import { NextRequest, NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await verifyApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized. Invalid or expired API Key.' }, { status: 401 });
  }

  // Validate basic scopes
  if (!auth.scopes.includes('compliance:read') && !auth.scopes.includes('full')) {
    return NextResponse.json({ error: 'Forbidden. Insufficient scopes.' }, { status: 403 });
  }

  const includeGeo = auth.scopes.includes('geo:read') || auth.scopes.includes('full');

  // Mock response for deforestation
  const mockData = [
    {
      paddock_id: 'p_1',
      name: 'Lote 1',
      status: 'CLEAN',
      forest_loss_ha: 0.0,
      last_checked: new Date().toISOString(),
      ...(includeGeo && {
        geometry: {
          type: "Polygon",
          coordinates: [[[-58.4, -34.6], [-58.4, -34.7], [-58.5, -34.7], [-58.5, -34.6], [-58.4, -34.6]]]
        }
      })
    },
    {
      paddock_id: 'p_2',
      name: 'Lote 2',
      status: 'CLEAN',
      forest_loss_ha: 0.0,
      last_checked: new Date().toISOString(),
      ...(includeGeo && {
        geometry: {
          type: "Polygon",
          coordinates: [[[-58.5, -34.6], [-58.5, -34.7], [-58.6, -34.7], [-58.6, -34.6], [-58.5, -34.6]]]
        }
      })
    }
  ];

  return NextResponse.json(
    { 
      org_id: auth.org_id,
      regulation: 'EUDR (EU 2023/1115)',
      data: mockData
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
