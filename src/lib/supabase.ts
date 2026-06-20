import { createBrowserClient } from "@supabase/ssr";

let supabaseInstance: any = null;

function getSupabaseInstance() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("Supabase client initialized without environment variables.");
    }
    
    supabaseInstance = createBrowserClient(
      supabaseUrl || "",
      supabaseAnonKey || ""
    );
  }
  return supabaseInstance;
}

export const supabase = new Proxy({} as any, {
  get(target, prop) {
    const instance = getSupabaseInstance();
    const value = instance[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
  set(target, prop, value) {
    const instance = getSupabaseInstance();
    instance[prop] = value;
    return true;
  }
});

