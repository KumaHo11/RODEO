const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://rodeo_service:rodeo_svc_staging_pass_123@127.0.0.1:5432/rodeo'
});
client.connect()
  .then(() => {
    console.log('Connected successfully');
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log(res.rows[0]);
    client.end();
  })
  .catch(err => {
    console.error('Connection error', err.stack);
    client.end();
  });
