require('dotenv').config({ path: '.env.local' });
const http = require('http');

http.get('http://localhost:3000/api/dashboard?startDate=2026-05-01&endDate=2026-05-31', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if (data.startsWith('<!DOCTYPE')) {
      console.log('Returned HTML. Probably auth redirect.');
    } else {
      console.log('Response:', data.substring(0, 500));
    }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
