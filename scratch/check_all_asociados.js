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
  console.log('--- Querying all users with roles ---');
  
  const { data: users, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, activo, rol_id, estado_cuenta, roles(nombre)')
    .order('email');
    
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  console.log('All users count:', users.length);
  for (const u of users) {
    const rol = u.roles?.nombre ?? 'no role';
    console.log(`Email: ${u.email} | Name: ${u.nombre} | Role: ${rol} | Activo: ${u.activo} | Estado: ${u.estado_cuenta}`);
    
    if (rol === 'asociado') {
      // Fetch accounts
      const { data: accounts } = await supabase
        .from('cuentas_ahorro')
        .select('tipo, estado, monto_ahorrado, anulado')
        .eq('asociado_id', u.id);
        
      console.log(`  -> Accounts:`, accounts);
    }
  }
}
run();
