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
  console.log("Repairing existing users with missing details from solicitudes_asociados...");
  
  // 1. Get all users with missing cedula
  const { data: users, error: usersErr } = await supabase
    .from('usuarios')
    .select('id, nombre, email, cedula, telefono, direccion')
    .or('cedula.is.null,cedula.eq.""');

  if (usersErr) {
    console.error("Error fetching users:", usersErr);
    return;
  }

  console.log(`Found ${users.length} users with missing cedula.`);

  for (const user of users) {
    console.log(`Processing user ${user.nombre} (${user.email})...`);
    
    // Find matching request in solicitudes_asociados
    const { data: sols, error: solsErr } = await supabase
      .from('solicitudes_asociados')
      .select('id, cedula, telefono, direccion')
      .eq('email', user.email)
      .order('fecha_solicitud', { ascending: false })
      .limit(1);

    if (solsErr) {
      console.error(`Error fetching request for ${user.email}:`, solsErr);
      continue;
    }

    if (!sols || sols.length === 0) {
      console.log(`No matching request found in solicitudes_asociados for ${user.email}`);
      continue;
    }

    const sol = sols[0];
    console.log(`Found request with cedula: ${sol.cedula}, tel: ${sol.telefono}, dir: ${sol.direccion}`);

    // Update usuario
    const { error: updateErr } = await supabase
      .from('usuarios')
      .update({
        cedula: sol.cedula,
        telefono: sol.telefono || user.telefono,
        direccion: sol.direccion || user.direccion
      })
      .eq('id', user.id);

    if (updateErr) {
      console.error(`Error updating user ${user.nombre}:`, updateErr);
    } else {
      console.log(`Successfully updated user ${user.nombre} in table public.usuarios!`);
    }

    // Update solicitudes_asociados to link usuario_id if needed
    const { error: linkErr } = await supabase
      .from('solicitudes_asociados')
      .update({ usuario_id: user.id })
      .eq('id', sol.id);

    if (linkErr) {
      console.error(`Error linking request ${sol.id} to user ${user.id}:`, linkErr);
    } else {
      console.log(`Successfully linked request ${sol.id} to user ${user.id}!`);
    }
  }

  console.log("Repair finished!");
}

run();
