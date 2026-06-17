import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const { data: users, error: uErr } = await supabase
    .from('usuarios')
    .select('id, nombre, email, fecha_ingreso')
    .not('fecha_ingreso', 'is', null)
    .limit(10);
  
  console.log("Users with fecha_ingreso:", users);

  const { data: allUsers, error: allErr } = await supabase
    .from('usuarios')
    .select('id, nombre, email, fecha_ingreso')
    .limit(5);
  
  console.log("All first 5 users:", allUsers);
}

run();
