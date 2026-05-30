import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import Layout from './components/Layout';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import DashboardAsociado from './components/DashboardAsociado';
import Login from './components/Login';
import RecuperarPassword from './components/RecuperarPassword';
import CrearPassword from './components/CrearPassword';
import Roles from './components/Roles';
// Asociados.tsx y AsociadoDetalle.tsx eliminados del menú principal.
// La gestión de asociados ahora está integrada en GestionUsuarios.
import AhorroPermanente from './components/ahorro-permanente/AhorroPermanente';
import AhorroVoluntario from './components/ahorro-voluntario/AhorroVoluntario';
import Liquidacion from './components/Liquidacion';
import ComiteEvaluador from './components/ComiteEvaluador';
import Creditos from './components/creditos/Creditos';
import Referidos from './components/Referidos';
import GestionUsuarios from './components/GestionUsuarios';
import Configuracion from './components/Configuracion';
import MiSolicitud from './components/MiSolicitud';
import MiPerfil from './components/MiPerfil';
import PerfilAdmin from './components/PerfilAdmin';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import MisAhorros from './components/MisAhorros';
import CuentaPendienteActivacion from './components/CuentaPendienteActivacion';
import { VIEW_PERMISO } from './lib/permissions';
import { businessRules } from './services/businessRules';
import { Toaster } from 'sonner';

type View = 'home' | 'solicitud' | 'login' | 'recuperar-password' | 'crear-password' | 'mi-solicitud' | 'mi-perfil' | 'dashboard' | 'roles' | 'usuarios' | 'asociados' | 'asociado-detalle' | 'ahorro-permanente' | 'ahorro-voluntario' | 'liquidacion' | 'comite-evaluador' | 'creditos' | 'referidos' | 'parametros';

