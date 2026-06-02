import { useState, useEffect } from "react";
import {
  Menu, X, Home, LogIn, LogOut, Settings, Users, UserCircle,
  BarChart3, ChevronDown, ChevronRight,
  FileText, Mail, Phone, MapPin,
  Facebook, Twitter, Instagram, Linkedin, User, UserPlus,
  Sun, Moon,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import logo from '../assets/logo.svg';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import AlertasWidget from "./AlertasWidget";
import { supabase } from "../lib/supabase";
import type { UserRole } from "../contexts/AuthContext";

interface LayoutProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
  currentView: string;
  onNavigate: (view: any) => void;
  onLogout: () => void;
  userRole?: UserRole | null;
  userData?: any;
  userPermisos?: string[];
}

// Permiso requerido para cada ítem hijo del menú.
// Puede ser un string (permiso único) o string[] (OR: basta con tener uno).
const CHILD_PERMISO: Record<string, string | string[]> = {
  'gestion-roles':    'roles',
  'gestion-usuarios': 'usuarios',
  // Asociado ve UN SOLO ítem "Mis Ahorros" (ahorro-permanente → MisAhorros muestra ambos tipos).
  // ahorro-voluntario solo se muestra al admin (permiso 'ahorros').
  'ahorro-permanente':['ahorros', 'mis_ahorros'],
  'ahorro-voluntario': 'ahorros',
  'liquidacion':      ['liquidacion', 'mi_liquidacion'],
  'comite-evaluador': 'asociados',
  'creditos':         ['creditos', 'mis_creditos'],
  'referidos':        ['asociados', 'mis_referidos'],
  'mediciones':       'dashboard',
  'parametros':       'configuracion',
};

// Mapeo de vista actual → id del hijo del menú (para resaltar el activo)
const VIEW_TO_CHILD_ID: Record<string, string> = {
  'roles':             'gestion-roles',
  'usuarios':          'gestion-usuarios',
  'asociados':         'gestion-usuarios',
  'asociado-detalle':  'gestion-usuarios',
  'ahorro-permanente': 'ahorro-permanente',
  'ahorro-voluntario': 'ahorro-voluntario',
  'liquidacion':       'liquidacion',
  'comite-evaluador':  'comite-evaluador',
  'creditos':          'creditos',
  'referidos':         'referidos',
  'dashboard':         'mediciones',
  'parametros':        'parametros',
};

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  children?: { id: string; label: string }[];
}

