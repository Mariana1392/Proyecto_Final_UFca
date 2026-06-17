import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read env variables
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Env variables not loaded correctly', { supabaseUrl, hasKey: !!supabaseServiceKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('Querying database info for Darcy...');
  
  // 1. Get Darcy user
  const email = 'pruebasufca248@gmail.com';
  const { data: user, error: userErr } = await supabase
    .from('usuarios')
    .select('*, roles(*)')
    .eq('email', email)
    .maybeSingle();

  if (userErr) {
    console.error('Error fetching user:', userErr);
  } else {
    console.log('User Darcy details:', JSON.stringify(user, null, 2));
  }

  if (user) {
    // 2. Get her account in cuentas_ahorro
    const { data: accounts, error: accErr } = await supabase
      .from('cuentas_ahorro')
      .select('*')
      .eq('asociado_id', user.id);
      
    if (accErr) {
      console.error('Error fetching accounts:', accErr);
    } else {
      console.log('User accounts:', JSON.stringify(accounts, null, 2));
    }

    // 3. Get her solicitudes
    const { data: solicitudes, error: solErr } = await supabase
      .from('solicitudes_asociados')
      .select('*')
      .eq('usuario_id', user.id);
      
    if (solErr) {
      console.error('Error fetching solicitudes:', solErr);
    } else {
      console.log('User solicitudes:', JSON.stringify(solicitudes, null, 2));
    }

    // 4. Get permissions for her role
    if (user.rol_id) {
      const { data: permissions, error: permErr } = await supabase
        .from('rol_permisos')
        .select('*')
        .eq('rol_id', user.rol_id);
        
      if (permErr) {
        console.error('Error fetching permissions:', permErr);
      } else {
        console.log('Role permissions for Darcy role:', JSON.stringify(permissions, null, 2));
      }
    }
  }
}

run();
