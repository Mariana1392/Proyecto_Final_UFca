import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('c:/Users/dairi/OneDrive/Documentos/Proyecto_Final_UFca/.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, val] = line.split('=');
  if (key && val) {
    envVars[key.trim()] = val.trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("--- DARCY USER RECORD ---");
    
    // Fetch Darcy user record
    const { data: user, error: errUser } = await supabase
      .from('usuarios')
      .select('id, nombre, email, username, activo, rol_id, roles(nombre, label, rol_permisos(permiso_clave, activo))')
      .ilike('nombre', '%Darcy%')
      .maybeSingle();

    if (errUser) {
      console.error("Error fetching Darcy:", errUser.message);
    } else if (!user) {
      console.log("No user found with name Darcy.");
    } else {
      console.log("Darcy user record:", {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        activo: user.activo,
        rol_id: user.rol_id,
        rol_nombre: user.roles?.nombre,
        rol_label: user.roles?.label
      });
      console.log("Darcy permissions in roles:");
      const dbPermisos = Array.isArray(user.roles?.rol_permisos)
        ? user.roles.rol_permisos
            .filter((rp) => rp.activo !== false)
            .map((rp) => rp.permiso_clave)
        : [];
      console.log(dbPermisos);
    }

  } catch (err) {
    console.error("Runtime error:", err);
  }
}

run();
