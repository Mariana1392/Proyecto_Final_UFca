const fs = require('fs');
const path = require('path');

const schema = {
  "roles": ["id", "nombre", "descripcion", "activo", "es_sistema", "created_at", "updated_at", "label"],
  "usuarios": ["id", "rol_id", "nombre", "email", "activo", "created_at", "updated_at", "username", "ultimo_acceso", "telefono", "direccion", "cedula", "fecha_ingreso", "referido_por_id", "estado_cuenta", "fecha_suspension", "motivo_suspension"],
  "permisos": ["id", "clave", "label", "descripcion", "grupo", "activo", "created_at", "updated_at"],
  "rol_permisos": ["rol_id", "permiso_clave", "asignado_en", "activo", "created_at", "updated_at"],
  "configuracion": ["id", "clave", "valor", "descripcion", "created_at", "updated_at"],
  "periodos": ["id", "fecha_inicio", "fecha_fin", "estado", "fecha_cierre", "cerrado_por", "utilidad_total", "utilidad_por_asociado", "num_asociados_activos", "created_at", "updated_at", "nombre"],
  "solicitudes_asociados": ["id", "nombres", "apellidos", "cedula", "tipo_identificacion", "telefono", "email", "direccion", "ocupacion", "ingreso_mensual", "motivacion", "estado", "documentos", "observaciones", "fecha_solicitud", "fecha_resolucion", "fecha_activacion", "usuario_id", "created_at", "updated_at", "resuelto_por", "monto_ahorro_propuesto", "aprobado_por", "recordatorio_enviado_at", "ultima_invitacion"],
  "comite_evaluador": ["id", "solicitud_asociado_id", "evaluador_id", "verificaciones", "score_credito", "comentarios", "decision", "observacion", "fecha", "created_at", "updated_at"],
  "creditos": ["id", "asociado_id", "periodo_id", "tipo", "monto", "plazo_meses", "tasa_interes", "tasa_mora", "cuota_mensual", "saldo", "estado", "fecha_desembolso", "fecha_primera_cuota", "fecha_ultima_cuota", "fecha_estado_cambio", "motivo_estado_cambio", "url_comprobante_solicitud", "anulado", "motivo_anulacion", "created_at", "observaciones", "tipo_interes", "anulado_por", "anulado_en", "updated_at", "estado_anterior_mora", "referido_nombre"],
  "cuotas_credito": ["id", "credito_id", "num_cuota", "fecha_vencimiento", "capital", "interes", "cuota_total", "saldo_inicial", "saldo_final", "estado", "created_at", "updated_at"],
  "liquidaciones": ["id", "asociado_id", "periodo_id", "usuario_id", "tipo", "total_ahorro_permanente", "total_ahorro_voluntario", "total_deudas_credito", "utilidades", "monto_neto", "detalle", "observaciones", "created_at", "updated_at", "fecha", "estado", "fecha_corte", "fecha_liquidacion", "anulado", "justificacion_anulacion", "anulado_por", "anulado_en", "monto_total"],
  "distribuciones_utilidades": ["id", "periodo_id", "asociado_id", "utilidad_total_periodo", "num_asociados", "valor_por_asociado", "created_at", "updated_at"],
  "excepciones": ["id", "asociado_id", "credito_id", "tipo", "descripcion", "estado", "resuelto_por", "fecha_resolucion", "created_at", "updated_at"],
  "notificaciones": ["id", "usuario_id", "asociado_id", "tipo", "titulo", "mensaje", "leida", "para_admin", "created_at", "updated_at"],
  "auditoria": ["id", "usuario_id", "asociado_id", "tabla", "registro_id", "created_at", "operacion", "datos_antes", "datos_despues", "accion"],
  "referidos": ["id", "asociado_id", "nombre", "cedula", "telefono", "estado", "observaciones", "created_at", "asociado_convertido_id", "fecha_conversion"],
  "credito_historial_estados": ["id", "credito_id", "estado_anterior", "estado_nuevo", "motivo", "cambiado_por", "cambiado_en"],
  "cuentas_ahorro": ["id", "tipo", "asociado_id", "periodo_id", "monto_ahorrado", "cuota_mensual", "fecha_retiro", "monto_al_cierre", "estado", "fecha_cierre", "anulado", "anulado_por", "anulado_en", "motivo_anulacion", "created_at", "updated_at", "observaciones", "cedula", "multa_mora_vigente"],
  "transacciones": ["id", "tipo", "asociado_id", "registrado_por", "ahorro_id", "credito_id", "cuota_id", "periodo_id", "monto", "capital", "interes", "monto_mora", "dias_mora", "saldo_antes", "saldo_despues", "mes_correspondiente", "fecha_pago", "metodo_pago", "url_comprobante", "observacion", "anulado", "anulado_por", "anulado_en", "motivo_anulacion", "created_at", "updated_at"]
};

