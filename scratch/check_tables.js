import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse .env relative to current working directory
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
  console.log("Supabase URL:", supabaseUrl);
  
  // Count creditos
  const { count: credsCount, error: credsErr } = await supabase
    .from('creditos')
    .select('*', { count: 'exact', head: true });
  console.log("Creditos count:", credsCount, "Error:", credsErr);

  // Count cuentas_ahorro
  const { count: ahorrosCount, error: ahorrosErr } = await supabase
    .from('cuentas_ahorro')
    .select('*', { count: 'exact', head: true });
  console.log("Cuentas Ahorro count:", ahorrosCount, "Error:", ahorrosErr);

  // Count liquidaciones
  const { count: liqsCount, error: liqsErr } = await supabase
    .from('liquidaciones')
    .select('*', { count: 'exact', head: true });
  console.log("Liquidaciones count:", liqsCount, "Error:", liqsErr);

  // Count transacciones
  const { count: pagosCount, error: pagosErr } = await supabase
    .from('transacciones')
    .select('*', { count: 'exact', head: true });
  console.log("Transacciones count:", pagosCount, "Error:", pagosErr);
  
  // Print some records to check fields
  const { data: credsSample } = await supabase.from('creditos').select('*').limit(1);
  console.log("\nCreditos Sample:", credsSample);

  const { data: ahorrosSample } = await supabase.from('cuentas_ahorro').select('*').limit(1);
  console.log("\nCuentas Ahorro Sample:", ahorrosSample);

  const { data: liqsSample } = await supabase.from('liquidaciones').select('*').limit(1);
  console.log("\nLiquidaciones Sample:", liqsSample);

  const { data: pagosSample } = await supabase.from('transacciones').select('*').limit(1);
  console.log("\nTransacciones Sample:", pagosSample);
}

run();
