import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Leer .env
const envPath    = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8').replace(/\r/g, '');
const processEnv = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const parts = trimmed.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let value = parts.slice(1).join('=').trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1);
    }
    processEnv[key] = value;
  }
});

const supabaseUrl  = processEnv.VITE_SUPABASE_URL;
const supabaseKey  = processEnv.VITE_SUPABASE_ANON_KEY;
const supabase     = createClient(supabaseUrl, supabaseKey);

async function listarPermisos() {
  console.log('\n======================================================');
  console.log('  PERMISOS EN BASE DE DATOS');
  console.log('======================================================\n');

  const { data, error } = await supabase
    .from('permisos')
    .select('clave, label, descripcion, grupo, activo')
    .order('grupo, clave');

  if (error) {
    console.error('Error al consultar permisos:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No se encontraron permisos en la base de datos.');
    return;
  }

  console.log(`Total de permisos encontrados: ${data.length}\n`);

  // Agrupar por grupo
  const grupos = {};
  data.forEach(p => {
    const g = p.grupo || 'Sin grupo';
    if (!grupos[g]) grupos[g] = [];
    grupos[g].push(p);
  });

  Object.entries(grupos).forEach(([grupo, permisos]) => {
    console.log(`\n📂 ${grupo.toUpperCase()}`);
    console.log('-'.repeat(50));
    permisos.forEach(p => {
      const estado = p.activo ? '✅' : '❌';
      console.log(`  ${estado}  ${p.clave.padEnd(35)} → ${p.label || p.descripcion || ''}`);
    });
  });

  console.log('\n======================================================\n');
}

listarPermisos();
