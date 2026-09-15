const { Pool } = require('pg');
require('dotenv').config({ path: 'frontend/.env.local' });

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_SERVICE || "postgresql://rodeo_service:rodeo_svc_staging_pass_123@127.0.0.1:5432/rodeo",
  });

  try {
    const plansRes = await pool.query("SELECT id, name, slug FROM subscriptions_plans");
    console.log("Plans:", plansRes.rows);

    const userRes = await pool.query("SELECT id, email, organization_id, system_role FROM profiles WHERE email = 'javi.osorio.1@gmail.com'");
    console.log("User:", userRes.rows);

    if (userRes.rows.length === 0) {
        console.log("User not found");
        process.exit(1);
    }

    const orgId = userRes.rows[0].organization_id;
    const orgRes = await pool.query("SELECT id, name, subscription_plan_id FROM organizations WHERE id = $1", [orgId]);
    console.log("Organization:", orgRes.rows);

    // If there's a latifundio plan, update it
    const latifundioPlan = plansRes.rows.find(p => p.slug && p.slug.toLowerCase().includes('latifundio')) || plansRes.rows.find(p => p.name.toLowerCase().includes('latifundio'));
    
    if (latifundioPlan && orgId) {
        await pool.query("UPDATE organizations SET subscription_plan_id = $1 WHERE id = $2", [latifundioPlan.id, orgId]);
        console.log(`Updated org ${orgId} to plan ${latifundioPlan.name}`);
        
        // Let's also check if there's any role to update
        await pool.query("UPDATE profiles SET system_role = 'SUPERADMIN' WHERE email = 'javi.osorio.1@gmail.com'");
        console.log("Updated user system_role to SUPERADMIN (just in case for menu options)");
    } else {
        console.log("Could not find plan or org");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    pool.end();
  }
}

main();