export default function Layout({
  children, isAuthenticated, currentView, onNavigate, onLogout, userRole, userData, userPermisos = [],
}: LayoutProps) {
  const [isMobile, setIsMobile]               = useState(window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen]         = useState(window.innerWidth >= 1024);
  const [expandedMenus, setExpandedMenus]     = useState<string[]>([]);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);
  const { toggleTheme, isDark } = useTheme();

  // Detectar cambio de tamaño de pantalla
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(true);   // desktop → abrir siempre
      } else {
        setSidebarOpen(false);  // móvil  → cerrar siempre al redimensionar
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-expandir el menú padre que contiene la vista activa
  useEffect(() => {
    if (!isAuthenticated) return;
    const activeChildId = VIEW_TO_CHILD_ID[currentView];
    if (!activeChildId) return;

    // Buscar qué grupo padre contiene ese child
    const parentGroups: Record<string, string[]> = {
      configuracion: ['gestion-roles', 'parametros'],
      usuarios:      ['gestion-usuarios'],
      asociados:     ['gestion-asociados', 'ahorro-permanente', 'ahorro-voluntario', 'liquidacion', 'comite-evaluador', 'creditos', 'referidos'],
    };
    const parentId = Object.entries(parentGroups).find(([, children]) => children.includes(activeChildId))?.[0];
    if (parentId) {
      setExpandedMenus(prev => prev.includes(parentId) ? prev : [...prev, parentId]);
    }
  }, [currentView, isAuthenticated]);

  useEffect(() => {
    // R-04: solo se ejecuta al autenticar/desautenticar, NO en cada cambio de vista
    if (!isAuthenticated || userRole !== "admin") {
      setSolicitudesPendientes(0);
      return;
    }
    cargarSolicitudesPendientes();

    // Suscripción Realtime para actualizar el badge sin polling
    const canal = supabase
      .channel('solicitudes_pendientes_badge')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'solicitudes_asociados',
        filter: 'estado=eq.pendiente',
      }, () => cargarSolicitudesPendientes())
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [isAuthenticated, userRole]); // sin currentView → no repite en cada navegación

  async function cargarSolicitudesPendientes() {
    try {
      const { count } = await supabase
        .from("solicitudes_asociados")
        .select("*", { count: "exact", head: true })
        .eq("estado", "pendiente");
      setSolicitudesPendientes(count ?? 0);
    } catch { /* non-critical */ }
  }

  const menuItems: MenuItem[] = [
    {
      id: "configuracion",
      label: "Configuración",
      icon: <Settings className="size-5" />,
      children: [
        { id: "gestion-roles", label: "Gestión de roles" },
        { id: "parametros",    label: "Parámetros del sistema" },
      ],
    },
    {
      id: "usuarios",
      label: "Usuarios",
      icon: <UserCircle className="size-5" />,
      children: [
        {
          id: "gestion-usuarios",
          label: "Gestión de usuarios",
        },
      ],
    },
    {
      id: "asociados",
      label: "Asociados",
      icon: <Users className="size-5" />,
      // Los ítems visibles se filtran por tienePermiso() según los permisos reales de la BD
      children: [
        // Asociado → "Mis Ahorros" (un solo ítem, MisAhorros muestra permanente + voluntario)
        // Admin    → "Ahorro permanente" + "Ahorro voluntario" (dos ítems separados)
        { id: "ahorro-permanente",  label: userPermisos.includes('mis_ahorros') && !userPermisos.includes('ahorros') ? "Mis Ahorros" : "Ahorro permanente" },
        { id: "ahorro-voluntario",  label: "Ahorro voluntario" },
        { id: "liquidacion",        label: userPermisos.includes('mi_liquidacion') && !userPermisos.includes('liquidacion') ? "Mi Liquidación" : "Liquidación" },
        { id: "comite-evaluador",   label: "Comité evaluador" },
        { id: "creditos",           label: userPermisos.includes('mis_creditos') && !userPermisos.includes('creditos') ? "Mis Créditos" : "Créditos" },
        { id: "referidos",          label: userPermisos.includes('mis_referidos') && !userPermisos.includes('asociados') ? "Mis Referidos" : "Referidos" },
      ],
    },
  ];

  // Filtrar menús según los permisos reales del usuario (lee de la BD vía userPermisos).
  // Soporta lógica OR: si el permiso es un array, basta con tener al menos uno.
  const tienePermiso = (childId: string): boolean => {
    const permiso = CHILD_PERMISO[childId];
    if (!permiso) return true; // sin restricción definida → visible
    if (Array.isArray(permiso)) return permiso.some(p => userPermisos.includes(p));
    return userPermisos.includes(permiso);
  };

  // Módulos bloqueados hasta que el asociado pague su primera cuota de ahorro permanente
  const ITEMS_REQUIEREN_CUENTA_ACTIVA = new Set(['liquidacion', 'creditos', 'referidos', 'ahorro-voluntario']);
  const cuentaActivadaOK = userData?.rol !== 'asociado' || (userData?.cuentaActivada ?? true);

  const filteredMenuItems = menuItems
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => {
        if (!cuentaActivadaOK && ITEMS_REQUIEREN_CUENTA_ACTIVA.has(child.id)) return false;
        return tienePermiso(child.id);
      }),
    }))
    .filter((item) =>
      // Mostrar el grupo solo si tiene al menos un hijo visible
      !item.children || item.children.length > 0
    );

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [menuId],   // acordeón: cierra todos los demás al abrir uno nuevo
    );
  };

  // Q-03: mapa id → vista en lugar de 20+ else-if en cascada
  const MENU_VISTA: Record<string, string> = {
    'solicitudes-asociados': 'solicitudes-asociados',
    'gestion-roles':         'roles',
    'roles':                 'roles',
    'gestion-usuarios':      'usuarios',
    'gestion-acceso':        'acceso',
    'gestion-asociados':     'usuarios',
    'ahorro-permanente':     'ahorro-permanente',
    'ahorro-voluntario':     'ahorro-voluntario',
    'liquidacion':           'liquidacion',
    'comite-evaluador':      'comite-evaluador',
    'creditos':              'creditos',
    'referidos':             'referidos',
    'eventos':               'eventos',
    'pagos-premios':         'pagos-premios',
    'compras-list':          'compras',
    'productos':             'productos',
    'categorias':            'categorias',
    'proveedores':           'proveedores',
    'ventas-list':           'ventas',
    'pedidos':               'pedidos',
    'dashboard':             'dashboard',
    'mediciones':            'dashboard',
    'parametros':            'parametros',
  };

  const handleMenuClick = (id: string) => {
    if (isMobile) setSidebarOpen(false);
    const vista = MENU_VISTA[id];
    if (vista) onNavigate(vista);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-50">
        <div className="flex items-center justify-between px-3 sm:px-6 h-16">

          {/* Izquierda: hamburger + logo */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {isAuthenticated && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                aria-label="Menú"
              >
                {sidebarOpen && !isMobile ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            )}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <img src={logo} alt="UFCA" className="h-9 w-9 sm:h-11 sm:w-11 object-contain drop-shadow-md shrink-0" />
              <div className="hidden sm:flex flex-col leading-tight min-w-0">
                <span className="text-lg font-bold text-slate-900 dark:text-white tracking-wide">UFCA</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium tracking-widest uppercase hidden md:block">Unión Familiar de Crédito y Ahorro</span>
              </div>
            </div>
          </div>

          {/* Derecha: acciones */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Botón tema */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={isDark ? 'Tema claro' : 'Tema oscuro'}
            >
              {isDark
                ? <Sun className="size-5 text-[#f0c040]" />
                : <Moon className="size-5 text-slate-600" />}
            </button>

            {/* Widget de Alertas */}
            {isAuthenticated && userData && (
              <AlertasWidget
                userId={userData.id || "admin"}
                userRole={userRole || "asociado"}
                asociadoId={userData.id ?? null}
                onNavigateToExcepciones={undefined}
                onNavigate={onNavigate}
              />
            )}

            {/* Badge de Usuario y Rol — solo texto en pantallas medianas+ */}
            {isAuthenticated && userData && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border border-emerald-200 dark:border-emerald-700 rounded-lg shadow-sm">
                <UserCircle className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">
                    {userData.name}
                  </span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 hidden md:block">
                    {userData?.rol_nombre === 'admin'    ? 'Administrador'
                     : userData?.rol_nombre === 'asociado' ? 'Asociado'
                     : userData?.rol_nombre === 'usuario'  ? 'Usuario Normal'
                     : userData?.rol_nombre              ?? 'Usuario Normal'}
                  </span>
                </div>
              </div>
            )}
            {/* Ícono de usuario solo en xs */}
            {isAuthenticated && userData && (
              <div className="flex sm:hidden p-1.5">
                <UserCircle className="size-6 text-emerald-600" />
              </div>
            )}

            {/* Inicio */}
            <Button
              variant="ghost"
              onClick={() => onNavigate("home")}
              className="gap-2 px-2 sm:px-3 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
              aria-label="Inicio"
            >
              <Home className="size-4" />
              <span className="hidden sm:inline">Inicio</span>
            </Button>

            {/* Login / Logout */}
            {!isAuthenticated ? (
              <Button
                onClick={() => onNavigate("login")}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 px-2 sm:px-4"
              >
                <LogIn className="size-4" />
                <span className="hidden sm:inline">Login</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={onLogout}
                className="gap-2 px-2 sm:px-4 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Cerrar sesión"
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Backdrop para móvil — cierra el sidebar al tocar fuera */}
      {isAuthenticated && sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex pt-16">
        {/* Sidebar */}
        {isAuthenticated && (
          <aside
            className={`fixed left-0 top-16 bottom-0 z-40 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-transform duration-300 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-64 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <nav className="p-4 space-y-1">
                {/* Logo del sidebar */}
                <div className="flex flex-col items-center gap-2 py-4 mb-3 border-b border-slate-100 dark:border-slate-700">
                  <img src={logo} alt="UFCA" className="h-20 w-20 object-contain drop-shadow-lg" />
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-900 dark:text-white tracking-wider">UFCA</p>
                    <p className="text-[10px] text-emerald-600 font-medium tracking-widest uppercase">Unión Familiar de Crédito y Ahorro</p>
                  </div>
                </div>

                {/* Sidebar simplificado para rol usuario (solo portal + perfil) */}
                {userRole === 'usuario' ? (
                  <>
                    <button
                      onClick={() => { if (isMobile) setSidebarOpen(false); onNavigate('mi-solicitud'); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                        currentView === 'mi-solicitud'
                          ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                          : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <FileText className="size-5 shrink-0" />
                      <span>Mi Portal</span>
                    </button>
                    <button
                      onClick={() => { if (isMobile) setSidebarOpen(false); onNavigate('mi-perfil'); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                        currentView === 'mi-perfil'
                          ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                          : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <User className="size-5 shrink-0" />
                      <span>Mi Perfil</span>
                    </button>
                  </>
                ) : (
                  <>
                {/* Acceso directo al Dashboard */}
                {isAuthenticated && (
                  <button
                    onClick={() => { if (isMobile) setSidebarOpen(false); onNavigate('dashboard'); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                      currentView === 'dashboard'
                        ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                        : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className="size-5 shrink-0" />
                    <span>Dashboard</span>
                  </button>
                )}

                {/* Mi Perfil — visible para admin y asociado */}
                {isAuthenticated && (userRole === 'admin' || userRole === 'asociado') && (
                  <button
                    onClick={() => { if (isMobile) setSidebarOpen(false); onNavigate('mi-perfil'); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm mb-1 ${
                      currentView === 'mi-perfil'
                        ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                        : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <User className="size-5 shrink-0" />
                    <span>Mi Perfil</span>
                  </button>
                )}

                <div className="border-t border-slate-100 mb-2 mt-1" />
                {filteredMenuItems.map((item) => {
                  // ¿Alguno de los hijos de este grupo está activo?
                  const activeChildId = VIEW_TO_CHILD_ID[currentView];
                  const groupIsActive = item.children?.some(c => c.id === activeChildId) ?? false;

                  return (
                    <div key={item.id}>
                      <button
                        onClick={() => {
                          if (item.children) {
                            toggleMenu(item.id);
                          } else {
                            handleMenuClick(item.id);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-sm ${
                          groupIsActive
                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                            : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={groupIsActive ? 'text-emerald-600' : ''}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </div>
                        {item.children &&
                          (expandedMenus.includes(item.id) ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          ))}
                      </button>

                      {item.children && expandedMenus.includes(item.id) && (
                        <div className="ml-4 mt-1 space-y-0.5">
                          {item.children.map((child) => {
                            const isActive = activeChildId === child.id;
                            return (
                              <button
                                key={child.id}
                                onClick={() => handleMenuClick(child.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-sm ${
                                  isActive
                                    ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                                    : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
                                  )}
                                  <span>{child.label}</span>
                                </div>
                                {child.id === "comite-evaluador" && solicitudesPendientes > 0 && (
                                  <Badge className={`text-xs font-bold ${isActive ? 'bg-white text-emerald-700' : 'bg-red-500 text-white hover:bg-red-500'}`}>
                                    {solicitudesPendientes}
                                  </Badge>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                  </>
                )}
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main
          className={`flex-1 transition-all duration-300 min-h-[calc(100vh-4rem)] flex flex-col min-w-0 ${
            isAuthenticated && sidebarOpen && !isMobile ? 'ml-64' : 'ml-0'
          }`}
        >
          <div className="flex-1">{children}</div>

          {/* Footer */}
          {currentView === 'home' && (
            <footer className="relative overflow-hidden bg-[#021a12] text-white mt-auto">
              {/* Franja dorada superior */}
              <div className="h-1 w-full bg-gradient-to-r from-[#054030] via-[#f0c040] to-[#054030]" />
              {/* Orbe decorativo */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full bg-emerald-900/20 blur-3xl pointer-events-none" />

              <div className="relative max-w-7xl mx-auto px-8 pt-14 pb-10">
                <div className="grid md:grid-cols-12 gap-10 mb-12">

                  {/* Columna 1: Logo (ancha) */}
                  <div className="md:col-span-4 space-y-5">
                    <div className="flex items-center gap-4">
                      <img src={logo} alt="UFCA" className="h-16 w-16 object-contain drop-shadow-xl" />
                      <div>
                        <p className="text-2xl font-black tracking-widest text-white leading-none">UFCA</p>
                        <p className="text-[10px] text-[#f0c040] font-bold tracking-[0.25em] uppercase mt-1">Unión Familiar de Crédito y Ahorro</p>
                      </div>
                    </div>
                    {/* Redes */}
                    <div className="flex gap-2 pt-1">
                      {[
                        { icon: <Facebook className="size-4" />, label: 'Facebook' },
                        { icon: <Twitter className="size-4" />, label: 'Twitter' },
                        { icon: <Instagram className="size-4" />, label: 'Instagram' },
                        { icon: <Linkedin className="size-4" />, label: 'LinkedIn' },
                      ].map((s) => (
                        <a key={s.label} href="#"
                          className="p-2.5 rounded-xl bg-white/5 border border-white/8 hover:bg-[#0f8c62] hover:border-[#0f8c62] transition-all duration-200"
                          aria-label={s.label}>
                          {s.icon}
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Columna 2: Servicios */}
                  <div className="md:col-span-2">
                    <p className="text-[#f0c040] font-bold text-xs tracking-widest uppercase mb-5">Servicios</p>
                    <ul className="space-y-3">
                      {[
                        { label: 'Ahorros Permanentes', seccion: 'ahorros-permanentes' },
                        { label: 'Ahorros Voluntarios', seccion: 'ahorros-voluntarios' },
                        { label: 'Créditos',            seccion: 'creditos' },
                        { label: 'Eventos',             seccion: 'eventos' },
                      ].map((item) => (
                        <li key={item.label}>
                          <button
                            onClick={() => onNavigate(`servicios#${item.seccion}`)}
                            className="text-slate-400 text-sm hover:text-white cursor-pointer transition-colors flex items-center gap-2 group text-left"
                          >
                            <span className="w-1 h-1 rounded-full bg-[#0f8c62] group-hover:bg-[#f0c040] transition-colors shrink-0" />
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Columna 3: Información */}
                  <div className="md:col-span-2">
                    <p className="text-[#f0c040] font-bold text-xs tracking-widest uppercase mb-5">Información</p>
                    <ul className="space-y-3">
                      {['Sobre nosotros','Términos y condiciones','Política de privacidad','Preguntas frecuentes'].map((item) => (
                        <li key={item}>
                          <span className="text-slate-400 text-sm hover:text-white cursor-pointer transition-colors flex items-center gap-2 group">
                            <span className="w-1 h-1 rounded-full bg-[#0f8c62] group-hover:bg-[#f0c040] transition-colors shrink-0" />
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Columna 4: Contacto */}
                  <div className="md:col-span-4">
                    <p className="text-[#f0c040] font-bold text-xs tracking-widest uppercase mb-5">Contacto</p>
                    <div className="space-y-3">
                      {[
                        { icon: <Phone className="size-4 text-[#0f8c62]" />, text: '+57 314 758 7250' },
                        { icon: <Mail className="size-4 text-[#0f8c62]" />, text: 'marboledalondono@gmail.com' },
                        { icon: <MapPin className="size-4 text-[#0f8c62]" />, text: 'Calle 102c No. 77b 56, Medellín' },
                      ].map((c) => (
                        <div key={c.text} className="flex items-center gap-3 group cursor-pointer">
                          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-[#0f8c62]/20 transition-colors shrink-0">{c.icon}</div>
                          <span className="text-slate-400 text-sm group-hover:text-white transition-colors">{c.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Divisor + Copyright */}
                <div className="border-t border-white/8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
                  <p className="text-slate-500 text-xs">
                    © {new Date().getFullYear()} <span className="text-white font-semibold">UFCA</span> · Unión Familiar de Crédito y Ahorro · Todos los derechos reservados.
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Plataforma activa · Medellín, Colombia
                  </div>
                </div>
              </div>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}