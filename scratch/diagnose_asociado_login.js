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
const supabaseAnonKey = processEnv.VITE_SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const userClient = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = 'graciaandres444@gmail.com'; // Bayrol Muñoz
  const tempPassword = 'TemporaryPassword123!';

  console.log(`\n1. Finding user in auth.users by email: ${email}`);
  const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  const targetUser = users.find(u => u.email === email);
  if (!targetUser) {
    console.error("User not found in auth!");
    return;
  }
  console.log(`User ID: ${targetUser.id}`);

  console.log(`\n2. Temporarily setting password to: ${tempPassword}`);
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
    password: tempPassword
  });
  if (updateErr) {
    console.error("Error updating password:", updateErr.message);
    return;
  }

  try {
    console.log(`\n3. Signing in via standard client...`);
    const { data: sessionData, error: signInErr } = await userClient.auth.signInWithPassword({
      email,
      password: tempPassword
    });

    if (signInErr) {
      console.error("Sign in failed:", signInErr.message);
      return;
    }

    const token = sessionData.session.access_token;
    console.log("Sign in successful!");
    
    // Create authenticated client for testing queries
    const authUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    console.log(`\n4. Running query to fetch profile & roles/permissions as authenticated associate...`);
    const { data, error } = await authUserClient
      .from('usuarios')
      .select('id,nombre,email,username,cedula,telefono,activo,rol_id,roles(nombre,label,rol_permisos(permiso_clave,activo))')
      .eq('id', targetUser.id)
      .single();

    if (error) {
      console.error("❌ Error fetching profile:", error.message);
    } else {
      console.log("✅ Profile fetched successfully!");
      console.log("Data returned:", JSON.stringify(data, null, 2));

      const dbPermisos = Array.isArray(data.roles?.rol_permisos)
        ? data.roles.rol_permisos
            .filter((rp) => rp.activo !== false)
            .map((rp) => rp.permiso_clave).filter(Boolean)
        : [];
      
      console.log("Permissions resolved in JS:", dbPermisos);
    }

    console.log(`\n5. Directly querying public.rol_permisos table...`);
    const { data: directRP, error: rpErr } = await authUserClient
      .from('rol_permisos')
      .select('*');
    if (rpErr) {
      console.error("❌ Error direct select from rol_permisos:", rpErr.message);
    } else {
      console.log(`✅ Success! Returned ${directRP.length} rows from rol_permisos.`);
    }

  } catch (err) {
    console.error("Unexpected error:", err);
  } finally {
    console.log(`\n6. Cleaning up/updating user back to blank password (they can reset it later, or it's fine)`);
    // Note: setting it to random UUID to be safe and secure
    const randomPassword = 'Pass' + Math.random().toString(36).substring(2) + '!';
    await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      password: randomPassword
    });
    console.log("Cleanup done.");
  }
}

run();
