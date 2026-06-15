// ─────────────────────────────────────────────────────────────────────────────
// permissions.ts — Fuente de verdad centralizada para permisos del sistema UFCA
//
// Regla: NUNCA comparar roles como strings dispersos en componentes.
//        Usa can() del AuthContext o usePermissions().
//
// Los permisos SIEMPRE vienen de la BD (tabla rol_permisos).
// Si la BD no devuelve permisos, el usuario queda sin acceso — nunca se simula.
// ─────────────────────────────────────────────────────────────────────────────

/** Claves de permisos disponibles en el sistema — deben coincidir exactamente con la tabla `permisos` en BD */
export const PERM = {
  // ── Módulos de administración (vista completa) ───────────────────────────────
  DASHBOARD:     'dashboard',
  ROLES:         'roles',
  USUARIOS:      'usuarios',
  ASOCIADOS:     'asociados',
  AHORROS:       'ahorros',
  CREDITOS:      'creditos',
  LIQUIDACION:   'liquidacion',
  CONFIGURACION: 'configuracion',

  // ── Módulos de asociado (vista propia filtrada) ──────────────────────────────
  MIS_AHORROS:    'mis_ahorros',
  MIS_CREDITOS:   'mis_creditos',
  MI_LIQUIDACION: 'mi_liquidacion',
  MIS_REFERIDOS:  'mis_referidos',

  // ── Usuario normal (pendiente de ser asociado) ───────────────────────────────
  SOLICITUD_ASOCIACION: 'solicitud_asociacion',

  // ── Acciones sobre usuarios ──────────────────────────────────────────────────
  CREAR_USUARIO:    'crear_usuario',
  EDITAR_USUARIO:   'editar_usuario',
  ELIMINAR_USUARIO: 'eliminar_usuario',
  VER_AUDITORIA:    'ver_auditoria',

  // ── Acciones sobre asociados ─────────────────────────────────────────────────
  CREAR_ASOCIADO:    'crear_asociado',
  EDITAR_ASOCIADO:   'editar_asociado',
  ELIMINAR_ASOCIADO: 'eliminar_asociado',
} as const;

export type Permission = typeof PERM[keyof typeof PERM];

// ─────────────────────────────────────────────────────────────────────────────
// Vista → permiso requerido para acceder
// Centralizado aquí para no repetirlo en App.tsx ni en cada componente.
// Vistas con array: accesible si el usuario tiene AL MENOS UNO (OR)
// ─────────────────────────────────────────────────────────────────────────────
export const VIEW_PERMISO: Record<string, string | string[]> = {
  'mi-solicitud':      PERM.SOLICITUD_ASOCIACION,
  dashboard:           PERM.DASHBOARD,
  roles:               PERM.ROLES,
  usuarios:            PERM.USUARIOS,
  asociados:           PERM.ASOCIADOS,
  'asociado-detalle':  PERM.ASOCIADOS,
  'ahorro-permanente': [PERM.AHORROS, PERM.MIS_AHORROS],
  'ahorro-voluntario': [PERM.AHORROS, PERM.MIS_AHORROS],
  liquidacion:         [PERM.LIQUIDACION, PERM.MI_LIQUIDACION],
  'comite-evaluador':  PERM.ASOCIADOS,
  creditos:            [PERM.CREDITOS, PERM.MIS_CREDITOS],
  referidos:           [PERM.ASOCIADOS, PERM.MIS_REFERIDOS],
  parametros:          PERM.CONFIGURACION,
  // A-07: mi-perfil requiere estar autenticado (cualquier permiso activo)
  'mi-perfil':         [PERM.DASHBOARD, PERM.MIS_AHORROS, PERM.SOLICITUD_ASOCIACION],
  reportes:            [PERM.DASHBOARD, PERM.MIS_AHORROS],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve los permisos efectivos del usuario.
 *
 * Fuente ÚNICA de verdad: tabla `rol_permisos` en la BD.
 * Si la BD no devuelve permisos, retorna array vacío — el usuario no accede a nada.
 * NUNCA se simulan permisos con datos del código.
 *
 * @param dbPermisos permisos leídos de rol_permisos via AuthContext / Login
 */
export function getPermisosEfectivos(
  _rolNombre: string,
  dbPermisos: string[] = [],
): string[] {
  if (dbPermisos.length === 0) {
    // La BD no devolvió permisos — puede ser un rol sin configurar o error de BD.
    // Se retorna array vacío: el usuario verá "Sin acceso" en todos los módulos.
    // Revisar tabla rol_permisos en Supabase para este rol.
    console.error('[UFCA] No se encontraron permisos en BD para este usuario. Verifica la tabla rol_permisos.');
    return [];
  }

  // Permisos exactamente como los define la BD — sin agregar ni quitar nada.
  return Array.from(new Set(dbPermisos));
}

/** Convierte nombre de rol de BD al label visible en UI (usa roles.label de BD de preferencia) */
export function rolLabel(nombreDB: string): string {
  if (nombreDB === 'admin')    return 'Administrador';
  if (nombreDB === 'asociado') return 'Asociado';
  if (nombreDB === 'usuario')  return 'Usuario Normal';
  return nombreDB.charAt(0).toUpperCase() + nombreDB.slice(1);
}

/** Convierte el label UI de vuelta al nombre de BD */
export function rolNombreDB(label: string): string {
  if (label === 'Administrador') return 'admin';
  if (label === 'Asociado')      return 'asociado';
  if (label === 'Usuario Normal' || label === 'Usuario') return 'usuario';
  return label.toLowerCase();
}
