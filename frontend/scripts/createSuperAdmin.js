const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { Client } = require('pg');

const base64Creds = "ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAicm9kZW8tYXBwLWZhYzUwIiwKICAicHJpdmF0ZV9rZXlfaWQiOiAiNmFjYTk2YjM3ODNiYmQzMDE4OWZmZWRkNTMzNzJlNWUzMzJkNjZmNCIsCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZBSUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS1l3Z2dTaUFnRUFBb0lCQVFEUUZqVGdUYmhWRGtvUlxucWlCM2pQTjhKOXBiUnFCOGN3cXMyUUNqeXMwRnFVZktJT0l3cGEreUtIMjIvYXZGeUZZYlhlRDIzeWY1eWdtUVxub2cvaWNCeWdwK2tuR3FnSlBBYjhWMkNsWnhCUEF5c0VEMGtXVnFNT0t6MERGa0hSWTlWZzYxcFRPaGFmeHVIaVxuNjh0TmJsRU85OXVlN01WOXZiNW5IMkk0VW9zS2N4VkRua3pCN3d0T2QySFQxODVSeFJ3MnAxMEs1RVpVRUVXQVxuQ1NaU3dpMGNOWFVXeVdBZWx3QURXcC81NUYzRHRTZzVrTGlsTDhxTXkrN29TcVRqZWxFeHo2K2NTQVBLT3BUY1xuL2ZRblc5aVNPai9LS3MzK2YxOXkxSGxXOUNMUlhSLy9ueUV1bk1PZ2oyU0hCTFlUM2Exb0ZkcnhIKzBUa3RtMlxuVUtqMkdZS3ZBZ01CQUFFQ2dnRUFYT0UwbTlRRkRhNFJvSjNiM1JEa2s0dmtXcTZGTHRkWXNmc3dYbXZFcEp6QlxuSnZjVGp4dzlkcHU5TldNMysxR25JWkwvT2FJMDRUbHRtSW5GNWxBZGJ4WlRxdmtxZk9pMnc0YXE1RmxDL2NtUFxudDBHdFlWT3RkME1VZWg3Q3BSaFhJMm9aeUtGYWZOblVkS25EOXAxaGYvbGhKYWhRcElYL2lWOElROVNRTEVxUVxuNEIxdFA4bWdMMGZ6YVpUeVBTeTBQR2txUHNFbW9tVWtWUkpkZnN1RytRYW0yeDVQZlBnS3NaVzhYUTBmMkRrM1xuMVZod0hwamNkUEFKbWdxQ3JmRFlYcmprV0x0clRGZlRxZm01aEo3d2hRcHdXcnovSFNKWjlCTzNPUEJmTUZyWlxuOTlJOGdqRk5UWk8vbkFiSUY0cHl1Tk1URVMyckVieXBsVy94OXh6VlFRS0JnUURzSzFES0pJbVZELzNYdDR0eFxuYnVHOVFtclVka0NhUlZ2RFFnU3JyUWN4VUNHc3NBTHl6UzlScTAxQU45V2c0a0dodEtveWtONkxIcE5kdlRraFxuQWZhVUpMTncrd1g3QU5nUkJDWVluUk1ESDZQekJJNkNSSmdRUDNTQU8rUk1ibzBYWFk1Q0tEdlowTjlyVDBVd1xuRjZKd05ZaVZVMituZnVMbmJsMXhZbU9OYndLQmdRRGhqenREeHluV3c1Q1FEVzB4KzBZL3o2eU15REM0SGMvZFxuRll5aDhzN2RTUFZnalAydnplRlBqNWtSakhvd012VHZwaVlsaXVDQjdnTmZGRGV5RHR3VjNUVVNYVUwvS0dnRFxuNVF4SVo0aDZIa2Z0Z0xRUis3Nnp3VGhsakJTeW5maS9LZVQ0cWFqRllWdXlMUXZRQk9xenZLMUNXN1cwU1dXbVxuRUhocklHVSt3UUtCZ0g0VFdadXdDYXFEMFBWWnpKMFBubjdVZUFkWDRZRDV5ZFRnNTNGbWUxSjkvcHdia2xkZlxuNWdUcE4rSXliRjdvcWpUVEo1QzYrYksyN2VDNjVVYVRyN2pDSnZFSGNOZmdTWGc4Q01KWENCRkEwTnNvOFpMbFxuWDNBOUQ4cHRMcUVHMjFjLzRITzgyc2FhMU1xS2xOcnBveFBYNEVRbk9KSG9FT1dQYTE3ZU1Wc05Bb0dBUUVxTFxuSWU2S3htUkh1RWViY0R1bThsbEhYWGxTS2FpVnJ2YU5kenUyS3V5NHhDUnJ5c2hzQ0RsdDc4cVNxVnBjNWxIOVxuWFlZUUovaW5qVm85NWNyR2dKVGtvNjloZ1VrTEhORVVoeTY3ZjlOUnZTaUtLdllPalQzdHpVUDRRbEUwclloTFxuYzNVb1hkbzZRTGNHUHV5bjJVTldQeXZVeHVhRXlxaTNLaEc1eWdFQ2dZQktXbU14K0tpak1sazFQczJLcjB4d1xuNW9TWjBNT2NZTnRXbzlVQUNobTM2VU92OC9pa3FDRXVNUDQrd3BCOWpnTVp5Yytna1dXWUtMN1ZjcHAvMnlIelxuS3ZKUjBZWDVER3p3Q2JmeE9YeXpDOGpra08zSjhIU3krS1BmeXYyU3YwOUNQS2dqZ21CV2hINjJEakZiaHZRSFxuU0tWNkpZYW5jVWRINHRnVyswNFlkZz09XG4tLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tXG4iLAogICJjbGllbnRfZW1haWwiOiAiZmlyZWJhc2UtYWRtaW5zZGstZmJzdmNAcm9kZW8tYXBwLWZhYzUwLmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAiY2xpZW50X2lkIjogIjExMDgyOTE5OTQ1NDc3NTU3NTM3MCIsCiAgImF1dGhfdXJpIjogImh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbS9vL29hdXRoMi9hdXRoIiwKICAidG9rZW5fdXJpIjogImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwKICAiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL3ZlcnRzIiwKICAiY2xpZW50X3g1MDlfY2VydF91cmwiOiAiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vcm9ib3QvdjEvbWV0YWRhdGEveDUwOS9maXJlYmFzZS1hZG1pbnNkay1mYnN2YyU0MHJvZGVvLWFwcC1mYWM1MC5pYW0uZ3NlcnZpY2VhY2NvdW50LmNvbSIsCiAgInVuaXZlcnNlX2RvbWFpbiI6ICJnb29nbGVhcGlzLmNvbSIKfQo=";
const serviceAccount = JSON.parse(Buffer.from(base64Creds, 'base64').toString('utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const EMAIL = 'superadmin@rodeoagtech.com';
const PASS = 'Rodeo@Admin2026!';

async function setupSuperAdmin() {
  try {
    let userRecord;
    try {
      userRecord = await getAuth().getUserByEmail(EMAIL);
      console.log('Firebase user already exists:', userRecord.uid);
      await getAuth().updateUser(userRecord.uid, { password: PASS });
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        userRecord = await getAuth().createUser({
          email: EMAIL,
          password: PASS,
          emailVerified: true,
          displayName: 'Super Admin'
        });
        console.log('Created Firebase user:', userRecord.uid);
      } else {
        throw e;
      }
    }

    const prodClient = new Client('postgresql://postgres:RodeoDB2026Secure@34.95.227.181:5432/rodeo_main?schema=public');
    const stagingClient = new Client('postgresql://postgres:RodeoDB2026Secure@35.247.199.183:5432/rodeo?schema=public');

    for (const client of [prodClient, stagingClient]) {
      await client.connect();
      console.log('Connected to DB');

      // Create Organization
      const orgRes = await client.query(`
        INSERT INTO organizations (id, name, plan_status, updated_at)
        VALUES (gen_random_uuid(), 'Rodeo SuperAdmin Org', 'active', NOW())
        RETURNING id
      `);
      const orgId = orgRes.rows[0].id;

      // Create Profile
      const profRes = await client.query(`
        INSERT INTO profiles (id, firebase_uid, email, first_name, last_name, role, system_role, organization_id, is_active, updated_at)
        VALUES (gen_random_uuid(), $1, $2, 'Super', 'Admin', 'OWNER', 'SUPER_ADMIN', $3, true, NOW())
        RETURNING id
      `, [userRecord.uid, EMAIL, orgId]);
      const profId = profRes.rows[0].id;

      // Update org owner
      await client.query(`UPDATE organizations SET owner_id = $1 WHERE id = $2`, [profId, orgId]);

      // Accept Terms
      const termsRes = await client.query(`SELECT id FROM terms_and_conditions_versions WHERE is_active = true LIMIT 1`);
      if (termsRes.rows.length > 0) {
        await client.query(`
          INSERT INTO user_terms_acceptances (id, profile_id, version_id, ip_address)
          VALUES (gen_random_uuid(), $1, $2, '127.0.0.1')
        `, [profId, termsRes.rows[0].id]);
      }

      await client.end();
      console.log('DB updated successfully');
    }

    console.log('Super Admin setup complete!');
    process.exit(0);

  } catch (error) {
    console.error('Error setting up Super Admin:', error);
    process.exit(1);
  }
}

setupSuperAdmin();
