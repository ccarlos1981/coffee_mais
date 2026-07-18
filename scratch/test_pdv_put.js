const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Toggling status of pdv with anon key...");
  const { data, error } = await supabase
    .from('pdvs')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', 'c25bc009-f8cc-4242-8f72-bace8a8ba557')
    .select()
    .single();

  if (error) {
    console.error("Error toggling status:", error);
  } else {
    console.log("Success toggling status:", data);
  }
}

run();
