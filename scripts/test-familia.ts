import { AnalyticsEngine } from '@/lib/governance/analytics';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runTest() {
  try {
    const filters = {
      startMonth: '2025-06',
      endMonth: '2026-06'
    };

    console.log('Testing getHistoricoFamiliaData with filters:', filters);

    const data = await AnalyticsEngine.getHistoricoFamiliaData(filters);
    console.log('Totals:', data.totals);
    console.log('Familias count:', data.familias.length);
    if (data.familias.length > 0) {
      console.log('Top 5 familias:', data.familias.slice(0, 5));
    }
  } catch (err) {
    console.error('Error running query:', err);
  }
}

runTest();
