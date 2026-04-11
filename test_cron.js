const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function run() {
  console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("SMTP_PASS length:", process.env.SMTP_PASS.length);
}
run();
