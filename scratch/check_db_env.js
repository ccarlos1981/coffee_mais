require('dotenv').config({ path: '.env.local' });
console.log('Available Env keys:', Object.keys(process.env).filter(k => k.includes('DB') || k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('SUPABASE')));
