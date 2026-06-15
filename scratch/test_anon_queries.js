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
const supabaseAnonKey = processEnv.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Signing in as adminufca@gmail.com...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'adminufca@gmail.com',
    password: 'admin123'
  });
  
  if (authError) {
    console.error("Sign in failed:", authError);
    return;
  }
  
  console.log("Signed in successfully as:", authData.user.email);
  
  // Now try the exact queries from exportarTodoSistema
  console.log("\nExecuting creditos query...");
  const { data: creditosList, error: errCreds } = await supabase.from('creditos').select('*');
  console.log("Creditos count:", creditosList ? creditosList.length : null, "Error:", errCreds);
  
  console.log("\nExecuting cuentas_ahorro query...");
  const { data: ahorrosList, error: errAhorros } = await supabase.from('cuentas_ahorro').select('*');
  console.log("Cuentas Ahorro count:", ahorrosList ? ahorrosList.length : null, "Error:", errAhorros);
  
  console.log("\nExecuting liquidaciones query...");
  const { data: liquidacionesList, error: errLiqs } = await supabase.from('liquidaciones').select('*');
  console.log("Liquidaciones count:", liquidacionesList ? liquidacionesList.length : null, "Error:", errLiqs);
  
  console.log("\nExecuting transacciones query...");
  const { data: pagosList, error: errPagos } = await supabase
    .from('transacciones').select('*').order('fecha_pago', { ascending: false });
  console.log("Transacciones count:", pagosList ? pagosList.length : null, "Error:", errPagos);
}

run();
