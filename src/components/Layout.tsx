import { useState, useEffect } from "react";
import {
  Menu, X, Home, LogIn, LogOut, Settings, Users, UserCircle,
  TrendingUp, ShoppingCart, Package,
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

interface LayoutProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
  currentView: string;
  onNavigate: (view: any) => void;
  onLogout: () => void;
  userRole?: "admin" | "asociado" | "usuario" | null;
  userData?: any;
  userPermisos?: string[];
}

// Permiso requerido para cada ítem hijo del menú
const CHILD_PERMISO: Record<string, string> = {
  'gestion-roles':    'roles',
  'gestion-usuarios': 'usuarios',
  'gestion-asociados':'asociados',
  'ahorro-permanente':'ahorros',
  'ahorro-voluntario':'ahorros',
  'liquidacion':      'liquidacion',
  'comite-evaluador': 'asociados',
  'creditos':         'creditos',
  'referidos':        'asociados',
  'ventas-list':      'ventas',
  'pedidos':          'pedidos',
  'compras-list':     'compras',
  'productos':        'compras',
  'categorias':       'compras',
  'proveedores':      'compras',
  'eventos':          'eventos',
  'pagos-premios':    'eventos',
  'mediciones':       'dashboard',
  'excepciones':      'configuracion',
};