const excludeDirs = new Set(["node_modules", ".git", ".vercel", ".claude", "dist", "build", "scratch"]);
const allowedExtensions = new Set([".ts", ".tsx", ".sql", ".html"]);

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!excludeDirs.has(file)) {
        walkDir(filePath, fileList);
      }
    } else {
      const ext = path.extname(file).toLowerCase();
      if (allowedExtensions.has(ext)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

console.log("Scanning files...");
const allFiles = walkDir(".");
console.log(`Found ${allFiles.length} files to scan.`);

const codebase = allFiles.map(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  // Normalize path format
  const normPath = filePath.replace(/\\/g, '/');
  return { path: normPath, content };
});

const results = {};

for (const [table, columns] of Object.entries(schema)) {
  results[table] = {};
  for (const col of columns) {
    const colResults = {
      type_definition: [],
      schema_definition: [],
      frontend_usage: [],
      backend_sql_logic: [],
      other: []
    };

    // Word boundary pattern
    const regex = new RegExp('\\b' + col.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'g');

    for (const file of codebase) {
      const matches = file.content.match(regex);
      const count = matches ? matches.length : 0;
      if (count === 0) continue;

      if (file.path.includes("supabase_schema.sql")) {
        colResults.schema_definition.push({ path: file.path, count });
      } else if (file.path.includes("supabase.ts")) {
        colResults.type_definition.push({ path: file.path, count });
      } else if (file.path.endsWith(".ts") || file.path.endsWith(".tsx")) {
        colResults.frontend_usage.push({ path: file.path, count });
      } else if (file.path.endsWith(".sql")) {
        colResults.backend_sql_logic.push({ path: file.path, count });
      } else {
        colResults.other.push({ path: file.path, count });
      }
    }

    results[table][col] = colResults;
  }
}

// Generate the text report
let report = "DETAILED SCHEMA AUDIT REPORT\n";
report += "============================\n\n";

for (const [table, columns] of Object.entries(results)) {
  report += `TABLE: ${table}\n`;
  report += "-".repeat(7 + table.length) + "\n";
  for (const [col, data] of Object.entries(columns)) {
    report += `  COLUMN: ${col}\n`;

    const totalFe = data.frontend_usage.reduce((sum, item) => sum + item.count, 0);
    const totalBe = data.backend_sql_logic.reduce((sum, item) => sum + item.count, 0);
    const totalType = data.type_definition.reduce((sum, item) => sum + item.count, 0);
    const totalSchema = data.schema_definition.reduce((sum, item) => sum + item.count, 0);

    report += `    Frontend Occurrences: ${totalFe}\n`;
    report += `    Backend SQL Logic Occurrences: ${totalBe}\n`;
    report += `    Type Definition Occurrences: ${totalType}\n`;
    report += `    Schema Definition Occurrences: ${totalSchema}\n`;

    if (data.frontend_usage.length > 0) {
      report += "    Sample Frontend Files:\n";
      data.frontend_usage.slice(0, 3).forEach(item => {
        report += `      - ${item.path} (${item.count} occ)\n`;
      });
    }
    if (data.backend_sql_logic.length > 0) {
      report += "    Sample Backend SQL Logic Files:\n";
      data.backend_sql_logic.slice(0, 3).forEach(item => {
        report += `      - ${item.path} (${item.count} occ)\n`;
      });
    }

    let status = "ACTIVE";
    if (totalFe === 0 && totalBe === 0) {
      status = "POTENTIALLY UNUSED (Only in schema/types)";
    }
    report += `    STATUS: ${status}\n\n`;
  }
}

fs.writeFileSync("scratch/detailed_audit_report.txt", report);
console.log("Detailed report written to scratch/detailed_audit_report.txt successfully!");
