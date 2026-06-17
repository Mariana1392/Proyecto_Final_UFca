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
  console.log("=== FOCUS AUDIT ON TARGET USERS ===");

  const targetEmails = [
    'dairomontiel20@gmail.com',
    'mariavelenciaospina@gmail.com',
    'paolamontiel153@gmail.com',
    'marianavalenciaospina511@gmail.com',
    'dairoslos123@gmail.com'
  ];

  for (const email of targetEmails) {
    console.log(`\n---------------------------------------------------------`);
    console.log(`EMAIL: ${email}`);

    // 1. Get user record
    const { data: user, error: uErr } = await supabase
      .from('usuarios')
      .select('id, nombre, email, activo, estado_cuenta, rol_id, roles(nombre)')
      .eq('email', email)
      .maybeSingle();
    
    if (uErr) {
      console.error("Error fetching user:", uErr);
      continue;
    }
    if (!user) {
      console.log("No user found in public.usuarios");
      continue;
    }

    console.log(`User in public.usuarios: id=${user.id}, nombre=${user.nombre}, activo=${user.activo}, estado_cuenta=${user.estado_cuenta}, rol=${user.roles?.nombre}`);

    // 2. Get solicitu_asociado
    const { data: sol, error: solErr } = await supabase
      .from('solicitudes_asociados')
      .select('id, nombres, apellidos, estado, usuario_id, cedula')
      .eq('email', email)
      .maybeSingle();
    
    if (solErr) {
      console.error("Error fetching solicitud:", solErr);
    } else if (sol) {
      console.log(`Solicitud: id=${sol.id}, nombre=${sol.nombres} ${sol.apellidos}, estado=${sol.estado}, usuario_id_linked=${sol.usuario_id}, cedula=${sol.cedula}`);
    } else {
      console.log("No solicitud found for this email");
    }

    // 3. Get saving accounts
    const { data: accounts, error: accErr } = await supabase
      .from('cuentas_ahorro')
      .select('id, tipo, estado, monto_ahorrado, anulado, created_at')
      .eq('asociado_id', user.id);
    
    if (accErr) {
      console.error("Error fetching accounts:", accErr);
    } else {
      console.log(`Accounts count: ${accounts.length}`);
      if (accounts.length > 0) {
        console.table(accounts);
      }
    }

    // 4. Get transactions
    const { data: txs, error: txErr } = await supabase
      .from('transacciones')
      .select('id, tipo, monto, fecha_pago, ahorro_id, credito_id, anulado, created_at')
      .eq('asociado_id', user.id);

    if (txErr) {
      console.error("Error fetching transactions:", txErr);
    } else {
      console.log(`Transactions count: ${txs.length}`);
      if (txs.length > 0) {
        console.table(txs);
      }
    }
  }
}

run();
