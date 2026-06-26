import { createClient } from "@supabase/supabase-js";
const _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

// copy the entire route.ts code here, but just the fetchAllSales and aggregate parts
