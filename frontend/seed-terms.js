const { Client } = require('pg');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("No DATABASE_URL provided.");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const res = await client.query('SELECT count(*) FROM terms_and_conditions_versions');
    if (parseInt(res.rows[0].count) === 0) {
      console.log("Inserting default terms and conditions...");
      const content = `<h3>1. Términos y Condiciones de Uso</h3><p>Bienvenido a Rodeo. Al utilizar nuestra aplicación, aceptas estos términos y condiciones en su totalidad. Por favor, léelos atentamente antes de continuar.</p><h3>2. Uso de la Plataforma</h3><p>Rodeo te provee herramientas de software para la gestión de tu establecimiento ganadero. Eres responsable de la exactitud de los datos ingresados.</p><h3>3. Privacidad</h3><p>Respetamos tu privacidad. Tus datos agropecuarios son confidenciales y no serán compartidos con terceros sin tu consentimiento.</p><h3>4. Modificaciones</h3><p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Se te notificará de cualquier cambio importante.</p>`;
      await client.query(
        'INSERT INTO terms_and_conditions_versions (version_number, content, is_active) VALUES ($1, $2, $3)',
        ['1.0.0', content, true]
      );
      console.log("Inserted default terms version 1.0.0");
    } else {
      console.log("Terms and conditions already exist, skipping.");
    }
  } catch (e) {
    console.error("Error checking/inserting terms:", e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
