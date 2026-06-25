const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

async function reset() {
  console.log("Looking up user: cristiano@coffeemais.com...");
  
  // Find auth user
  const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error("Error listing users:", listError);
    return;
  }

  const targetUser = users.find(u => u.email === 'cristiano@coffeemais.com');
  if (!targetUser) {
    console.error("User cristiano@coffeemais.com not found in Auth!");
    return;
  }

  console.log(`Found user ID: ${targetUser.id}. Resetting password to '123456'...`);
  const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
    password: '123456'
  });

  if (pwdErr) {
    console.error("Error updating password:", pwdErr);
  } else {
    console.log("Password reset successfully.");
  }

  console.log("Ensuring user profile is mapped to the default company (Coffee Mais)...");
  const { error: profileErr } = await supabaseAdmin
    .from('cm_user_profiles')
    .update({ company_id: 'e143e8d6-c7d7-4315-8f54-aa12ce554d2d' })
    .eq('id', targetUser.id);

  if (profileErr) {
    console.error("Error updating profile mapping:", profileErr);
  } else {
    console.log("Profile company mapping updated successfully.");
  }
}

reset();
