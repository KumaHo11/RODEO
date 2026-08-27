import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { serviceQueryOne } from '@/lib/db';

export interface ApiKeyContext {
  org_id: string;
  scopes: string[];
}

/**
 * Verifica un API key del header 'X-RODEO-API-Key' o 'Authorization: Bearer rdeo_*'
 * Busca en api_keys por SHA256(key), verifica que está activo y no expirado
 * Retorna { org_id, scopes } si válido
 */
export async function verifyApiKey(req: NextRequest): Promise<ApiKeyContext | null> {
  let apiKey = req.headers.get('x-rodeo-api-key');
  
  if (!apiKey) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
  }

  if (!apiKey) return null;

  try {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
    // Check in database
    const keyData = await serviceQueryOne(
      `SELECT org_id, scopes 
       FROM api_keys 
       WHERE key_hash = $1 
         AND is_active = true 
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [keyHash]
    );

    if (!keyData) return null;

    // Update last_used_at in background
    // We shouldn't await this to keep the API fast
    // Actually, Next.js requires us to be careful with background tasks,
    // but a simple fire-and-forget query via service fetch is usually fine
    serviceQueryOne(
      `UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1`,
      [keyHash]
    ).catch(e => console.error("Failed to update last_used_at", e));

    return {
      org_id: (keyData as any).org_id,
      scopes: (keyData as any).scopes || []
    };
  } catch (error) {
    console.error('Error verifying API key:', error);
    return null;
  }
}
