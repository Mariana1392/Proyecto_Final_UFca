import { useState, useEffect, lazy, Suspense } from 'react';
import { Shield } from 'lucide-react';
import Layout from './components/Layout';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { VIEW_PERMISO } from './lib/permissions';
import { businessRules } from './services/businessRules';
import { supabase } from './lib/supabase';
import { Toaster } from 'sonner';

// Módulos cargados bajo demanda — no se descargan hasta que el usuario navega a ellos
const Hero                  = lazy(() => import('./components/Hero'));
const Dashboard             = lazy(() => import('./components/Dashboard'));
const DashboardAsociado     = lazy(() => import('./components/DashboardAsociado'));
const RecuperarPassword     = lazy(() => import('./components/RecuperarPassword'));
const CrearPassword         = lazy(() => import('./components/CrearPassword'));
const Roles                 = lazy(() => import('./components/Roles'));
const AhorroPermanente      = lazy(() => import('./components/ahorro-permanente/AhorroPermanente'));
const AhorroVoluntario      = lazy(() => import('./components/ahorro-voluntario/AhorroVoluntario'));
const Liquidacion           = lazy(() => import('./components/liquidaciones'));
const ComiteEvaluador       = lazy(() => import('./components/ComiteEvaluador'));
const Creditos              = lazy(() => import('./components/creditos/Creditos'));
const Referidos             = lazy(() => import('./components/Referidos'));
const GestionUsuarios       = lazy(() => import('./components/GestionUsuarios'));

const MiSolicitud           = lazy(() => import('./components/MiSolicitud'));
const MiPerfil              = lazy(() => import('./components/MiPerfil'));
const PerfilAdmin           = lazy(() => import('./components/PerfilAdmin'));
const MisAhorros            = lazy(() => import('./components/MisAhorros'));
const CuentaPendienteActivacion = lazy(() => import('./components/CuentaPendienteActivacion'));
const Servicios                 = lazy(() => import('./components/Servicios'));


type View = 'home' | 'solicitud' | 'login' | 'recuperar-password' | 'crear-password' | 'mi-solicitud' | 'mi-perfil' | 'dashboard' | 'roles' | 'usuarios' | 'asociados' | 'asociado-detalle' | 'ahorro-permanente' | 'ahorro-voluntario' | 'liquidacion' | 'comite-evaluador' | 'creditos' | 'referidos' | 'servicios';

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
      setTimeout(() => {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }, 500);
      return;
    }

    // Si el usuario salió sin crear contraseña y vuelve al mismo navegador
    // con la sesión aún activa, retomar el flujo automáticamente.
    if (sessionStorage.getItem('ufca_creando_password') === '1') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setCurrentView('crear-password');
        } else {
          sessionStorage.removeItem('ufca_creando_password');
        }
      });
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
    // Soporta "servicios#creditos" — guarda la vista con el hash para scroll
    setCurrentView(view as View);
  };

  // handleViewAsociadoDetails eliminado — detalle de asociado integrado en GestionUsuarios

  const renderContent = () => {
    // Extraer la vista base sin hash (ej: "servicios#creditos" → "servicios")
    const vistaBase = (currentView as string).split('#')[0] as View;
    const vistaHash = (currentView as string).split('#')[1];

    // Proteger módulos que requieren autenticación
    const rutasProtegidas: View[] = [
      'dashboard', 'mi-solicitud', 'mi-perfil',
      'roles', 'usuarios', 'asociados', 'asociado-detalle', 'ahorro-permanente',
      'ahorro-voluntario', 'liquidacion', 'comite-evaluador', 'creditos', 'referidos',
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

    switch (vistaBase) {
      case 'mi-solicitud':
        return <MiSolicitud />;
      case 'mi-perfil':
        return userRole === 'admin'
          ? <PerfilAdmin />
          : <MiPerfil userData={userData} />;
      case 'home':
        return <Hero onNavigateToDashboard={() => handleNavigate('dashboard')} onNavigateToLogin={() => handleNavigate('login')} />;
      case 'servicios':
        return <Servicios onNavigateToLogin={() => handleNavigate('login')} seccionInicial={vistaHash as any} />;
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
        return <GestionUsuarios userRole={userRole ?? undefined} />;
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
      default:
        return <Hero onNavigateToDashboard={() => handleNavigate('dashboard')} onNavigateToLogin={() => handleNavigate('login')} />;
    }
  };

  // Spinner reutilizable para Suspense y carga de sesión
  const Spinner = (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Cargando…</p>
      </div>
    </div>
  );

  // U-02: mostrar spinner mientras Supabase resuelve la sesión inicial
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        {Spinner}
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
      <Suspense fallback={Spinner}>
        {renderContent()}
      </Suspense>
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