require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');
const secret = process.env.WEBHOOK_SECRET;
if (!secret) {
  console.error('WEBHOOK_SECRET environment variable is missing.');
  process.exit(1);
}
const payload = JSON.stringify({
  entry: [{
    changes: [{
      value: {
        messages: [{
          from: '5491112345678',
          id: 'wamid.HBgLNTQ5MTE2MjMyODUzNhUCABEYEjdFNUQxRThCNzVBMTA0MkZEQgA=',
          type: 'text',
          text: {
            body: 'Vincular al campo TOKEN_1b1223e90e5e42b7c021b590e48393e0ba786c017ae01996de87021f1f4589b5'
          }
        }]
      }
    }]
  }]
});
const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
console.log(`curl -X POST https://staging.rodeoagtech.com/api/webhooks/whatsapp \\
  -H "Content-Type: application/json" \\
  -H "x-hub-signature-256: sha256=${hmac}" \\
  -d '${payload}'`);
