require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const content = `<h1>Términos y Condiciones de Uso de la Plataforma Rodeo</h1>

<p>
  Bienvenido a <strong>Rodeo</strong>. Los presentes Términos y Condiciones regulan el acceso y uso de la plataforma de software Rodeo, de aquí en adelante denominada "la Plataforma", propiedad de Rodeo, de aquí en adelante denominada "la Empresa", con domicilio en la Provincia de Buenos Aires, República Argentina.
</p>
<p>
  Al registrarse, iniciar sesión o utilizar la Plataforma, el usuario (en adelante, el "Usuario") acepta de manera expresa, voluntaria y sin reservas la totalidad de las condiciones aquí estipuladas. Si no está de acuerdo, deberá abstenerse de utilizar el servicio.
</p>

<h2>Primera: Objeto de la Plataforma y Relación con Metodologías</h2>
<p>
  Rodeo es una plataforma digital diseñada para la gestión, registro, control y planificación de establecimientos agropecuarios orientados a la ganadería regenerativa. Las funcionalidades de cálculo, mapas y gestión de pasto se encuentran inspiradas en principios generales de sustentabilidad y la metodología de manejo holístico de la tierra.
</p>
<p>
  El Usuario reconoce que la Plataforma es una herramienta de asistencia técnica y operativa independiente, y que la Empresa no cuenta con filiación, sponsoreo ni representación oficial de instituciones internacionales de certificación de marcas específicas, salvo acuerdo en contrario.
</p>

<h2>Segunda: Carácter Comercial y Tarifas del Servicio</h2>
<p>
  El acceso y uso de la Plataforma es de carácter comercial y está sujeto al pago de un precio, canon o suscripción de acuerdo con los planes vigentes publicados por la Empresa. La falta de pago en los términos acordados facultará a la Empresa a suspender o rescindir el acceso al servicio de manera inmediata, sin que esto genere derecho a reclamo o indemnización alguna a favor del Usuario. La Empresa se reserva el derecho de modificar las tarifas de sus planes, notificando al Usuario con la antelación correspondiente.
</p>

<h2>Tercera: Propiedad y Tratamiento de los Datos</h2>
<p>
  El uso de la Plataforma implica la carga de datos por parte del Usuario, los cuales se dividen en dos categorías principales:
</p>
<ul>
  <li><strong>Datos Personales:</strong> Información de registro del Usuario (nombre, correo electrónico, datos de facturación), protegidos bajo la Ley N° 25.326 de Protección de Datos Personales de la República Argentina.</li>
  <li><strong>Datos del Campo y Producción:</strong> Registros de stock ganadero, subdivisiones de potreros, mediciones de materia seca, índices satelitales NDVI, ubicación geográfica del establecimiento y planificaciones de pastoreo.</li>
</ul>
<p>
  El Usuario declara que es propietario o cuenta con las autorizaciones necesarias sobre los Datos del Campo incorporados a la Plataforma.
</p>

<h2>Cuarta: Análisis de Información y Uso de Herramientas de Analítica</h2>
<p>
  El Usuario autoriza expresamente a la Empresa a procesar, auditar y analizar los datos volcados en la Plataforma mediante herramientas de analítica internas o de terceros proveedores de tecnología. Este procesamiento se realiza con el fin de optimizar el rendimiento del software, generar métricas predictivas, mejorar los algoritmos de asignación de pasto y ofrecer un mejor servicio técnico.
</p>

<h2>Quinta: Autorización para Compartir Datos con Terceras Entidades</h2>
<p>
  El Usuario otorga su consentimiento expreso e informado para que la Empresa pueda compartir, transferir, ceder o divulgar los datos de producción, georreferenciación, evolución biológica y métricas del establecimiento a entidades de distinto tipo, incluyendo de forma enunciativa pero no limitativa:
</p>
<ul>
  <li>Institutos de investigación científica o académica.</li>
  <li>Organismos públicos o privados vinculados al sector AgTech y medioambiente.</li>
  <li>Entidades financieras, aseguradoras o fondos de inversión interesados en la validación de activos ambientales o huella de carbono.</li>
  <li>Empresas aliadas comerciales proveedoras de insumos o servicios para el agro.</li>
</ul>
<p>
  Dicha transferencia de información se realizará priorizando esquemas de disociación o anonimización de datos cuando se trate de reportes masivos, garantizando que la identidad del Usuario quede resguardada frente a terceros ajenos a la operación, salvo requerimiento legal o autorización en contrario.
</p>

<h2>Sexta: Limitación de Responsabilidad</h2>
<p>
  La Plataforma se provee "tal como está". El éxito en la regeneración de los suelos, la mejora del pasto y la productividad del ganado dependen de variables climáticas, biológicas y de la correcta ejecución de las tareas en el terreno por parte del personal del establecimiento. La Empresa no garantiza resultados comerciales ni ecológicos específicos y no será responsable por pérdidas de stock ganadero, sequías, errores de interpretación de índices satelitales o decisiones de manejo adoptadas por el Usuario basadas en los reportes de la Plataforma.
</p>

<h2>Séptima: Jurisdicción y Ley Aplicable</h2>
<p>
  Para todos los efectos legales que pudieran surgir del uso de la Plataforma, las partes se someten a la aplicación de las leyes de la República Argentina y a la jurisdicción de los Tribunales Ordinarios competentes, renunciando a cualquier otro fuero o jurisdicción que pudiera corresponderles.
</p>`;

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if v1.3 already exists
    const checkRes = await client.query("SELECT id FROM terms_and_conditions_versions WHERE version_number = 'v1.3'");
    if (checkRes.rowCount > 0) {
      console.log('Terms version v1.3 already exists. Skipping automatic insertion.');
      await client.query('COMMIT');
      return;
    }
    
    // Deactivate previous active version
    await client.query('UPDATE terms_and_conditions_versions SET is_active = false');
    
    // Insert new version
    const insertQuery = "INSERT INTO terms_and_conditions_versions (version_number, content, is_active, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id";
    const res = await client.query(insertQuery, ['v1.3', content, true]);
    
    await client.query('COMMIT');
    console.log('Successfully inserted v1.3 with ID:', res.rows[0].id);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

run();
