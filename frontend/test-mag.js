const https = require('https');

https.get('https://www.mercadoagroganadero.com.ar/dll/inicio.dll', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // try to find INMAG
    const inmagMatch = data.match(/INMAG\s*(?:<[^>]+>)*\s*([\d\.,]+)/i);
    console.log("Regex 1 match:", inmagMatch ? inmagMatch[1] : "not found");
    
    // just split by INMAG
    const idx = data.indexOf('INMAG');
    if(idx > -1) {
        console.log("Substring near INMAG:", data.substring(idx, idx+50).replace(/\s+/g,' '));
    }
    
    // try finding the novillos min/max just to test
    const novMatch = data.match(/Novillos\s*\$\s*([\d\.,]+)\s*\/\s*\$\s*([\d\.,]+)/i);
    console.log("Novillos match:", novMatch ? `${novMatch[1]} - ${novMatch[2]}` : "not found");
  });
}).on('error', err => console.log(err.message));
