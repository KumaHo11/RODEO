const http = require('http');

const testIDOR = () => {
    http.get('http://localhost:3001/map-data?org_id=alguna-org-id', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('Status Code:', res.statusCode);
            console.log('Response Body:', data);
        });
    }).on('error', err => {
        console.error('Error:', err.message);
    });
};

testIDOR();
