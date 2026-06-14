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
  console.log("Checking referred users...");
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nombre, email, cedula, referido_por_id')
      .not('referido_por_id', 'is', null);
    if (error) {
      console.error(error);
    } else {
      console.log(`Found ${data.length} users with referred_por_id set:`);
      console.table(data);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
