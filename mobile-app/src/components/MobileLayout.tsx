import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LayoutDashboard, Wallet, ReceiptText, CreditCard, UserCircle, Settings, Moon, Sun, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import logo from '../assets/logo.svg';

export default function MobileLayout() {
  const { user, userData } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) return null;

  const isAdmin = userData?.rol === 'admin';

  const navItems = [
    { to: '/',              label: 'Inicio',    icon: LayoutDashboard },
    { to: '/ahorros',       label: 'Ahorros',   icon: Wallet          },
    { to: '/liquidaciones', label: 'Liquidar',  icon: ReceiptText     },
    { to: '/creditos',      label: 'Créditos',  icon: CreditCard      },
    ...(isAdmin
      ? [{ to: '/usuarios',      label: 'Usuarios', icon: Users }]
      : [{ to: '/perfil',        label: 'Perfil',   icon: UserCircle }]
    ),
  ];

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground pb-16">
      {/* Top Header */}
      <header className="bg-card border-b border-border px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <img src={logo} alt="UFCA" className="h-8 w-8 object-contain drop-shadow-md shrink-0" />
          <h1 className="text-xl font-bold tracking-wider">UFCA</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {isAdmin && (
            <>
              <NavLink to="/configuracion" className={({ isActive }) => cn(
                'p-1.5 rounded-full transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}>
                <Settings size={20} />
              </NavLink>
              <NavLink to="/perfil" className={({ isActive }) => cn(
                'p-1.5 rounded-full transition-colors',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}>
                <UserCircle size={20} />
              </NavLink>
            </>
          )}
          <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full font-medium">
            {isAdmin ? 'Administrador' : 'Asociado'}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-card border-t border-border fixed bottom-0 w-full h-16 px-1 pb-safe flex justify-between items-center z-50">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cn(
              'flex flex-col items-center justify-center flex-1 h-full text-[10px] gap-1 transition-all',
              isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {({ isActive }) => (
              <>
                <Icon size={22} className={cn('transition-transform', isActive && 'scale-110')} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
