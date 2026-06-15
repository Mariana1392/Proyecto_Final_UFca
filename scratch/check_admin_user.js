import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8').replace(/\r/g, '');
const processEnv = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const parts = trimmed.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let value = parts.slice(1).join('=').trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    processEnv[key] = value;
  }
});

const supabaseUrl = processEnv.VITE_SUPABASE_URL;
const supabaseServiceKey = processEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  // We can query pg_policies using supabase.rpc or a direct query?
  // Wait, does Supabase have a way to run sql directly? Usually it's not exposed via RPC unless there's a custom function like 'exec_sql'.
  // Let's check if there is an rpc function we can use, or we can check the database schemas/policies.
  // Wait, can we read the list of active policies? Let's check what functions/RPCs are available.
  // Let's check users and roles first.
  const { data: users, error: usersErr } = await supabase
    .from('usuarios')
    .select(`
      id, nombre, email, username, activo, rol_id, roles(nombre)
    `);
  console.log("Users and roles:", users, usersErr);
  
  // Let's check RLS status of tables:
  // We can check the policies in pg_policies by querying via a postgres RPC if one exists.
  // Let's check if we can query from a table or view that has policy info, or check the migration files.
}

run();
