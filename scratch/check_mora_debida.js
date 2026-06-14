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
  console.log("Checking accounts and credits in database to see who should be in mora...");
  
  const hoy = new Date();
  const diaHoy = hoy.getDate();
  const diasMoraGlobal = diaHoy >= 17 ? diaHoy - 16 : 0;
  console.log(`Today is day: ${diaHoy}, so diasMoraGlobal is: ${diasMoraGlobal}`);
  
  const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;

  // 1. Cuentas de ahorro
  const { data: cuentasData, error: ctErr } = await supabase
    .from('cuentas_ahorro')
    .select('id, tipo, asociado_id, estado, anulado, multa_mora_vigente')
    .eq('estado', 'activo')
    .eq('anulado', false);

  if (ctErr) {
    console.error("Error fetching accounts:", ctErr);
    return;
  }

  // 2. Aportes this month
  const { data: transMes } = await supabase
    .from('transacciones')
    .select('ahorro_id, tipo')
    .in('tipo', ['aporte_permanente', 'aporte_voluntario'])
    .eq('anulado', false)
    .gte('fecha_pago', primerDiaMes);

  const pagadoPermIds = new Set();
  (transMes || []).forEach(t => {
    if (t.tipo === 'aporte_permanente') pagadoPermIds.add(t.ahorro_id);
  });

  // 3. Fetch users
  const { data: users, error: usrErr } = await supabase
    .from('usuarios')
    .select('id, nombre, email, cedula, rol_id');

  const usersMap = {};
  (users || []).forEach(u => { usersMap[u.id] = u; });

  console.log(`Found ${cuentasData.length} active accounts.`);
  
  const listadoMora = [];
  cuentasData.forEach(c => {
    if (c.tipo === 'permanente') {
      const usr = usersMap[c.asociado_id];
      const hasPaid = pagadoPermIds.has(c.id);
      if (!hasPaid && diasMoraGlobal > 0) {
        listadoMora.push({
          id: c.id,
          asociado: usr?.nombre || 'Desconocido',
          cedula: usr?.cedula || '',
          diasMora: diasMoraGlobal,
          multa_vigente: c.multa_mora_vigente
        });
      }
    }
  });

  console.log(`\n--- ACCOUNTS DETECTED IN MORA (${listadoMora.length}) ---`);
  console.table(listadoMora);

  // 4. Fetch credits in mora
  const { data: creditosMora } = await supabase
    .from('creditos')
    .select('id, asociado_id, monto, saldo, cuota_mensual, tasa_interes, fecha_desembolso, plazo_meses, estado')
    .eq('estado', 'en_mora')
    .eq('anulado', false);

  console.log(`\n--- CREDITS IN MORA (${creditosMora?.length || 0}) ---`);
  console.table(creditosMora);
}

run();
