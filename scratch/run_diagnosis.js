import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env
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
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define components to audit
const frontendComponents = [
  'src/components/Roles.tsx',
  'src/components/GestionUsuarios.tsx',
  'src/components/Login.tsx',
  'src/components/RecuperarPassword.tsx',
  'src/components/RestablecerPassword.tsx',
  'src/components/CrearPassword.tsx',
  'src/components/Dashboard.tsx',
  'src/components/DashboardAsociado.tsx',
  'src/components/Reportes.tsx',
  'src/components/ComiteEvaluador.tsx',
  'src/components/ahorro-permanente/AhorroPermanente.tsx',
  'src/components/ahorro-voluntario/AhorroVoluntario.tsx',
  'src/components/creditos/Creditos.tsx',
  'src/components/liquidaciones/index.tsx',
  'src/components/liquidaciones/useLiquidacionStepper.ts',
  'src/components/liquidaciones/useLiquidacionesCRUD.ts',
];

const databaseTables = [
  'usuarios',
  'roles',
  'permisos',
  'rol_permisos',
  'configuracion',
  'periodos',
  'solicitudes_asociados',
  'comite_evaluador',
  'creditos',
  'cuotas_credito',
  'liquidaciones',
  'distribuciones_utilidades',
  'excepciones',
  'notificaciones',
  'auditoria',
  'referidos',
  'credito_historial_estados',
  'cuentas_ahorro',
  'transacciones'
];

async function run() {
  console.log("=== INICIANDO AUDITORÍA Y DIAGNÓSTICO COMPLETO ===");
  console.log("Supabase URL:", supabaseUrl);
  
  const report = {
    timestamp: new Date().toISOString(),
    frontend_files: {},
    database_tables: {},
    configuration_parameters: {},
    summary: {
      total_files_checked: frontendComponents.length,
      files_ok: 0,
      total_tables_checked: databaseTables.length,
      tables_ok: 0
    }
  };

  // 1. Audit Frontend files
  console.log("\n--- Auditando archivos del Frontend... ---");
  for (const file of frontendComponents) {
    const fullPath = path.resolve(__dirname, '../', file);
    const exists = fs.existsSync(fullPath);
    report.frontend_files[file] = {
      exists,
      path: fullPath,
      sizeBytes: exists ? fs.statSync(fullPath).size : 0
    };
    if (exists) {
      report.summary.files_ok++;
      console.log(`[OK] Archivo '${file}' existe. (${report.frontend_files[file].sizeBytes} bytes)`);
    } else {
      console.log(`[ERROR] Archivo '${file}' NO EXISTE.`);
    }
  }

  // 2. Audit DB Tables and row count
  console.log("\n--- Auditando tablas de la Base de Datos... ---");
  for (const table of databaseTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) {
        report.database_tables[table] = {
          exists: false,
          error: error.message,
          code: error.code
        };
        console.log(`[ERROR] Tabla '${table}': ${error.message}`);
      } else {
        report.database_tables[table] = {
          exists: true,
          rowCount: count
        };
        report.summary.tables_ok++;
        console.log(`[OK] Tabla '${table}': Existe. Registros: ${count}`);
      }
    } catch (e) {
      report.database_tables[table] = {
        exists: false,
        error: e.message
      };
      console.log(`[EXCEPTION] Tabla '${table}': ${e.message}`);
    }
  }

  // 3. Query Configuration parameters
  console.log("\n--- Consultando Parámetros de Configuración... ---");
  try {
    const { data: configData, error: configErr } = await supabase
      .from('configuracion')
      .select('clave, valor, descripcion');
    if (configErr) {
      console.log("[ERROR] No se pudo leer la tabla de configuración:", configErr.message);
    } else {
      console.log(`Se encontraron ${configData.length} parámetros en configuracion:`);
      for (const param of configData) {
        report.configuration_parameters[param.clave] = {
          valor: param.valor,
          descripcion: param.descripcion
        };
        console.log(`  - ${param.clave} = "${param.valor}" (${param.descripcion || 'Sin descripción'})`);
      }
    }
  } catch (e) {
    console.log("[EXCEPTION] Error leyendo configuración:", e.message);
  }

  // Save report
  const reportPath = path.resolve(__dirname, 'diagnostico_resultado.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n=== AUDITORÍA COMPLETA GUARDADA EN ${reportPath} ===`);
}

run();
