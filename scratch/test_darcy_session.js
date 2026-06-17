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
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const adminClient = createClient(supabaseUrl, supabaseServiceKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = 'pruebasufca248@gmail.com';
  console.log(`Setting temporary password for ${email}...`);
  
  // 1. Get Darcy's auth user ID
  const { data: { users }, error: listErr } = await adminClient.auth.admin.listUsers();
  if (listErr) {
    console.error('Error listing users:', listErr);
    return;
  }
  const darcyAuth = users.find(u => u.email === email);
  if (!darcyAuth) {
    console.error('Darcy auth user not found!');
    return;
  }
  console.log('Darcy auth user ID:', darcyAuth.id);
  
  // Update password
  const tempPassword = 'TempPassword123!';
  const { data: updateData, error: updateErr } = await adminClient.auth.admin.updateUserById(
    darcyAuth.id,
    { password: tempPassword }
  );
  if (updateErr) {
    console.error('Error updating password:', updateErr);
    return;
  }
  console.log('Temporary password set successfully.');
  
  // 2. Sign in using anon client (simulating frontend)
  console.log('Signing in as Darcy with anon client...');
  const { data: sessionData, error: signInErr } = await anonClient.auth.signInWithPassword({
    email,
    password: tempPassword
  });
  
  if (signInErr) {
    console.error('Sign in failed:', signInErr);
    return;
  }
  console.log('Sign in successful! JWT acquired.');

  // Call fn_mi_asociado_id
  const { data: fnVal, error: fnErr } = await anonClient.rpc('fn_mi_asociado_id');
  console.log('fn_mi_asociado_id() returned:', fnVal, 'error:', fnErr);
  
  // 3. Execute profile query exactly like in AuthContext.tsx
  console.log('Executing frontend query...');
  const { data, error } = await anonClient
    .from('usuarios')
    .select('id,nombre,email,username,cedula,telefono,activo,rol_id,roles(nombre,label,rol_permisos(permiso_clave,activo))')
    .eq('id', darcyAuth.id)
    .single();
    
  if (error) {
    console.error('Frontend query FAILED:', error);
  } else {
    console.log('Frontend query returned:', JSON.stringify(data, null, 2));
  }
  
  // 4. Query cuentas_ahorro
  console.log('Querying cuentas_ahorro for Darcy...');
  const { data: cuenta, error: cuentaErr } = await anonClient
    .from('cuentas_ahorro')
    .select('id, estado, monto_ahorrado')
    .eq('asociado_id', darcyAuth.id)
    .eq('tipo', 'permanente')
    .eq('anulado', false)
    .limit(1)
    .maybeSingle();
    
  if (cuentaErr) {
    console.error('cuentas_ahorro query FAILED:', cuentaErr);
  } else {
    console.log('cuentas_ahorro query returned:', cuenta);
  }

  // 5. Query roles table directly
  console.log('Querying roles table directly for Darcy...');
  const { data: rolesData, error: rolesErr } = await anonClient
    .from('roles')
    .select('*');
  if (rolesErr) {
    console.error('roles query FAILED:', rolesErr);
  } else {
    console.log('roles query returned:', rolesData);
  }
}

run();
