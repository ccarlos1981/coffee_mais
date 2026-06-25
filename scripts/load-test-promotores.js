import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp-up to 20 users
    { duration: '1m', target: 50 },   // Ramp-up to 50 users
    { duration: '2m', target: 100 },  // Maintain 100 concurrent simulated promotores
    { duration: '30s', target: 0 },   // Cool-down to 0 users
  ],
};

const BASE_URL = 'http://localhost:3000'; // Target local Next.js dev server or staging URL

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // Coordinates simulating Belo Horizonte region with slight random displacement per VU (virtual user)
  const latOffset = (Math.random() - 0.5) * 0.05;
  const lngOffset = (Math.random() - 0.5) * 0.05;

  const heartbeatPayload = JSON.stringify({
    latitude: -19.919 + latOffset,
    longitude: -43.9375 + lngOffset,
    accuracy_m: 8.5,
    bateria_percent: Math.floor(Math.random() * 50) + 50, // 50% to 100%
    bateria_charging: Math.random() > 0.8,
    tipo_conexao: Math.random() > 0.3 ? '5g' : 'wifi'
  });

  const heartbeatRes = http.post(`${BASE_URL}/api/promotor/live/heartbeat`, heartbeatPayload, { headers });
  
  check(heartbeatRes, {
    'heartbeat response code is 200': (r) => r.status === 200,
    'heartbeat response latency < 200ms': (r) => r.timings.duration < 200,
  });

  // Simulating the 3-minute heartbeat interval (shortened in stress test to k6 sleep of 10s to compress concurrency load)
  sleep(10); 
}
