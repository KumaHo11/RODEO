const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,
  user: 'postgres',
  password: 'RodeoProd2026New!',
  database: 'rodeo_main'
});

async function main() {
  try {
    // Grass AI usage: biological_monitoring with photo_url
    const aiGrass = await pool.query(`
      SELECT COUNT(DISTINCT p.org_id) as orgs, COUNT(*) as uses 
      FROM biological_monitoring bm
      JOIN paddocks p ON bm.paddock_id = p.id
      WHERE bm.photo_url IS NOT NULL
    `);
    
    // BCS AI usage: herds with bcs_data
    const aiBCS = await pool.query(`
      SELECT COUNT(DISTINCT org_id) as orgs, COUNT(*) as uses 
      FROM herds 
      WHERE bcs_data IS NOT NULL OR bcs_score IS NOT NULL
    `);
    
    // Check animal_events for AI
    const aiAnimalEvents = await pool.query(`
      SELECT COUNT(DISTINCT animals.org_id) as orgs, COUNT(*) as uses 
      FROM animal_events 
      JOIN animals ON animal_events.animal_id = animals.id
      WHERE event_type = 'bcs_scan' OR notes ILIKE '%AI%'
    `);

    const tableCounts = {};
    const tablesToCheck = [
      'animal_events', 'historial_potrero', 'weather_events', 
      'climate_adjustment_snapshots', 'rainfall_logs', 'biological_monitoring',
      'tasks', 'field_notes', 'movements', 'deforestation_checks',
      'metric_snapshots', 'grazing_plan_entries'
    ];

    for (const table of tablesToCheck) {
      try {
        const countRes = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        tableCounts[table] = countRes.rows[0].count;
      } catch (err) {
        tableCounts[table] = 'N/A';
      }
    }

    let md = '# Uso de Funcionalidades e Inteligencia Artificial (Producción)\n\n';
    
    md += '## Uso de Inteligencia Artificial\n';
    md += '| Funcionalidad | N° Organizaciones/Perfiles | Total de Usos |\n';
    md += '|---|---|---|\n';
    md += `| Medición de Pasto (Fotos) | ${aiGrass.rows[0].orgs} | ${aiGrass.rows[0].uses} |\n`;
    md += `| Condición Corporal (Rodeos) | ${aiBCS.rows[0].orgs} | ${aiBCS.rows[0].uses} |\n`;
    if (aiAnimalEvents.rows[0].uses > 0) {
      md += `| Eventos Individuales (Animales) | ${aiAnimalEvents.rows[0].orgs} | ${aiAnimalEvents.rows[0].uses} |\n`;
    }
    
    md += '\n## Uso General de Funcionalidades (Subsecciones)\n';
    md += 'Esta tabla muestra cuántos registros en total se han creado en cada módulo de la aplicación.\n\n';
    md += '| Módulo / Funcionalidad | Tabla Interna | Registros Totales |\n';
    md += '|---|---|---|\n';
    md += `| Registros / Eventos Animales | animal_events | ${tableCounts['animal_events']} |\n`;
    md += `| Historial de Potreros | historial_potrero | ${tableCounts['historial_potrero']} |\n`;
    md += `| Clima: Eventos Climáticos | weather_events | ${tableCounts['weather_events']} |\n`;
    md += `| Clima: Ajustes y Proyecciones | climate_adjustment_snapshots | ${tableCounts['climate_adjustment_snapshots']} |\n`;
    md += `| Clima: Registros de Lluvia | rainfall_logs | ${tableCounts['rainfall_logs']} |\n`;
    md += `| Tareas (Tasks) | tasks | ${tableCounts['tasks']} |\n`;
    md += `| Notas de Campo | field_notes | ${tableCounts['field_notes']} |\n`;
    md += `| Movimientos | movements | ${tableCounts['movements']} |\n`;
    md += `| Controles de Deforestación (EUDR) | deforestation_checks | ${tableCounts['deforestation_checks']} |\n`;
    md += `| Métricas / MRV Satelital | metric_snapshots | ${tableCounts['metric_snapshots']} |\n`;
    md += `| Calculadora / Entradas Plan Grazing | grazing_plan_entries | ${tableCounts['grazing_plan_entries']} |\n`;

    fs.writeFileSync('functionalities_report.md', md);
    console.log("Report created");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
