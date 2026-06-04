
import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Wallet, ReceiptText, CreditCard, UserCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function MobileLayout() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  if (!user) return null;

  const isAdmin = userData?.rol === 'admin';

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground pb-16">
      {/* Top Header */}
      <header className="bg-card border-b border-border px-4 py-3 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tight">
          UFca Mobile
        </h1>
        <span className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full font-medium">
          {isAdmin ? 'Administrador' : 'Asociado'}
        </span>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-card border-t border-border fixed bottom-0 w-full h-16 px-2 pb-safe flex justify-between items-center z-50">
        <NavLink to="/" className={({ isActive }) => cn(
          "flex flex-col items-center justify-center w-full h-full text-[10px] gap-1 transition-all",
          isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
        )}>
          <LayoutDashboard size={22} className={cn("transition-transform", { "scale-110": location.pathname === "/" })} />
          <span>Inicio</span>
        </NavLink>
        
        <NavLink to="/ahorros" className={({ isActive }) => cn(
          "flex flex-col items-center justify-center w-full h-full text-[10px] gap-1 transition-all",
          isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
        )}>
          <Wallet size={22} />
          <span>Ahorros</span>
        </NavLink>
        
        <NavLink to="/liquidaciones" className={({ isActive }) => cn(
          "flex flex-col items-center justify-center w-full h-full text-[10px] gap-1 transition-all",
          isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
        )}>
          <ReceiptText size={22} />
          <span>Liquidar</span>
        </NavLink>

        <NavLink to="/creditos" className={({ isActive }) => cn(
          "flex flex-col items-center justify-center w-full h-full text-[10px] gap-1 transition-all",
          isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
        )}>
          <CreditCard size={22} />
          <span>Créditos</span>
        </NavLink>
        
        <NavLink to="/perfil" className={({ isActive }) => cn(
          "flex flex-col items-center justify-center w-full h-full text-[10px] gap-1 transition-all",
          isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
        )}>
          <UserCircle size={22} />
          <span>Perfil</span>
        </NavLink>
      </nav>
    </div>
  );
}
