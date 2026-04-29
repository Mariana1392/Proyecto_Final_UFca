import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import Layout from './components/Layout';
import Hero from './components/Hero';
import Dashboard from './components/Dashboard';
import DashboardAsociado from './components/DashboardAsociado';
import Login from './components/Login';
import RecuperarPassword from './components/RecuperarPassword';
import Roles from './components/Roles';
import Asociados from './components/Asociados';
import AsociadoDetalle from './components/AsociadoDetalle';
import AhorroPermanente from './components/AhorroPermanente';
import AhorroVoluntario from './components/AhorroVoluntario';
import Liquidacion from './components/Liquidacion';
import ComiteEvaluador from './components/ComiteEvaluador';
import Creditos from './components/Creditos';
import Referidos from './components/Referidos';
import Eventos from './components/Eventos';
import PagosPremios from './components/PagosPremios';
import Compras from './components/Compras';
import Ventas from './components/Ventas';
import Productos from './components/Productos';
import Categorias from './components/Categorias';
import Proveedores from './components/Proveedores';
import Pedidos from './components/Pedidos';
import GestionUsuarios from './components/GestionUsuarios';
import ExcepcionesManager from './components/ExcepcionesManager';
import MiSolicitud from './components/MiSolicitud';
import MiPerfil from './components/MiPerfil';
import PerfilAdmin from './components/PerfilAdmin';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import MisAhorros from './components/MisAhorros';
import { VIEW_PERMISO } from './lib/permissions';
import { Toaster } from 'sonner';

type View = 'home' | 'login' | 'recuperar-password' | 'mi-solicitud' | 'mi-perfil' | 'dashboard' | 'roles' | 'usuarios' | 'asociados' | 'asociado-detalle' | 'ahorro-permanente' | 'ahorro-voluntario' | 'liquidacion' | 'comite-evaluador' | 'creditos' | 'referidos' | 'eventos' | 'pagos-premios' | 'compras' | 'ventas' | 'productos' | 'categorias' | 'proveedores' | 'pedidos' | 'excepciones';

function AppContent() {
  const [currentView, setCurrentView]         = useState<View>('home');
  const [selectedAsociadoId, setSelectedAsociadoId] = useState<string | null>(null);

  // ── Fuente única de verdad para auth y permisos ───────────────────────────
  const {
    isAuthenticated,
    userRole, userData, can,
    logout,
  } = useAuth();

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

  const handleViewAsociadoDetails = (id: string) => {
    setCurrentView('asociado-detalle');
    setSelectedAsociadoId(id);
  };

  const renderContent = () => {
    // Proteger módulos que requieren autenticación
    const rutasProtegidas: View[] = [
      'dashboard', 'mi-solicitud', 'mi-perfil',
      'roles', 'usuarios', 'asociados', 'asociado-detalle', 'ahorro-permanente',
      'ahorro-voluntario', 'liquidacion', 'comite-evaluador', 'creditos', 'referidos',
      'eventos', 'pagos-premios', 'compras', 'ventas', 'productos', 'categorias',
      'proveedores', 'pedidos', 'excepciones',
    ];
    if (!isAuthenticated && rutasProtegidas.includes(currentView as View)) {
      return <Login onLogin={handleLogin} onShowRecovery={() => setCurrentView('recuperar-password')} />;
    }

    // Guard de permisos: autenticado pero sin acceso al módulo
    const permisoRequerido = VIEW_PERMISO[currentView];
    if (isAuthenticated && permisoRequerido && !can(permisoRequerido)) {
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

    switch (currentView) {
      case 'mi-solicitud':
        return <MiSolicitud />;
      case 'mi-perfil':
        return userRole === 'admin'
          ? <PerfilAdmin />
          : <MiPerfil userData={userData} />;
      case 'home':
        return <Hero onNavigateToDashboard={() => handleNavigate('dashboard')} onNavigateToLogin={() => handleNavigate('login')} />;
      case 'login':
        return <Login onLogin={handleLogin} onShowRecovery={() => setCurrentView('recuperar-password')} />;
      case 'recuperar-password':
        return <RecuperarPassword onBack={() => setCurrentView('login')} />;
      case 'dashboard':
        return userRole === 'asociado'
          ? <DashboardAsociado userData={userData} onNavigate={handleNavigate} />
          : <Dashboard userRole={userRole ?? undefined} userData={userData} onNavigate={handleNavigate} />;
      case 'roles':
        return <Roles userRole={userRole ?? undefined} />;
      case 'asociados':
        return <Asociados onViewDetails={handleViewAsociadoDetails} userRole={userRole ?? undefined} userData={userData} />;
      case 'asociado-detalle':
        return <AsociadoDetalle asociadoId={selectedAsociadoId} onBack={() => setCurrentView('asociados')} />;
      case 'ahorro-permanente':
        return userRole === 'asociado'
          ? <MisAhorros userData={userData} />
          : <AhorroPermanente userRole={userRole ?? undefined} userData={userData} />;
      case 'ahorro-voluntario':
        return userRole === 'asociado'
          ? <MisAhorros userData={userData} />
          : <AhorroVoluntario userRole={userRole ?? undefined} userData={userData} />;
      case 'liquidacion':
        return <Liquidacion userRole={userRole ?? undefined} userData={userData} />;
      case 'comite-evaluador':
        return <ComiteEvaluador />;
      case 'creditos':
        return <Creditos userRole={userRole ?? undefined} userData={userData} />;
      case 'referidos':
        return <Referidos userRole={userRole ?? undefined} userData={userData} />;
      case 'eventos':
        return <Eventos userRole={userRole ?? undefined} userData={userData} />;
      case 'pagos-premios':
        return <PagosPremios userRole={userRole ?? undefined} />;
      case 'compras':
        return <Compras />;
      case 'ventas':
        return <Ventas />;
      case 'productos':
        return <Productos />;
      case 'categorias':
        return <Categorias />;
      case 'proveedores':
        return <Proveedores />;
      case 'pedidos':
        return <Pedidos userRole={userRole ?? undefined} />;
      case 'usuarios':
        return <GestionUsuarios userRole={userRole ?? undefined} />;
      case 'excepciones':
        return <ExcepcionesManager userRole={userRole || 'asociado'} userId={userData?.id || ''} />;
      default:
        return <Hero onNavigateToDashboard={() => handleNavigate('dashboard')} onNavigateToLogin={() => handleNavigate('login')} />;
    }
  };

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
  );
}