function AppContent() {
  const [currentView, setCurrentView]         = useState<View>('home');

  // ── Cargar configuración operativa desde BD al iniciar ────────────────────
  useEffect(() => {
    businessRules.loadConfigFromDB();
  }, []);

  // ── Detectar flujo de invitación de Supabase ──────────────────────────────
  // Cuando un asociado hace clic en el enlace de la invitación por email,
  // Supabase redirige a: /?bienvenido=1#access_token=TOKEN&type=invite
  // Detectamos el hash/query y mostramos la pantalla para crear contraseña.
  // IMPORTANTE: leemos el hash ANTES de limpiarlo para que el SDK de Supabase
  // (que también lo lee en su inicialización) lo procese primero. Solo limpiamos
  // la URL visualmente para que no quede el token expuesto tras recargar.
  useEffect(() => {
    const hash   = window.location.hash;
    const search = window.location.search;

    const esInvitacion =
      hash.includes('type=invite') ||
      hash.includes('type=recovery') ||
      (hash.includes('access_token=') && new URLSearchParams(search).get('bienvenido') === '1') ||
      (hash.includes('access_token=') && new URLSearchParams(search).get('recuperar') === '1');

    if (esInvitacion) {
      setCurrentView('crear-password');
      // Dejar que el SDK procese el hash (ocurre de forma síncrona en su init),
      // luego limpiar la URL para no exponer el token al recargar.
      setTimeout(() => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }, 500);
    }
  }, []);

  // ── Fuente única de verdad para auth y permisos ───────────────────────────
  const {
    isAuthenticated,
    loading,
    userRole, userData, can,
    logout,
  } = useAuth();

  // Helper: un usuario tiene acceso si posee AL MENOS UNO de los permisos (OR)
  const canAny = (perm: string | string[]): boolean =>
    Array.isArray(perm) ? perm.some(p => can(p)) : can(perm);

  // Permisos como array para props de Layout (backward compat)
  const userPermisos = userData?.permisos ?? [];


  // Redirigir según rol solo cuando el usuario acaba de iniciar sesión (está en la pantalla de login).
  // NO redirigir desde 'home' para que la pantalla de inicio siempre se muestre al abrir el proyecto.
  useEffect(() => {
    if (isAuthenticated && currentView === 'login') {
      if (userData?.rol_nombre === 'usuario') {
        setCurrentView('mi-solicitud');
      } else {
        setCurrentView('dashboard');
      }
    }
  }, [isAuthenticated, currentView, userData]);

  const handleLogin = (_role: 'admin' | 'asociado' | 'usuario', _data: any) => {
    if (_role === 'usuario' || _data?.rol_nombre === 'usuario') {
      setCurrentView('mi-solicitud');
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentView('login');
  };

  const handleNavigate = (view: string, asociadoId?: string) => {
    setCurrentView(view as View);
    if (asociadoId) {
      setSelectedAsociadoId(asociadoId);
    }
  };

  // handleViewAsociadoDetails eliminado — detalle de asociado integrado en GestionUsuarios

  const renderContent = () => {
    // Proteger módulos que requieren autenticación
    const rutasProtegidas: View[] = [
      'dashboard', 'mi-solicitud', 'mi-perfil',
      'roles', 'usuarios', 'asociados', 'asociado-detalle', 'ahorro-permanente',
      'ahorro-voluntario', 'liquidacion', 'comite-evaluador', 'creditos', 'referidos',
      'parametros',
    ];
    if (!isAuthenticated && rutasProtegidas.includes(currentView as View)) {
      return <Login onLogin={handleLogin} onShowRecovery={() => setCurrentView('recuperar-password')} />;
    }

    // Guard: asociado con cuenta no activada (aún no pagó su primera cuota)
    // Solo puede ver su perfil y mis-ahorros (ahorro permanente). Todo lo demás bloqueado.
    const MODULOS_REQUIEREN_CUENTA_ACTIVA: View[] = [
      'ahorro-voluntario', 'creditos', 'referidos', 'liquidacion',
    ];
    if (
      isAuthenticated &&
      userData?.rol === 'asociado' &&
      userData?.cuentaActivada === false &&
      MODULOS_REQUIEREN_CUENTA_ACTIVA.includes(currentView as View)
    ) {
      return <CuentaPendienteActivacion userData={userData} />;
    }

    // Guard de permisos: autenticado pero sin acceso al módulo (soporta OR con arrays)
    const permisoRequerido = VIEW_PERMISO[currentView];
    if (isAuthenticated && permisoRequerido && !canAny(permisoRequerido)) {
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4 max-w-sm">
            <div className="flex justify-center">
              <div className="p-4 bg-slate-100 rounded-full">
                <Shield className="size-12 text-slate-400" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Sin acceso</h2>
              <p className="text-slate-500 mt-2 text-sm">
                Tu rol no tiene permiso para acceder a este módulo.
                Contacta al administrador si crees que es un error.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Guard: asociado pendiente de pago de activación — solo puede acceder a ahorro permanente
    const MODULOS_BLOQUEADOS_PENDIENTE: View[] = ['ahorro-voluntario', 'liquidacion', 'creditos', 'referidos'];
    if (userData?.pendienteActivacion && MODULOS_BLOQUEADOS_PENDIENTE.includes(currentView as View)) {
      return <DashboardAsociado userData={userData} onNavigate={handleNavigate} />;
    }

    switch (currentView) {
      case 'mi-solicitud':
        return <MiSolicitud />;
      case 'mi-perfil':
        return userRole === 'admin'
          ? <PerfilAdmin />
          : <MiPerfil userData={userData} />;
      case 'home':
        return <Hero onNavigateToDashboard={() => handleNavigate('dashboard')} onNavigateToLogin={() => handleNavigate('login')} />;
      case 'solicitud':
        return <Hero onNavigateToDashboard={() => handleNavigate('dashboard')} onNavigateToLogin={() => handleNavigate('login')} autoOpenForm />;
      case 'login':
        return <Login onLogin={handleLogin} onShowRecovery={() => setCurrentView('recuperar-password')} />;
      case 'recuperar-password':
        return <RecuperarPassword onBack={() => setCurrentView('login')} />;
      case 'crear-password':
        return (
          <CrearPassword
            onSuccess={() => {
              // Supabase ya tiene sesión activa tras el invite; redirigir al dashboard.
              // El useEffect de isAuthenticated se encargará del resto si el rol está listo.
              if (isAuthenticated) {
                if (userData?.rol_nombre === 'usuario') {
                  setCurrentView('mi-solicitud');
                } else {
                  setCurrentView('dashboard');
                }
              } else {
                // Sesión aún no resuelta → ir a login para que el usuario ingrese normalmente
                setCurrentView('login');
              }
            }}
          />
        );
      case 'dashboard':
        return can('asociados') || can('usuarios') || can('roles')
          ? <Dashboard userRole={userRole ?? undefined} userData={userData} onNavigate={handleNavigate} />
          : <DashboardAsociado userData={userData} onNavigate={handleNavigate} />;
      case 'roles':
        return <Roles userRole={userRole ?? undefined} />;
      case 'asociados':
      case 'asociado-detalle':
        // Gestión de asociados unificada en Gestión de Usuarios
        return <GestionUsuarios userRole={userRole ?? undefined} userData={userData} />;
      case 'ahorro-permanente':
        // NOTA DE ARQUITECTURA: este bloque NO es una doble validación de permisos.
        //
        // El sidebar (Layout) ya filtra qué ítems se muestran usando VIEW_PERMISO.
        // Este switch es routing de CONTENIDO: dado que el usuario tiene acceso
        // a la vista 'ahorro-permanente', ¿qué componente debe ver?
        //   • can('ahorros')     → admin: ve todos los ahorros de todos los asociados
        //   • solo mis_ahorros   → asociado: ve solo sus propios ahorros (MisAhorros)
        // Ambas ramas son acceso legítimo; muestran contenido diferente al mismo permiso.
        return can('ahorros')
          ? <AhorroPermanente userRole={userRole ?? undefined} userData={userData} />
          : <MisAhorros userData={userData} />;
      case 'ahorro-voluntario':
        // Mismo patrón que ahorro-permanente — ver comentario anterior
        return can('ahorros')
          ? <AhorroVoluntario userRole={userRole ?? undefined} userData={userData} />
          : <MisAhorros userData={userData} />;
      case 'liquidacion':
        return <Liquidacion userData={userData} />;
      case 'comite-evaluador':
        return <ComiteEvaluador />;
      case 'creditos':
        return <Creditos userData={userData} />;
      case 'referidos':
        return <Referidos userData={userData} />;
      case 'usuarios':
        return <GestionUsuarios userRole={userRole ?? undefined} />;
      case 'parametros':
        return <Configuracion userData={userData} />;
      default:
        return <Hero onNavigateToDashboard={() => handleNavigate('dashboard')} onNavigateToLogin={() => handleNavigate('login')} />;
    }
  };

  // U-02: mostrar spinner mientras Supabase resuelve la sesión inicial
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Cargando…</p>
        </div>
      </div>
    );
  }

  return (
    <Layout
      isAuthenticated={isAuthenticated}
      currentView={currentView}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      userRole={userRole ?? undefined}
      userData={userData}
      userPermisos={userPermisos}
    >
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
          <Toaster
            position="top-right"
            expand={false}
            richColors
            closeButton
          />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}