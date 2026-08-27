import { NextResponse } from 'next/server';

export async function GET() {
  const openapi = {
    openapi: '3.0.0',
    info: {
      title: 'RODEO B2B API v2',
      version: '2.0.0',
      description: 'API for accessing metrics, compliance, and reports via Marketplace grants.'
    },
    servers: [
      {
        url: 'https://app.rodeoagtech.com/api/v2',
        description: 'Production'
      }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-RODEO-API-Key'
        }
      }
    },
    security: [
      {
        ApiKeyAuth: []
      }
    ],
    paths: {
      '/metrics': {
        get: {
          summary: 'Get raw satellite metrics',
          parameters: [
            { name: 'metric_type', in: 'query', schema: { type: 'string' } },
            { name: 'paddock_id', in: 'query', schema: { type: 'string' } },
            { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } }
          ],
          responses: {
            '200': { description: 'Success' }
          }
        }
      },
      '/compliance': {
        get: {
          summary: 'Get compliance scores (EUDR, EOV, GRSB)',
          responses: {
            '200': { description: 'Success' }
          }
        }
      },
      '/deforestation': {
        get: {
          summary: 'Get EUDR deforestation guard status',
          responses: {
            '200': { description: 'Success' }
          }
        }
      },
      '/report': {
        get: {
          summary: 'Generate MRV Report PDF',
          parameters: [
            { name: 'report_type', in: 'query', schema: { type: 'string', enum: ['full', 'eudr', 'eov', 'grsb'] } }
          ],
          responses: {
            '200': { description: 'PDF file generated', content: { 'application/pdf': {} } }
          }
        }
      }
    }
  };

  return NextResponse.json(openapi, {
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  });
}
