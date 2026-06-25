async function test() {
  const BASE_URL = 'http://localhost:3000';

  console.log('Testing Heartbeat with header...');
  try {
    const res = await fetch(`${BASE_URL}/api/promotor/live/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-stress-test-promotor-id': '9ceaab07-fe98-44de-9bce-9dee8f22ebd0'
      },
      body: JSON.stringify({
        latitude: -19.919,
        longitude: -43.9375,
        accuracy_m: 5.0,
        bateria_percent: 85,
        bateria_charging: false,
        tipo_conexao: 'wifi'
      })
    });
    console.log('Heartbeat status:', res.status);
    console.log('Heartbeat headers:', Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log('Heartbeat body (first 200 chars):', text.slice(0, 200));
  } catch (e) {
    console.error('Heartbeat error:', e);
  }

  console.log('\nTesting Supervisor KPIs with header...');
  try {
    const res = await fetch(`${BASE_URL}/api/supervisor/pilot-kpis`, {
      method: 'GET',
      headers: {
        'x-stress-test-supervisor-id': 'fa79385d-0282-4c35-8ff4-03fe1922c493'
      }
    });
    console.log('Supervisor status:', res.status);
    console.log('Supervisor headers:', Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log('Supervisor body (first 200 chars):', text.slice(0, 200));
  } catch (e) {
    console.error('Supervisor error:', e);
  }
}

test();
