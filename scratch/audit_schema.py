import os
import re

# Dictionary of tables and their columns to verify
schema = {
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
}

exclude_dirs = ["node_modules", ".git", ".vercel", ".claude", "dist", "build", "scratch"]

# Read all relevant file contents
file_contents = []
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for file in files:
        if file.lower().endswith(('.ts', '.tsx', '.sql', '.json', '.html')):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    file_contents.append((filepath, f.read()))
            except Exception:
                pass

print(f"Loaded {len(file_contents)} codebase files for searching.")

results = {}

for table, columns in schema.items():
    results[table] = {}
    for col in columns:
        # We search for the column name.
        # To avoid false negatives on generic names, we do a substring count.
        # For very generic columns, we want to know if it's used at all, but we also inspect
        # if there are specific occurrences of table.column or as properties.
        count = 0
        matching_files = []
        
        # Word boundary pattern for column search
        pattern = re.compile(r'\b' + re.escape(col) + r'\b')
        
        for filepath, content in file_contents:
            occ = len(pattern.findall(content))
            if occ > 0:
                count += occ
                matching_files.append((filepath, occ))
        
        results[table][col] = {
            "count": count,
            "files": matching_files
        }

# Generate Audit Report
report_path = r"C:\Users\maria\.gemini\antigravity\brain\941fb00a-6c8e-4bcf-b3f9-dc4b3a22e174\audit_report.md"
with open(report_path, "w", encoding="utf-8") as rf:
    rf.write("# Schema Audit Report\n\n")
    rf.write("This report lists all columns from the database schema and verifies if they are referenced in the codebase.\n\n")
    
    for table, cols in results.items():
        rf.write(f"## Table `{table}`\n\n")
        rf.write("| Column | Total Occurrences | Status | Sample Files (Occurrences) |\n")
        rf.write("|---|---|---|---|\n")
        for col, data in cols.items():
            count = data["count"]
            status = "✅ USED" if count > 0 else "❌ UNUSED"
            files_str = ", ".join([f"[{os.path.basename(f[0])}]({f[0]}#L1) ({f[1]})" for f in data["files"][:3]])
            if len(data["files"]) > 3:
                files_str += f" and {len(data['files']) - 3} more"
            if not files_str:
                files_str = "None"
            rf.write(f"| `{col}` | {count} | {status} | {files_str} |\n")
        rf.write("\n")

print(f"Audit report generated at: {report_path}")
# Also print columns that have 0 occurrences in console
print("\n--- UNUSED COLUMNS DETECTED ---")
unused_found = False
for table, cols in results.items():
    for col, data in cols.items():
        if data["count"] == 0:
            print(f"Table '{table}': Column '{col}' is NOT referenced in any code or migration file.")
            unused_found = True
if not unused_found:
    print("None! All columns have at least one reference in the workspace.")
