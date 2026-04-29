// ─────────────────────────────────────────────────────────────────────────────
// AuthContext — rápido y simple
//  · loading = false siempre al arrancar (sin esperar a Supabase)
//  · Login.tsx hace el trabajo de autenticar y llama a iniciarSesion()
//  · sessionStorage persiste la sesión dentro de la pestaña (como antes)
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { getPermisosEfectivos, rolLabel } from '../lib/permissions';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string; nombre: string; email: string; username: string;
  rol: string; rol_id: string | null; asociado_id: string | null;
  activo: boolean; permisos: string[]; cedula?: string; label?: string;
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
  userRole:        'admin' | 'asociado' | 'usuario' | null;
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

  const setU = (u: AuthUser | null) => { setUser(u); cacheSet(u); };

  const cargarPerfil = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('id,nombre,email,username,identificacion,activo,rol_id,asociado_id,roles(nombre,label,permisos),asociados(cedula)')
        .eq('id', userId)
        .single();
      if (!data || !data.activo) return;
      const rolNombre  = (data as any).roles?.nombre ?? 'usuario';
      const rolLabelDB = (data as any).roles?.label  ?? undefined;
      const dbPermisos = Array.isArray((data as any).roles?.permisos) ? (data as any).roles.permisos : [];
      setU({
        id:          data.id,
        nombre:      data.nombre,
        email:       data.email,
        username:    data.username ?? data.email.split('@')[0],
        rol:         rolNombre,
        label:       rolLabelDB,
        rol_id:      data.rol_id ?? null,
        asociado_id: data.asociado_id ?? null,
        activo:      true,
        permisos:    getPermisosEfectivos(rolNombre, dbPermisos),
        cedula:      (data as any).asociados?.cedula,
      });
    } catch {}
  };

  useEffect(() => {
    // Al arrancar, si Supabase tiene sesión activa (ej: tras confirmar email) y no hay caché local, cargar perfil
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !cacheGet()) cargarPerfil(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setU(null);
      } else if (event === 'SIGNED_IN' && session?.user && !cacheGet()) {
        // Confirmación de email: Supabase creó sesión pero la app aún no tiene usuario cargado
        cargarPerfil(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Login.tsx llama esto tras autenticarse exitosamente
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
        .select('id,nombre,email,username,identificacion,activo,rol_id,asociado_id,roles(nombre,label,permisos),asociados(cedula)')
        .eq('id', user.id).single();
      if (error || !data || !data.activo) { setU(null); return; }
      const rolNombre  = (data as any).roles?.nombre ?? user.rol;
      const rolLabelDB = (data as any).roles?.label  ?? undefined;
      const dbPermisos = Array.isArray((data as any).roles?.permisos) ? (data as any).roles.permisos : [];
      // Actualizar TODOS los campos, incluyendo nombre, email y telefono
      setU({
        ...user,
        nombre:      data.nombre,
        email:       data.email,
        username:    data.username ?? data.email.split('@')[0],
        rol:         rolNombre,
        label:       rolLabelDB,
        permisos:    getPermisosEfectivos(rolNombre, dbPermisos),
        activo:      data.activo,
        rol_id:      data.rol_id ?? null,
        asociado_id: data.asociado_id ?? null,
        cedula:      (data as any).asociados?.cedula ?? user.cedula,
      });
    } catch {}
  };

  const can        = (p: string) => user?.permisos.includes(p) ?? false;
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
    permisos: user.permisos, asociado_id: user.asociado_id, cedula: user.cedula,
    isUsuario: user.rol === 'usuario',
  } : null;

  return (
    <AuthContext.Provider value={{
      user, loading: false, isAuthenticated: !!user,
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

export type UserRole = 'admin' | 'asociado' | 'usuario';
