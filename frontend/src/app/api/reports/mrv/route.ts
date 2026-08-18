import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { requireAuth } from '@/lib/auth';
import { renderToStream } from '@react-pdf/renderer';
import { MRVReport } from '@/lib/reports/MRVReport';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const user = await requireAuth(req);
    
    // Get parameters
    const url = new URL(req.url);
    const orgId = url.searchParams.get('org_id') || user?.orgId || 'org_123';
    
    // Generate a hash for verification
    const timestamp = new Date().toISOString();
    const dataString = `${orgId}-${timestamp}-RODEO-MRV`;
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');

    const reportType = (url.searchParams.get('report_type') as any) || 'full';

    const stream = await renderToStream(
      React.createElement(MRVReport, {
        orgName: "Estancia La Invernada",
        orgId: orgId,
        timestamp: timestamp,
        hash: hash,
        reportType: reportType
      }) as any
    );

    // Convert NodeJS Readable stream to Web ReadableStream
    // We can also just send the stream in Next.js response if we handle it correctly
    // Next.js App Router Response accepts a ReadableStream
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err) => {
          controller.error(err);
        });
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=rodeo-mrv-report.pdf',
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF report' },
      { status: 500 }
    );
  }
}
