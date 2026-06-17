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

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Fetch latest notifications
    console.log("--- LATEST NOTIFICATIONS ---");
    const { data: notifications, error: errNotif } = await supabase
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (errNotif) {
      console.error("Error fetching notifications:", errNotif.message);
    } else {
      console.log(`Found ${notifications.length} notifications:`);
      notifications.forEach(n => {
        console.log(`ID: ${n.id} | Titulo: ${n.titulo} | Mensaje: ${n.mensaje} | Para Admin: ${n.para_admin} | Creado: ${n.created_at} | leida: ${n.leida}`);
      });
    }

    // 2. Fetch policies from pg_policies via RPC or ad-hoc query
    // Wait, let's query the policies by running a direct RPC or seeing if any sql execution function is available
    // Otherwise, we can execute SQL through a custom RPC if we find it.

  } catch (err) {
    console.error("Runtime error:", err);
  }
}

run();
