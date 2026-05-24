import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Error fetching users:', error);
  } else {
    const user = data.users.find(u => u.email === 'cristiano@coffeemais.com');
    if (user) {
      console.log('O e-mail cristiano@coffeemais.com ESTÁ CADASTRADO.', user.id);
    } else {
      console.log('O e-mail cristiano@coffeemais.com NÃO está cadastrado.');
    }
  }
}

checkUser();
