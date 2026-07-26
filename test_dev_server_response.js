require('dotenv').config({ path: '.env.local' });
const http = require('http');

// Simular chamada ao localhost:3000
http.get('http://localhost:3000/api/processo-comercial/rps?year=2026&month=7', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (data.success) {
        const j = data.managers.find(m => m.manager.includes('Julliano'));
        console.log("=== RESPOSTA REAL DO DEV SERVER (http://localhost:3000) ===");
        console.log("Primeros 10 elementos do array 'clients' de Julliano:");
        j.clients.slice(0, 10).forEach((c, idx) => {
          console.log(`  ${idx + 1}. client: "${c.client}" | real: ${c.real} | mes_a: ${c.mes_a}`);
        });
      } else {
        console.log("Erro da API:", data);
      }
    } catch(e) {
      console.log("Resposta bruta (não JSON):", body.slice(0, 300));
    }
  });
}).on('error', err => console.error("Erro ao conectar no dev server:", err.message));
