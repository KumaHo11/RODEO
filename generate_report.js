const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  database: 'rodeo_main'
});

async function main() {
  try {
    const res = await pool.query(`
      SELECT 
        p.email, 
        p.first_name, 
        p.last_name, 
        p.role,
        p.onboarding_step, 
        p.is_first_login, 
        p.created_at,
        (SELECT COUNT(*) FROM paddocks pd WHERE pd.org_id = p.organization_id) as paddocks_count,
        (SELECT COUNT(*) FROM herds h WHERE h.org_id = p.organization_id) as herds_count,
        (SELECT COUNT(*) FROM grazing_plans gp WHERE gp.org_id = p.organization_id) as plans_count
      FROM profiles p
      ORDER BY p.created_at DESC;
    `);

    let md = '# Reporte de Uso - Perfiles en Producción\n\n';
    
    // We only have the database info, not Google Analytics, so we will mention that.
    md += '> [!NOTE]\n';
    md += '> Google bloqueó el inicio de sesión automático para acceder a la API de Analytics (requiere verificación de aplicación). Por lo tanto, los tiempos de uso desde el primer login y la métrica exacta de "usuarios activos por mes" en Analytics no están aquí, pero la tabla incluye todo lo extraíble directamente desde la base de datos (progreso de onboarding y uso real de la app: potreros, rodeos y planificaciones).\n\n';

    md += '| Email | Nombre | Rol | Onboarding Step | 1er Login Pend. | Potreros | Rodeos | Planificaciones | Fecha Alta |\n';
    md += '|---|---|---|---|---|---|---|---|---|\n';

    res.rows.forEach(r => {
      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim();
      const date = r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : 'N/A';
      md += `| ${r.email || 'N/A'} | ${name || 'N/A'} | ${r.role || 'N/A'} | ${r.onboarding_step || 0} | ${r.is_first_login ? 'Sí' : 'No'} | ${r.paddocks_count} | ${r.herds_count} | ${r.plans_count} | ${date} |\n`;
    });

    fs.writeFileSync('report.md', md);
    console.log("Report generated in report.md");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
main();
