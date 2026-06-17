import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('c:/Users/dairi/OneDrive/Documentos/Proyecto_Final_UFca/.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, val] = line.split('=');
  if (key && val) {
    envVars[key.trim()] = val.trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // Query pg_constraint for public.notificaciones table
    const query = `
      SELECT 
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_constraint con
      INNER JOIN pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public' AND rel.relname = 'notificaciones';
    `;

    // Wait, since we can't run raw SQL query directly, let's see if there is an RPC.
    // Let's try to query the REST endpoint if it's exposed or if we can use standard RPC.
    // Wait, let's check if the rpc "get_dashboard_stats" exists or check if there is an RPC we can use.
    // If not, let's check if we can query pg_catalog.pg_constraint.
    const { data, error } = await supabase
      .from('pg_constraint')
      .select('*');
    
    if (error) {
      console.log("pg_constraint query via REST failed:", error.message);
    } else {
      console.log("pg_constraint rows:", data);
    }

  } catch (err) {
    console.error("Runtime error:", err);
  }
}

run();
