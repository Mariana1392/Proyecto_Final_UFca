// ─────────────────────────────────────────────────────────────────────────────
// usePermissions — Hook centralizado para control de acceso en componentes
//
// Uso:
//   const { can, isAdmin, isAsociado } = usePermissions();
//   if (can(PERM.CREAR_USUARIO)) { ... }
// ─────────────────────────────────────────────────────────────────────────────
import { useAuth } from '../contexts/AuthContext';
import { PERM, Permission } from '../lib/permissions';

export { PERM };                       // re-exportar para imports convenientes

export function usePermissions() {
  const { user, can } = useAuth();

  return {
    /** Verifica si el usuario tiene un permiso específico */
    can,

    /** true si el rol en BD es 'admin' */
    isAdmin: () => user?.rol === 'admin',

    /** true si el rol en BD es 'asociado' */
    isAsociado: () => user?.rol === 'asociado',

    /** Verifica contra el nombre de rol exacto de la BD */
    hasRole: (rolNombreDB: string) => user?.rol === rolNombreDB,

    /** Acceso directo a los permisos del usuario actual */
    permisos: user?.permisos ?? [],

    /** Rol en BD del usuario actual (ej: 'admin', 'asociado') */
    rol: user?.rol ?? null,
  };
}