// Mapeo de vista actual → id del hijo del menú (para resaltar el activo)
const VIEW_TO_CHILD_ID: Record<string, string> = {
  'roles':             'gestion-roles',
  'usuarios':          'gestion-usuarios',
  'asociados':         'gestion-asociados',
  'asociado-detalle':  'gestion-asociados',
  'ahorro-permanente': 'ahorro-permanente',
  'ahorro-voluntario': 'ahorro-voluntario',   // admin; asociado ya usa 'ahorro-permanente'
  'liquidacion':       'liquidacion',
  'comite-evaluador':  'comite-evaluador',
  'creditos':          'creditos',
  'referidos':         'referidos',
  'eventos':           'eventos',
  'pagos-premios':     'pagos-premios',
  'compras':           'compras-list',
  'productos':         'productos',
  'categorias':        'categorias',
  'proveedores':       'proveedores',
  'ventas':            'ventas-list',
  'pedidos':           'pedidos',
  'dashboard':         'mediciones',
  'excepciones':       'excepciones',
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
  const [sidebarOpen, setSidebarOpen]         = useState(true);
  const [expandedMenus, setExpandedMenus]     = useState<string[]>([]);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);
  const { toggleTheme, isDark } = useTheme();

  // Auto-expandir el menú padre que contiene la vista activa
  useEffect(() => {
    if (!isAuthenticated) return;
    const activeChildId = VIEW_TO_CHILD_ID[currentView];
    if (!activeChildId) return;

    // Buscar qué grupo padre contiene ese child
    const parentGroups: Record<string, string[]> = {
      configuracion: ['gestion-roles', 'excepciones'],
      usuarios:      ['gestion-usuarios'],
      asociados:     ['gestion-asociados', 'ahorro-permanente', 'ahorro-voluntario', 'liquidacion', 'comite-evaluador', 'creditos', 'referidos', 'mis-ahorros'],
      ventas:        ['ventas-list', 'pedidos'],
      compras:       ['compras-list', 'productos', 'categorias', 'proveedores'],
      servicios:     ['eventos', 'pagos-premios'],
    };
    const parentId = Object.entries(parentGroups).find(([, children]) => children.includes(activeChildId))?.[0];
    if (parentId) {
      setExpandedMenus(prev => prev.includes(parentId) ? prev : [...prev, parentId]);
    }
  }, [currentView, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && userRole === "admin") {
      cargarSolicitudesPendientes();
    }
  }, [isAuthenticated, userRole, currentView]);

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
      children: userRole === 'asociado' ? [
        // Vista simplificada para el asociado
        { id: "ahorro-permanente", label: "Mis Ahorros" },
        { id: "liquidacion",       label: "Liquidación" },
        { id: "creditos",          label: "Créditos" },
        { id: "referidos",         label: "Referidos" },
      ] : [
        // Vista completa para el admin
        { id: "gestion-asociados",  label: "Gestión de asociados" },
        { id: "ahorro-permanente",  label: "Ahorro permanente" },
        { id: "ahorro-voluntario",  label: "Ahorro voluntario" },
        { id: "liquidacion",        label: "Liquidación" },
        { id: "comite-evaluador",   label: "Comité evaluador" },
        { id: "creditos",           label: "Créditos" },
        { id: "referidos",          label: "Referidos" },
      ],
    },
    {
      id: "ventas",
      label: "Ventas",
      icon: <TrendingUp className="size-5" />,
      children: [
        { id: "ventas-list", label: "Ventas" },
        { id: "pedidos", label: "Pedidos" },
      ],
    },
    {
      id: "compras",
      label: "Compras",
      icon: <ShoppingCart className="size-5" />,
      children: [
        { id: "compras-list", label: "Compras" },
        { id: "productos", label: "Productos" },
        { id: "categorias", label: "Categorías de productos" },
        { id: "proveedores", label: "Proveedores" },
      ],
    },
    {
      id: "servicios",
      label: "Servicios",
      icon: <Package className="size-5" />,
      children: [
        { id: "eventos", label: "Eventos" },
        { id: "pagos-premios", label: "Pagos de premios" },
      ],
    },
  ];

  // Filtrar menús según los permisos reales del usuario
  // Cada hijo solo aparece si el usuario tiene el permiso correspondiente.
  // El padre solo aparece si tiene al menos un hijo visible.
  const tienePermiso = (childId: string) => {
    const permiso = CHILD_PERMISO[childId];
    if (!permiso) return true; // sin restricción definida → visible
    return userPermisos.includes(permiso);
  };

  const filteredMenuItems = menuItems
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => tienePermiso(child.id)),
    }))
    .filter((item) =>
      // Mostrar el grupo solo si tiene al menos un hijo visible
      !item.children || item.children.length > 0
    );

  const toggleMenu = (menuId: string) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId],
    );
  };

  const handleMenuClick = (id: string) => {
    if (id === "solicitudes-asociados") {
      onNavigate("solicitudes-asociados");
    } else if (id === "gestion-roles") {
      onNavigate("roles");
    } else if (id === "roles") {
      onNavigate("roles");
    } else if (id === "gestion-usuarios") {
      onNavigate("usuarios");
    } else if (id === "gestion-acceso") {
      onNavigate("acceso");
    } else if (id === "gestion-asociados") {
      onNavigate("asociados");
    } else if (id === "ahorro-permanente") {
      onNavigate("ahorro-permanente");
    } else if (id === "ahorro-voluntario") {
      onNavigate("ahorro-voluntario");
    } else if (id === "liquidacion") {
      onNavigate("liquidacion");
    } else if (id === "comite-evaluador") {
      onNavigate("comite-evaluador");
    } else if (id === "creditos") {
      onNavigate("creditos");
    } else if (id === "referidos") {
      onNavigate("referidos");
    } else if (id === "eventos") {
      onNavigate("eventos");
    } else if (id === "pagos-premios") {
      onNavigate("pagos-premios");
    } else if (id === "compras-list") {
      onNavigate("compras");
    } else if (id === "productos") {
      onNavigate("productos");
    } else if (id === "categorias") {
      onNavigate("categorias");
    } else if (id === "proveedores") {
      onNavigate("proveedores");
    } else if (id === "ventas-list") {
      onNavigate("ventas");
    } else if (id === "pedidos") {
      onNavigate("pedidos");
    } else if (id === "dashboard" || id === "mediciones") {
      onNavigate("dashboard");
    } else if (id === "excepciones") {
      onNavigate("excepciones");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-50">
        <div className="flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-4">
            {isAuthenticated && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {sidebarOpen ? (
                  <X className="size-5" />
                ) : (
                  <Menu className="size-5" />
                )}
              </button>
            )}
            <div className="flex items-center gap-3">
              <img src={logo} alt="UFCA" className="h-11 w-11 object-contain drop-shadow-md" />
              <div className="hidden sm:flex flex-col leading-tight">
                <span className="text-lg font-bold text-slate-900 tracking-wide">UFCA</span>
                <span className="text-[10px] text-emerald-600 font-medium tracking-widest uppercase">Unión Familiar de Crédito y Ahorro</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Botón tema claro/oscuro */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
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
                asociadoId={userData.asociado_id ?? null}
                onNavigateToExcepciones={() => onNavigate("excepciones")}
                onNavigate={onNavigate}
              />
            )}

            {/* Badge de Usuario y Rol */}
            {isAuthenticated && userData && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg shadow-sm">
                <UserCircle className="size-5 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">
                    {userData.name}
                  </span>
                  <span className="text-xs text-emerald-600">
                    {userData?.rol_nombre === 'admin'    ? 'Administrador'
                     : userData?.rol_nombre === 'asociado' ? 'Asociado'
                     : userData?.rol_nombre === 'usuario'  ? 'Usuario Normal'
                     : userData?.rol_nombre              ? userData.rol_nombre
                     : userRole === 'admin'              ? 'Administrador'
                     : userRole === 'asociado'           ? 'Asociado'
                     : userRole === 'usuario'            ? 'Usuario Normal'
                     :                                    'Usuario Normal'}
                  </span>
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              onClick={() => onNavigate("home")}
              className="gap-2"
            >
              <Home className="size-4" />
              Inicio
            </Button>
            {!isAuthenticated ? (
              <Button
                onClick={() => onNavigate("login")}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <LogIn className="size-4" />
                Login / Registro
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={onLogout}
                className="gap-2"
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Sidebar */}
        {isAuthenticated && (
          <aside
            className={`fixed left-0 top-16 bottom-0 bg-white border-r border-slate-200 transition-all duration-300 overflow-y-auto ${
              sidebarOpen ? "w-64" : "w-0"
            }`}
          >
            {sidebarOpen && (
              <nav className="p-4 space-y-1">
                {/* Logo del sidebar */}
                <div className="flex flex-col items-center gap-2 py-4 mb-3 border-b border-slate-100">
                  <img src={logo} alt="UFCA" className="h-20 w-20 object-contain drop-shadow-lg" />
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-900 tracking-wider">UFCA</p>
                    <p className="text-[10px] text-emerald-600 font-medium tracking-widest uppercase">Unión Familiar de Crédito y Ahorro</p>
                  </div>
                </div>

                {/* Sidebar simplificado para rol usuario */}
                {userRole === 'usuario' ? (
                  <button
                    onClick={() => onNavigate('mi-solicitud')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                      currentView === 'mi-solicitud'
                        ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                        : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="size-5 shrink-0" />
                    <span>Mi Portal</span>
                  </button>
                ) : (
                  <>
                {/* Acceso directo al Dashboard */}
                {isAuthenticated && (
                  <button
                    onClick={() => onNavigate('dashboard')}
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
                    onClick={() => onNavigate('mi-perfil')}
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
            )}
          </aside>
        )}

        {/* Main Content */}
        <main
          className={`flex-1 transition-all duration-300 min-h-[calc(100vh-4rem)] flex flex-col ${
            isAuthenticated && sidebarOpen ? "ml-64" : "ml-0"
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
                    <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                      Sociedad familiar dedicada a gestionar microinversiones, préstamos y ahorros con transparencia y confianza.
                    </p>
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
                      {['Ahorros Permanentes','Ahorros Voluntarios','Créditos','Eventos','Compras y Ventas'].map((item) => (
                        <li key={item}>
                          <span className="text-slate-400 text-sm hover:text-white cursor-pointer transition-colors flex items-center gap-2 group">
                            <span className="w-1 h-1 rounded-full bg-[#0f8c62] group-hover:bg-[#f0c040] transition-colors shrink-0" />
                            {item}
                          </span>
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
                        { icon: <Phone className="size-4 text-[#0f8c62]" />, text: '+57 (300) 123-4567' },
                        { icon: <Mail className="size-4 text-[#0f8c62]" />, text: 'info@ufca.com' },
                        { icon: <MapPin className="size-4 text-[#0f8c62]" />, text: 'Medellín, Colombia' },
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