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
    console.log("--- PERMISSIONS CHECK ---");
    
    // Fetch rol_permisos table contents
    const { data: allRp, error: errAllRp } = await supabase
      .from('rol_permisos')
      .select('*, roles(nombre)');

    if (errAllRp) {
      console.error("Error reading rol_permisos:", errAllRp.message);
    } else {
      console.log("Admin permissions from rol_permisos:");
      const adminPerms = allRp.filter(rp => rp.roles?.nombre?.toLowerCase() === 'admin');
      adminPerms.forEach(rp => {
        console.log(`- Permiso Clave: ${rp.permiso_clave} | Activo: ${rp.activo}`);
      });
    }

  } catch (err) {
    console.error("Runtime error:", err);
  }
}

run();
