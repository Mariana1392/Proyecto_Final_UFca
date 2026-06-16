// ─────────────────────────────────────────────────────────────────────────────
// AuthContext — sin tabla asociados
//  · Los usuarios con rol='asociado' son los asociados — no hay tabla separada
//  · cedula, telefono, direccion vienen directo de usuarios
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { getPermisosEfectivos, rolLabel } from '../lib/permissions';

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Roles posibles en la BD — fuente única de verdad para todos los componentes */
export type UserRole = 'admin' | 'asociado' | 'usuario';

export interface AuthUser {
  id: string; nombre: string; email: string; username: string;
  rol: string; rol_id: string | null;
  activo: boolean; permisos: string[];
  cedula?: string; telefono?: string; label?: string;
  solicitud_estado?: string | null;
  cuenta_activada?: boolean;
}

interface AuthContextType {
  user:            AuthUser | null;
  loading:         boolean;
  isAuthenticated: boolean;
  can:             (p: string) => boolean;
  isAdmin:         () => boolean;
  isAsociado:      () => boolean;
  isUsuario:       () => boolean;
  iniciarSesion:   (u: AuthUser) => void;
  logout:          () => Promise<void>;
  recargarPerfil:  () => Promise<void>;
  userRole:        UserRole | null;
  userData:        any;
}

// ── sessionStorage cache ──────────────────────────────────────────────────────

