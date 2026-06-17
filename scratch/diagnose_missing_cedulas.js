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
  console.log("Checking for any users with missing or empty cedula...");
  const { data: missingUsrs, error: missErr } = await supabase
    .from('usuarios')
    .select('id, nombre, email, cedula, telefono, direccion')
    .or('cedula.is.null,cedula.eq.""');

  if (missErr) {
    console.error("Error fetching usuarios:", missErr);
  } else {
    console.log(`Found ${missingUsrs.length} users with missing or empty cedula:`);
    console.log(JSON.stringify(missingUsrs, null, 2));
  }
}

run();
