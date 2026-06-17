import os
import re

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

# Load files
codebase = []
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in exclude_dirs]
    for file in files:
        if file.lower().endswith(('.ts', '.tsx', '.sql', '.html')):
            filepath = os.path.join(root, file)
            # Normalize path delimiters
            filepath = filepath.replace('\\', '/')
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                codebase.append((filepath, content))
            except Exception as e:
                pass

print(f"Loaded {len(codebase)} files.")

results = {}

for table, columns in schema.items():
    results[table] = {}
    for col in columns:
        col_results = {
            "type_definition": [],
            "schema_definition": [],
            "frontend_usage": [],
            "backend_sql_logic": [],
            "other": []
        }
        
        # We look for word boundary searches
        pattern = re.compile(r'\b' + re.escape(col) + r'\b')
        
        for path, content in codebase:
            # Check matches
            matches = len(pattern.findall(content))
            if matches == 0:
                continue
                
            # Classify the file
            if "supabase_schema.sql" in path:
                # Is it just in the table definition?
                # We can do a simple check. If the column is defined inside "CREATE TABLE public.table" block.
                # Let's count how many times it matches.
                # If there are triggers, functions, or indexes referencing it, they will also be in supabase_schema.sql.
                # Let's find occurrences of table + col or NEW.col/OLD.col, or in other parts.
                # For simplicity, we save supabase_schema.sql occurrences.
                col_results["schema_definition"].append((path, matches))
            elif "supabase.ts" in path:
                col_results["type_definition"].append((path, matches))
            elif path.endswith(('.ts', '.tsx')):
                # Frontend or TypeScript logic
                col_results["frontend_usage"].append((path, matches))
            elif path.endswith('.sql'):
                # Other sql scripts (triggers, updates, RPC migrations)
                col_results["backend_sql_logic"].append((path, matches))
            else:
                col_results["other"].append((path, matches))
                
        results[table][col] = col_results

# Now let's analyze if any columns are unused in actual logic.
# A column might be unused if:
# 1. frontend_usage is empty AND backend_sql_logic is empty.
# But wait, some columns are only used in SQL migrations or RLS policies or triggers.
# Let's print out the full report to console or save to a file.

output_report_path = "scratch/detailed_audit_report.txt"
with open(output_report_path, "w", encoding="utf-8") as f:
    f.write("DETAILED SCHEMA AUDIT REPORT\n")
    f.write("============================\n\n")
    
    for table, columns in results.items():
        f.write(f"TABLE: {table}\n")
        f.write("-" * (7 + len(table)) + "\n")
        for col, data in columns.items():
            f.write(f"  COLUMN: {col}\n")
            
            total_fe = sum(occ for _, occ in data["frontend_usage"])
            total_be = sum(occ for _, occ in data["backend_sql_logic"])
            total_type = sum(occ for _, occ in data["type_definition"])
            total_schema = sum(occ for _, occ in data["schema_definition"])
            
            f.write(f"    Frontend Occurrences: {total_fe}\n")
            f.write(f"    Backend SQL Logic Occurrences: {total_be}\n")
            f.write(f"    Type Definition Occurrences: {total_type}\n")
            f.write(f"    Schema Definition Occurrences: {total_schema}\n")
            
            # Print sample files if any
            if data["frontend_usage"]:
                f.write("    Sample Frontend Files:\n")
                for path, occ in data["frontend_usage"][:3]:
                    f.write(f"      - {path} ({occ} occ)\n")
            if data["backend_sql_logic"]:
                f.write("    Sample Backend SQL Logic Files:\n")
                for path, occ in data["backend_sql_logic"][:3]:
                    f.write(f"      - {path} ({occ} occ)\n")
                    
            status = "ACTIVE"
            if total_fe == 0 and total_be == 0:
                # Let's check if there are other files using it or if it's only in schema/types
                status = "POTENTIALLY UNUSED (Only in schema/types)"
            f.write(f"    STATUS: {status}\n\n")
            
print("Detailed audit report generated in scratch/detailed_audit_report.txt")
