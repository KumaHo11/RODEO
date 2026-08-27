import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import crypto from 'crypto';
import { MRVReport } from '@/lib/reports/MRVReport';
import { verifyApiKey } from '@/lib/api-auth';
// Import db query if needed: import { serviceQueryOne } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyApiKey(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized. Invalid or expired API Key.' }, { status: 401 });
    }

    if (!auth.scopes.includes('report:read') && !auth.scopes.includes('full')) {
      return NextResponse.json({ error: 'Forbidden. Insufficient scopes.' }, { status: 403 });
    }

    // Rate limit check placeholder
    // In a real scenario we'd check redis or the DB table 'api_keys.last_used_at'
    
    // Get parameters
    const url = new URL(req.url);
    const reportType = (url.searchParams.get('report_type') as any) || 'full';
    const orgId = auth.org_id;
    
    // Generate a hash for verification
    const timestamp = new Date().toISOString();
    const dataString = `${orgId}-${timestamp}-RODEO-MRV`;
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');

    const stream = await renderToStream(
      React.createElement(MRVReport, {
        orgName: "Estancia La Invernada", // Normally fetch from DB using orgId
        orgId: orgId,
        timestamp: timestamp,
        hash: hash,
        reportType: reportType
      }) as any
    );

    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => controller.error(err));
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=rodeo-mrv-${reportType}.pdf`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-RODEO-API-Key, Authorization'
      },
    });
  } catch (error) {
    console.error('Error generating PDF report:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF report' },
      { status: 500 }
    );
  }
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
