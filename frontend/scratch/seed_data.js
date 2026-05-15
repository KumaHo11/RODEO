const { Client } = require('pg');
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:<PASSWORD>@35.247.199.183:5432/rodeo';

const orgId = '1ea6dbed-44fb-4b4f-ade5-708589e097ed';
const paddocks = [
  {"id":"9b6e460f-85ca-48ed-b4d7-cd313eed0724","name":"Potrero Elio"},
  {"id":"f1cf9742-39a9-440b-8f6b-52d9e494e596","name":"Potrero A23"},
  {"id":"804a9699-4fdb-42da-82e9-651a5c76398c","name":"Casco de casa"},
  {"id":"1362b6b0-f7d8-42bb-86aa-008f8533482d","name":"Potrero Alto"},
  {"id":"5033b7f2-9906-4513-8a28-2600e668fdd5","name":"Potrero Delfina"},
  {"id":"be69f064-0fde-4d32-ba2d-0580a4029de2","name":"Delicadeza"},
  {"id":"d9c63a7e-053c-4fc4-8db0-ce95cfe5153a","name":"Potrero Juan"},
  {"id":"d62ca10a-b7f5-44a0-bc50-4724ff35d04d","name":"Potrero choco"},
  {"id":"7fa366d7-f2aa-4609-a6a2-c64c71ff57d9","name":"Ricardo"},
  {"id":"e483ed83-09e0-450d-ab03-3d3c72271248","name":"Potrero centro"},
  {"id":"9cd83ddb-7dc2-4cf2-8d72-da55c3838cc7","name":"Lote sur"}
];

async function run() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Generating 6 months of data...');

  try {
    const now = new Date();
    const days = 180;
    
    // Clear old data for these paddocks to avoid duplicates in test
    await client.query('DELETE FROM historial_potrero WHERE paddock_id = ANY($1)', [paddocks.map(p => p.id)]);
    await client.query('DELETE FROM climate_adjustment_snapshots WHERE paddock_id = ANY($1)', [paddocks.map(p => p.id)]);

    for (const p of paddocks) {
      console.log(`Processing ${p.name}...`);
      let currentNdvi = 0.45 + Math.random() * 0.1;
      
      for (let i = days; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const month = date.getMonth() + 1; // 1-12

        // Seasonal temp (simplified Southern Hemisphere)
        // Winter (July) is min, Summer (Jan) is max
        const seasonFactor = Math.cos((month - 1) * Math.PI / 6); // approx
        const temp = 15 + seasonFactor * 10 + (Math.random() - 0.5) * 5;
        const radiation = 15 + seasonFactor * 10 + (Math.random() - 0.5) * 3;
        const humidity = 60 - seasonFactor * 10 + (Math.random() - 0.5) * 10;
        const wind = 10 + Math.random() * 10;
        
        // Rainfall events (sparse)
        let rain = 0;
        if (Math.random() > 0.85) {
          rain = Math.random() * 25;
        }

        // NDVI evolution
        const growthFactor = (temp > 10 && rain > 0) ? 0.02 : (temp < 5 ? -0.01 : 0);
        currentNdvi = Math.max(0.1, Math.min(0.85, currentNdvi + growthFactor + (Math.random() - 0.5) * 0.01));

        // Simplified ET and C_adj for simulation
        const et = (0.0023 * radiation * (temp + 17.8) * Math.sqrt(Math.max(0, temp - 5))) || 2;
        const effectiveRain = rain * 0.8;
        const bh = effectiveRain - et;
        
        // C_adj calculation simulation
        let cAdj = 1.0;
        if (bh < -10) cAdj = 0.8;
        if (bh < -30) cAdj = 0.6;
        if (bh > 5) cAdj = 1.1;
        if (currentNdvi < 0.2) cAdj *= 0.5;

        // Insert Historial
        await client.query(`
          INSERT INTO historial_potrero (
            org_id, paddock_id, fecha, ndvi, temperatura_c, radiacion_solar, 
            humedad_pct, velocidad_viento_kmh, precipitacion_api_mm,
            et_calculada_mm, balance_hidrico_mm, c_adj, lluvia_fuente
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'api')
        `, [orgId, p.id, dateStr, currentNdvi, temp, radiation, humidity, wind, rain, et, bh, cAdj]);

        // Weekly snapshots for the graph
        if (i % 7 === 0) {
          await client.query(`
            INSERT INTO climate_adjustment_snapshots (
              org_id, paddock_id, ndvi, forage_ms_ha, climate_multiplier, 
              alert_level, alert_message, calculated_at
            ) VALUES ($1, $2, $3, 1500, $4, $5, $6, $7)
          `, [
            orgId, p.id, currentNdvi, cAdj, 
            cAdj < 0.7 ? 'critical' : (cAdj < 0.9 ? 'warning' : 'ok'),
            cAdj < 0.7 ? 'Estrés hídrico severo' : 'Condiciones normales',
            dateStr
          ]);
        }
      }
    }
    console.log('Data generation complete!');
  } finally {
    await client.end();
  }
}

run().catch(console.error);
