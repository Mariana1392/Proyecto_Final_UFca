import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env robustly
const envPath = 'c:/Users/maria/OneDrive/Desktop/Proyecto_Final_UFca/.env';
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
  console.log("Checking for any users with missing cedula...");
  const { data: missingUsrs, error: missErr } = await supabase
    .from('usuarios')
    .select('id, nombre, email, cedula, telefono, direccion')
    .or('cedula.is.null,cedula.eq.""');

  if (missErr) {
    console.error("Error counting missing usuarios:", missErr);
  } else {
    console.log(`\n--- USUARIOS WITHOUT CEDULA (${missingUsrs.length} found) ---`);
    console.table(missingUsrs);
  }

  console.log("\nChecking recently updated users:");
  const { data: updatedUsrs, error: updErr } = await supabase
    .from('usuarios')
    .select('id, nombre, email, cedula, telefono, direccion')
    .in('email', [
      'mva25189@gmail.com',
      'dairoslos123@gmail.com',
      'montielprueb@gmail.com',
      'mariavelenciaospina@gmail.com'
    ]);

  if (updErr) {
    console.error("Error fetching updated users:", updErr);
  } else {
    console.table(updatedUsrs);
  }
}

run();
