const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/rodeo' });

async function run() {
  await client.connect();
  
  // 1. Get an existing org
  const orgResult = await client.query('SELECT id FROM organizations LIMIT 1');
  const orgId = orgResult.rows[0].id;
  console.log('Testing with Org ID:', orgId);
  
  // Helper to fetch flags for a plan
  async function getFlags(planSlug) {
    const res = await client.query(`
      SELECT f.flag_key, f.flag_value 
      FROM plan_feature_flags f
      JOIN subscriptions_plans p ON f.plan_id = p.id
      WHERE p.slug = $1
    `, [planSlug]);
    return res.rows.map(r => `${r.flag_key}: ${r.flag_value}`).join(', ');
  }

  // 2. Test Trial Active
  console.log('\n--- 1. TRIAL ACTIVO (45 días) ---');
  await client.query(`UPDATE organizations SET plan_status = 'trialing', trial_ends_at = NOW() + INTERVAL '10 days' WHERE id = $1`, [orgId]);
  // Logic from code says it uses 'holistico'
  console.log('Expected: Usa flags de plan Holístico');
  console.log('Flags Holístico:', await getFlags('holistico'));

  // 3. Test Trial Expired
  console.log('\n--- 2. TRIAL VENCIDO ---');
  await client.query(`UPDATE organizations SET plan_status = 'trialing', trial_ends_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [orgId]);
  // Logic from code says it downgrades to 'brote'
  const brotePlanIdRes = await client.query(`SELECT id FROM subscriptions_plans WHERE slug = 'brote'`);
  await client.query(`UPDATE organizations SET subscription_plan_id = $1, plan_status = 'active', trial_ends_at = NULL WHERE id = $2`, [brotePlanIdRes.rows[0].id, orgId]);
  console.log('Expected: Downgrade a plan Brote');
  console.log('Flags Brote:', await getFlags('brote'));

  // 4. Test Planificador
  console.log('\n--- 3. PLAN PLANIFICADOR ---');
  console.log('Flags Planificador:', await getFlags('planificador'));

  // 5. Test Latifundio
  console.log('\n--- 4. PLAN LATIFUNDIO ---');
  console.log('Flags Latifundio:', await getFlags('latifundio'));

  await client.end();
}
run().catch(console.error);
