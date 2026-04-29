// ─────────────────────────────────────────────────────────────────────────────
// permissions.ts — Fuente de verdad centralizada para permisos del sistema UFCA
//
// Regla: NUNCA comparar roles como strings dispersos en componentes.
//        Usa can() del AuthContext o usePermissions().
// ─────────────────────────────────────────────────────────────────────────────

/** Permisos disponibles en el sistema (usa estas constantes, no strings libres) */
export const PERM = {
  // ── Módulos ─────────────────────────────────────────────────────────────────
  DASHBOARD:     'dashboard',
  ROLES:         'roles',
  USUARIOS:      'usuarios',
  ASOCIADOS:     'asociados',
  AHORROS:       'ahorros',
  CREDITOS:      'creditos',
  EVENTOS:       'eventos',
  COMPRAS:       'compras',
  VENTAS:        'ventas',
  LIQUIDACION:   'liquidacion',
  CONFIGURACION: 'configuracion',

  // ── Usuario normal (pendiente de ser asociado) ───────────────────────────────
  SOLICITUD_ASOCIACION: 'solicitud_asociacion',

  // ── Pedidos (acceso para asociados a sus propios pedidos) ────────────────────
  PEDIDOS: 'pedidos',

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
// Permisos BASE por nombre de rol (exactamente como están en la BD).
// Si el rol no está en este mapa, se usan los permisos de 'asociado'.
// Los permisos extra guardados en roles.permisos de la BD se SUMAN a estos.
// ─────────────────────────────────────────────────────────────────────────────
export const ROL_PERMISOS: Record<string, Permission[]> = {
  admin: [
    PERM.DASHBOARD, PERM.ROLES, PERM.USUARIOS, PERM.ASOCIADOS,
    PERM.AHORROS, PERM.CREDITOS, PERM.EVENTOS, PERM.COMPRAS,
    PERM.VENTAS, PERM.LIQUIDACION, PERM.CONFIGURACION, PERM.PEDIDOS,
    PERM.CREAR_USUARIO, PERM.EDITAR_USUARIO, PERM.ELIMINAR_USUARIO,
    PERM.VER_AUDITORIA,
    PERM.CREAR_ASOCIADO, PERM.EDITAR_ASOCIADO, PERM.ELIMINAR_ASOCIADO,
  ],
  asociado: [
    PERM.DASHBOARD, PERM.AHORROS, PERM.CREDITOS,
    PERM.EVENTOS, PERM.LIQUIDACION, PERM.PEDIDOS,
  ],
  // Usuario registrado que aún no es asociado: solo puede ver su portal de solicitud
  usuario: [
    PERM.SOLICITUD_ASOCIACION,
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Vista → permiso requerido para acceder
// Centralizado aquí para no repetirlo en App.tsx ni en cada componente.
// ─────────────────────────────────────────────────────────────────────────────
export const VIEW_PERMISO: Record<string, string> = {
  'mi-solicitud':     PERM.SOLICITUD_ASOCIACION,
  dashboard:          PERM.DASHBOARD,
  roles:              PERM.ROLES,
  usuarios:           PERM.USUARIOS,
  asociados:          PERM.ASOCIADOS,
  'asociado-detalle': PERM.ASOCIADOS,
  'ahorro-permanente':PERM.AHORROS,
  'ahorro-voluntario':PERM.AHORROS,
  liquidacion:        PERM.LIQUIDACION,
  'comite-evaluador': PERM.ASOCIADOS,
  creditos:           PERM.CREDITOS,
  referidos:          PERM.ASOCIADOS,
  compras:            PERM.COMPRAS,
  ventas:             PERM.VENTAS,
  productos:          PERM.COMPRAS,
  categorias:         PERM.COMPRAS,
  proveedores:        PERM.COMPRAS,
  eventos:            PERM.EVENTOS,
  'pagos-premios':    PERM.EVENTOS,
  pedidos:            PERM.PEDIDOS,
  excepciones:        PERM.CONFIGURACION,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combina los permisos base del rol con los permisos extra guardados en BD.
 * @param rolNombre  nombre del rol tal como está en la tabla `roles` (ej: 'admin')
 * @param dbPermisos permisos adicionales guardados en roles.permisos (puede ser [])
 */
export function getPermisosEfectivos(
  rolNombre: string,
  dbPermisos: string[] = [],
): string[] {
  const base = ROL_PERMISOS[rolNombre] ?? ROL_PERMISOS.asociado;
  // Merge sin duplicados
  return Array.from(new Set([...base, ...dbPermisos]));
}

/** Convierte nombre de rol de BD al label visible en UI */
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
