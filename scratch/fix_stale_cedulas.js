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
  console.log('--- REPAIRING CEDULAS / PROFILE INFO ---');
  
  // 1. Fetch users with null/empty cedula
  const { data: users, error: userErr } = await supabase
    .from('usuarios')
    .select('id, nombre, email, cedula, telefono, direccion');
    
  if (userErr) {
    console.error('Error fetching users:', userErr);
    return;
  }
  
  for (const u of users) {
    const isCedulaEmpty = !u.cedula || u.cedula.trim() === '';
    
    if (isCedulaEmpty) {
      console.log(`User ${u.nombre} (${u.email}) has empty cedula. Searching for solicitud...`);
      
      const { data: sol, error: solErr } = await supabase
        .from('solicitudes_asociados')
        .select('*')
        .eq('email', u.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (solErr) {
        console.error(`  Error fetching solicitud for ${u.email}:`, solErr);
        continue;
      }
      
      if (sol) {
        console.log(`  Found approved/pending solicitud. Cedula: ${sol.cedula}, Telefono: ${sol.telefono}, Direccion: ${sol.direccion}`);
        
        // Update user
        const { error: updErr } = await supabase
          .from('usuarios')
          .update({
            cedula: sol.cedula,
            telefono: sol.telefono || u.telefono || '',
            direccion: sol.direccion || u.direccion || ''
          })
          .eq('id', u.id);
          
        if (updErr) {
          console.error(`  Error updating user ${u.email}:`, updErr);
        } else {
          console.log(`  User ${u.nombre} updated successfully with cedula: ${sol.cedula}.`);
        }
        
        // Link solicitud to user
        const { error: linkErr } = await supabase
          .from('solicitudes_asociados')
          .update({ usuario_id: u.id })
          .eq('id', sol.id);
          
        if (linkErr) {
          console.error(`  Error linking solicitud for ${u.email}:`, linkErr);
        } else {
          console.log(`  Solicitud successfully linked to user ID.`);
        }
      } else {
        console.log(`  No solicitud found for email ${u.email}.`);
      }
    }
  }
  
  console.log('--- REPAIR COMPLETE ---');
}

run();
