import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim();
    env[key] = val;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('--- Inspecting Database Schema and Functions ---');
  
  // 1. Get fn_mi_asociado_id function definition
  const { data: funcDef, error: funcErr } = await supabase.rpc('inspect_function', { func_name: 'fn_mi_asociado_id' });
  if (funcErr) {
    // If inspect_function helper RPC doesn't exist, let's run it via sql or try another way.
    // Wait, let's check if we can execute raw SQL using a postgres query or info schema.
    console.log('inspect_function RPC failed. Let us try querying functions using supabase...');
  }
  
  // Let's check columns of usuarios
  const { data: columns, error: colErr } = await supabase
    .from('usuarios')
    .select('*')
    .limit(1);
    
  if (columns && columns.length > 0) {
    console.log('Columns in usuarios table:', Object.keys(columns[0]));
  }
}
run();
