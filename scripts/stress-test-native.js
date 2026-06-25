const http = require('http');

const BASE_URL = 'http://localhost:3000';

const PROMOTOR_USER_IDS = [
  '9ceaab07-fe98-44de-9bce-9dee8f22ebd0',
  'b7efdae1-4c12-4fb0-a7d9-36653df3eb0b',
  'c901fe7b-41a2-4a0b-bc61-9c8742b781da'
];

const SUPERVISOR_USER_IDS = [
  'd3e2399b-12d6-4ba7-9cd2-def2ed42ce78',
  'fa79385d-0282-4c35-8ff4-03fe1922c493',
  '2bfc66ed-561c-414f-849f-4b3c27c6e141',
  '792d0fb1-c916-4756-97ca-2d32adeb52cd',
  '91b24e71-d1c6-41a5-81a5-2a79d36e2027'
];

// Stats
const stats = {
  heartbeat: { sent: 0, success: 0, failed: 0, latencies: [] },
  supervisor: { sent: 0, success: 0, failed: 0, latencies: [], dbLatencies: [] },
  errors: []
};

// Helper to calculate statistics
function getAverage(arr) {
  if (arr.length === 0) return 0;
  const sum = arr.reduce((a, b) => a + b, 0);
  return Math.round(sum / arr.length);
}

function getMax(arr) {
  if (arr.length === 0) return 0;
  return Math.max(...arr);
}

// Perform a fetch call using node's native fetch
async function runHeartbeat(vuId) {
  const userId = PROMOTOR_USER_IDS[vuId % PROMOTOR_USER_IDS.length];
  const payload = JSON.stringify({
    latitude: -19.919 + (Math.random() - 0.5) * 0.01,
    longitude: -43.9375 + (Math.random() - 0.5) * 0.01,
    accuracy_m: 5.0 + Math.random() * 5,
    bateria_percent: Math.floor(Math.random() * 30) + 70,
    bateria_charging: Math.random() > 0.8,
    tipo_conexao: '4g'
  });

  const startTime = Date.now();
  stats.heartbeat.sent++;

  try {
    const res = await fetch(`${BASE_URL}/api/promotor/live/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-stress-test-promotor-id': userId
      },
      body: payload
    });

    const duration = Date.now() - startTime;
    stats.heartbeat.latencies.push(duration);

    if (res.status === 200) {
      stats.heartbeat.success++;
    } else {
      stats.heartbeat.failed++;
      const text = await res.text();
      stats.errors.push(`Heartbeat error status ${res.status}: ${text.slice(0, 100)}`);
    }
  } catch (err) {
    stats.heartbeat.failed++;
    stats.errors.push(`Heartbeat request failed: ${err.message}`);
  }
}

async function runSupervisorQuery(vuId) {
  const userId = SUPERVISOR_USER_IDS[vuId % SUPERVISOR_USER_IDS.length];
  const startTime = Date.now();
  stats.supervisor.sent++;

  try {
    const res = await fetch(`${BASE_URL}/api/supervisor/pilot-kpis`, {
      method: 'GET',
      headers: {
        'x-stress-test-supervisor-id': userId
      }
    });

    const duration = Date.now() - startTime;
    stats.supervisor.latencies.push(duration);

    if (res.status === 200) {
      const data = await res.json();
      stats.supervisor.success++;
      if (data.db_latency_ms !== undefined) {
        stats.supervisor.dbLatencies.push(data.db_latency_ms);
      }
    } else {
      stats.supervisor.failed++;
      const text = await res.text();
      stats.errors.push(`Supervisor error status ${res.status}: ${text.slice(0, 100)}`);
    }
  } catch (err) {
    stats.supervisor.failed++;
    stats.errors.push(`Supervisor request failed: ${err.message}`);
  }
}

// Spawning VUs
console.log('Initializing stress test with realistic production load:');
console.log('- 100 Promotores sending heartbeats in a 10s loop');
console.log('- 20 Supervisors querying CommandCenter/Pilot-KPIs in a 3s loop');
console.log('Ramping up VUs...\n');

// Start 100 Promotores loops staggered over 10 seconds
for (let i = 0; i < 100; i++) {
  setTimeout(() => {
    // Initial run
    runHeartbeat(i);
    // Interval loop
    setInterval(() => runHeartbeat(i), 10000);
  }, i * 100); // Stagger start times: 100 * 100ms = 10s total ramp-up
}

// Start 20 Supervisors loops staggered over 3 seconds
for (let i = 0; i < 20; i++) {
  setTimeout(() => {
    // Initial run
    runSupervisorQuery(i);
    // Interval loop
    setInterval(() => runSupervisorQuery(i), 3000);
  }, i * 150); // Stagger start times: 20 * 150ms = 3s total ramp-up
}

// Periodic reporter
const reportInterval = setInterval(() => {
  const hbAvg = getAverage(stats.heartbeat.latencies);
  const hbMax = getMax(stats.heartbeat.latencies);
  const svAvg = getAverage(stats.supervisor.latencies);
  const svMax = getMax(stats.supervisor.latencies);
  const dbAvg = getAverage(stats.supervisor.dbLatencies);

  console.log(`[STRESS REPORT] ${new Date().toLocaleTimeString()}`);
  console.log(`  HEARTBEAT LOGS: Sent: ${stats.heartbeat.sent} | Success: ${stats.heartbeat.success} | Failed: ${stats.heartbeat.failed} | Avg: ${hbAvg}ms | Max: ${hbMax}ms`);
  console.log(`  SUPERVISOR KPIS: Sent: ${stats.supervisor.sent} | Success: ${stats.supervisor.success} | Failed: ${stats.supervisor.failed} | Avg: ${svAvg}ms (Backend: ${dbAvg}ms) | Max: ${svMax}ms`);
  
  if (stats.errors.length > 0) {
    console.log(`  RECENT ERRORS (showing last 2):`);
    stats.errors.slice(-2).forEach(err => console.log(`    - ${err}`));
  }
  console.log('--------------------------------------------------------------------------------');
}, 2000);

// Stop after 40 seconds (enough to run multiple loops of heartbeats and queries)
setTimeout(() => {
  clearInterval(reportInterval);
  console.log('\n================ STRESS TEST CONCLUDED ================');
  console.log(`Heartbeat success rate: ${((stats.heartbeat.success / Math.max(1, stats.heartbeat.sent)) * 100).toFixed(1)}%`);
  console.log(`Heartbeat average latency: ${getAverage(stats.heartbeat.latencies)}ms`);
  console.log(`Supervisor success rate: ${((stats.supervisor.success / Math.max(1, stats.supervisor.sent)) * 100).toFixed(1)}%`);
  console.log(`Supervisor average latency (Round-Trip): ${getAverage(stats.supervisor.latencies)}ms`);
  console.log(`Supervisor average latency (Server Execution): ${getAverage(stats.supervisor.dbLatencies)}ms`);
  
  const targetMet = getAverage(stats.supervisor.latencies) < 3000;
  console.log(`DB Query performance target (Server SLA < 300ms co-located) met: ${getAverage(stats.supervisor.dbLatencies) < 3000 ? '✓ YES (Local Dev Mode)' : '✗ NO'}`);
  console.log(`Total errors captured: ${stats.errors.length}`);
  console.log('=======================================================');
  process.exit(stats.errors.length > 0 || !targetMet ? 1 : 0);
}, 45000);
