const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/rodeo?schema=public";

const emailsToWipe = [
  'jeronimollamazares@gmail.com',
  'donjeronimo123+1@gmail.com',
  'donjeronimo123@gmail.com',
  'josorio@rodeoagtech.com'
];

async function wipeUsers() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  console.log('--- Wiping User Data ---');
  for (const email of emailsToWipe) {
    console.log(`Processing ${email}...`);
    
    // 1. Find profile
    const profileRes = await client.query('SELECT id, organization_id FROM profiles WHERE email = $1', [email]);
    if (profileRes.rows.length === 0) {
      console.log(`  No profile found for ${email}. Skipping DB wipe.`);
      continue;
    }

    const { id: profileId, organization_id: orgId } = profileRes.rows[0];
    console.log(`  Found Profile ID: ${profileId}, Org ID: ${orgId}`);

    if (orgId) {
      // Remove dependencies first
      await client.query('DELETE FROM grazing_plans WHERE paddock_id IN (SELECT id FROM paddocks WHERE org_id = $1)', [orgId]);
      await client.query('DELETE FROM farm_events WHERE org_id = $1', [orgId]);
      await client.query('DELETE FROM tasks WHERE org_id = $1', [orgId]);
      await client.query('DELETE FROM field_notes WHERE org_id = $1', [orgId]);
      await client.query('DELETE FROM notifications WHERE user_id IN (SELECT id FROM profiles WHERE organization_id = $1)', [orgId]);
      await client.query('DELETE FROM team_invitations WHERE org_id = $1', [orgId]);
      
      // Some season_plans reference profiles(id).
      await client.query('DELETE FROM season_plans WHERE org_id = $1 OR created_by IN (SELECT id FROM profiles WHERE organization_id = $1)', [orgId]);
      
      await client.query('DELETE FROM impersonation_sessions WHERE target_user_id IN (SELECT id FROM profiles WHERE organization_id = $1) OR admin_id IN (SELECT id FROM profiles WHERE organization_id = $1)', [orgId]);
      
      // Then herds and paddocks
      await client.query('DELETE FROM herds WHERE org_id = $1', [orgId]);
      await client.query('DELETE FROM paddocks WHERE org_id = $1', [orgId]);
      
      // Then profiles
      await client.query('DELETE FROM profiles WHERE organization_id = $1', [orgId]);
      
      // Finally org
      await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);
      
      console.log(`  ✅ Successfully wiped all data for organization ${orgId}`);
    } else {
      await client.query('DELETE FROM impersonation_sessions WHERE target_user_id = $1 OR admin_id = $1', [profileId]);
      await client.query('DELETE FROM profiles WHERE id = $1', [profileId]);
      console.log(`  ✅ Successfully deleted orphan profile ${profileId}`);
    }
  }

  await client.end();
  console.log('--- DB Wipe Complete ---');
}

wipeUsers().catch(console.error);
