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

const tablesToCheck = [
  'usuarios',
  'roles',
  'asociados',
  'ahorro_permanente',
  'ahorro_voluntario',
  'cuentas_ahorro',
  'creditos',
  'pagos_credito',
  'transacciones',
  'categorias',
  'productos',
  'proveedores',
  'compras',
  'detalle_compras',
  'ventas',
  'detalle_ventas',
  'pedidos',
  'detalle_pedidos',
  'eventos',
  'pagos_premios',
  'liquidaciones',
  'solicitudes_credito',
  'solicitudes_asociados',
  'configuracion',
  'auditoria'
];

async function run() {
  console.log("Checking Supabase tables for URL:", supabaseUrl);
  for (const table of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`Table '${table}': ERROR: ${error.message} (Code: ${error.code})`);
      } else {
        console.log(`Table '${table}': OK. Row count: ${count}`);
      }
    } catch (e) {
      console.log(`Table '${table}': EXCEPTION: ${e.message}`);
    }
  }
}

run();