const KEY = 'ufca_u';
const cacheGet = (): AuthUser | null => {
  try { const r = sessionStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; }
};
const cacheSet = (u: AuthUser | null) => {
  try { u ? sessionStorage.setItem(KEY, JSON.stringify(u)) : sessionStorage.removeItem(KEY); } catch {}
};

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(cacheGet);
  const [loading, setLoading] = useState(() => !cacheGet());

  const setU = (u: AuthUser | null) => { setUser(u); cacheSet(u); };

  const cargarPerfil = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('id,nombre,email,username,cedula,telefono,activo,rol_id,roles(nombre,label,rol_permisos(permiso_clave,activo))')
        .eq('id', userId)
        .single();
      if (!data || !data.activo) { setU(null); return; }
      // Registrar último acceso (fire-and-forget)
      void supabase.from('usuarios').update({ ultimo_acceso: new Date().toISOString() }).eq('id', userId);
      const rolNombre  = (data as any).roles?.nombre ?? 'asociado';
      const rolLabelDB = (data as any).roles?.label  ?? undefined;
      const dbPermisos: string[] = Array.isArray((data as any).roles?.rol_permisos)
        ? (data as any).roles.rol_permisos
            .filter((rp: any) => rp.activo !== false)
            .map((rp: any) => rp.permiso_clave).filter(Boolean)
        : [];
      let solicitudEstado: string | null = null;
      let cuentaActivada = true; // por defecto true (no asociado = sin restricción)

      if (rolNombre === 'asociado') {
        // Cargar solicitud y estado de cuenta en paralelo
        const [{ data: sol }, { data: cuenta }] = await Promise.all([
          supabase
            .from('solicitudes_asociados')
            .select('id, estado')
            .eq('usuario_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('cuentas_ahorro')
            .select('id, estado, monto_ahorrado')
            .eq('asociado_id', userId)
            .eq('tipo', 'permanente')
            .eq('anulado', false)
            .limit(1)
            .maybeSingle(),
        ]);

        solicitudEstado = sol?.estado ?? null;
        // Cuenta activa = tiene ahorro permanente con estado 'activo' Y ya realizó su primer aporte (monto_ahorrado > 0)
        cuentaActivada = cuenta?.estado === 'activo' && Number(cuenta?.monto_ahorrado || 0) > 0;

      }

      setU({
        id:               data.id,
        nombre:           data.nombre,
        email:            data.email,
        username:         data.username ?? data.email.split('@')[0],
        rol:              rolNombre,
        label:            rolLabelDB,
        rol_id:           data.rol_id ?? null,
        activo:           true,
        permisos:         getPermisosEfectivos(rolNombre, dbPermisos),
        cedula:           (data as any).cedula   ?? undefined,
        telefono:         (data as any).telefono ?? undefined,
        solicitud_estado: solicitudEstado,
        cuenta_activada:  cuentaActivada,
      });
    } catch (err) {
      console.error('[AuthContext] Error al cargar perfil:', err);
      setU(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        if (cacheGet()) setLoading(false);
        cargarPerfil(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Suscripción en tiempo real a cambios de roles y rol_permisos
    // Para recargar dinámicamente los permisos del usuario activo si se le quitan o agregan permisos.
    const canalPermisos = supabase
      .channel('realtime_permisos_usuario')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rol_permisos' }, () => {
        const sesion = cacheGet();
        if (sesion?.id) cargarPerfil(sesion.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => {
        const sesion = cacheGet();
        if (sesion?.id) cargarPerfil(sesion.id);
      })
      .subscribe();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setU(null);
      } else if (event === 'SIGNED_IN' && session?.user) {
        cargarPerfil(session.user.id);
      } else if (event === 'EMAIL_CHANGED' && session?.user) {
        // Sincronizar el nuevo correo en la tabla public.usuarios
        // (auth.users se actualiza solo, pero usuarios no)
        supabase
          .from('usuarios')
          .update({ email: session.user.email })
          .eq('id', session.user.id)
          .then(({ error }) => {
            if (error) console.error('[UFCA] Error sincronizando email en usuarios:', error);
          });

        import('sonner').then(({ toast }) => {
          toast.success('✅ Correo actualizado correctamente', {
            description: `Tu nuevo correo es: ${session.user.email}`,
            duration: 8000,
          });
        });

        // Recargar perfil para que el UI refleje el nuevo correo
        cargarPerfil(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(canalPermisos);
    };
  }, []);

  const iniciarSesion = (u: AuthUser) => setU(u);

  const logout = async () => {
    setU(null);
    await supabase.auth.signOut();
  };

  const recargarPerfil = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id,nombre,email,username,cedula,telefono,activo,rol_id,roles(nombre,label,rol_permisos(permiso_clave,activo))')
        .eq('id', user.id).single();
      if (error || !data || !data.activo) { setU(null); return; }
      const rolNombre  = (data as any).roles?.nombre ?? user.rol;
      const rolLabelDB = (data as any).roles?.label  ?? undefined;
      const dbPermisos: string[] = Array.isArray((data as any).roles?.rol_permisos)
        ? (data as any).roles.rol_permisos
            .filter((rp: any) => rp.activo !== false)
            .map((rp: any) => rp.permiso_clave).filter(Boolean)
        : [];
      let solicitudEstadoR: string | null = user.solicitud_estado ?? null;
      if (rolNombre === 'asociado') {
        const { data: sol } = await supabase
          .from('solicitudes_asociados')
          .select('estado')
          .eq('usuario_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        solicitudEstadoR = sol?.estado ?? null;
      }

      setU({
        ...user,
        nombre:           data.nombre,
        email:            data.email,
        username:         data.username ?? data.email.split('@')[0],
        rol:              rolNombre,
        label:            rolLabelDB,
        permisos:         getPermisosEfectivos(rolNombre, dbPermisos),
        activo:           data.activo,
        rol_id:           data.rol_id ?? null,
        cedula:           (data as any).cedula   ?? user.cedula,
        telefono:         (data as any).telefono ?? user.telefono,
        solicitud_estado: solicitudEstadoR,
      });
    } catch (err) {
      console.error('[AuthContext] Error al recargar perfil:', err);
      setU(null);
    }
  };

  const can        = (p: string) => (user?.permisos ?? []).includes(p);
  const isAdmin    = () => user?.rol === 'admin';
  const isAsociado = () => user?.rol === 'asociado';
  const isUsuario  = () => user?.rol === 'usuario';

  const userRole: 'admin' | 'asociado' | 'usuario' | null =
    user?.rol === 'admin' ? 'admin'
    : user?.rol === 'asociado' ? 'asociado'
    : user?.rol === 'usuario' ? 'usuario'
    : null;

  const userData = user ? {
    id: user.id, name: user.nombre, nombre: user.nombre, email: user.email,
    username: user.username, role: userRole, rol: userRole,
    rol_nombre: user.rol, rolLabel: user.label ?? rolLabel(user.rol),
    permisos: user.permisos,
    cedula:   user.cedula,
    telefono: user.telefono,
    isUsuario: user.rol === 'usuario',
    solicitud_estado:    user.solicitud_estado ?? null,
    pendienteActivacion: user.rol === 'asociado' && user.solicitud_estado === 'pendiente_activacion',
    // true cuando el asociado ya pagó su primera cuota y tiene acceso completo
    cuentaActivada: user.rol !== 'asociado' || (user.cuenta_activada ?? true),
  } : null;

  return (
    <AuthContext.Provider value={{
      user, loading, isAuthenticated: !!user,
      can, isAdmin, isAsociado, isUsuario, iniciarSesion, logout, recargarPerfil,
      userRole, userData,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
