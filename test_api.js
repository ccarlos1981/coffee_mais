require('dotenv').config({ path: '.env.local' });
const http = require('http');

http.get('http://localhost:3000/api/dashboard?startDate=2026-05-01&endDate=2026-05-31', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    if (res.statusCode !== 200) {
      console.log('ERROR:', data.slice(0, 500));
    } else {
      const json = JSON.parse(data);
      console.log('SUCCESS: found managers:', json.byManager?.map(m => m.manager));
    }
  });
}).on('error', err => console.log('REQ ERROR:', err.message));
