import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Mail, Lock, AlertCircle, Shield, CheckCircle2, RefreshCw, ArrowLeft, InboxIcon, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import logo from '../assets/logo.svg';

// ── Supabase + Auth ───────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getPermisosEfectivos } from '../lib/permissions';

interface LoginProps {
  onLogin: (role: 'admin' | 'asociado' | 'usuario', userData: any) => void;
  onShowRecovery?: () => void;
}

export default function Login({ onLogin, onShowRecovery }: LoginProps) {
  const { iniciarSesion } = useAuth();
  const [loginEmail, setLoginEmail]           = useState('');
  const [loginPassword, setLoginPassword]     = useState('');
  const [isLoading, setIsLoading]               = useState(false);
  const [error, setError]                       = useState('');
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState('');
  const [resendLoading, setResendLoading]       = useState(false);
  const [resendCooldown, setResendCooldown]     = useState(0);

  // ── Visibilidad de contraseña ─────────────────────────────────────────────
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // ── Login con Supabase Auth ───────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const emailToUse = loginEmail.trim();

      // Validar formato de correo antes de consultar
      if (!emailToUse.includes('@') || !emailToUse.includes('.')) {
        setError('Ingresa un correo electrónico válido para iniciar sesión.');
        setIsLoading(false);
        return;
      }

      // Autenticar
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToUse, password: loginPassword,
      });

      if (authError) {
        if (authError.message === 'Email not confirmed') {
          setPendingConfirmEmail(emailToUse);
          setIsLoading(false); return;
        }
        throw authError;
      }

      // 3. Una sola query con todo: usuario + rol (con permisos desde rol_permisos) + asociado
      const { data: perfil, error: perfilError } = await supabase
        .from('usuarios')
        .select(`
          id, nombre, email, username, activo, rol_id, cedula, telefono,
          roles!rol_id(nombre, label, rol_permisos(permiso_clave, activo))
        `)
        .eq('id', authData.user.id)
        .single();

      if (perfilError || !perfil) {
        console.error('[Login] perfilError:', perfilError);
        throw new Error(perfilError?.message ?? 'Usuario no encontrado en el sistema.');
      }
      if (!perfil.activo) { await supabase.auth.signOut(); throw new Error('Tu cuenta está desactivada. Contacta al administrador.'); }

      // Verificar que el email haya sido confirmado (protege contra emails falsos)
      if (!authData.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setPendingConfirmEmail(emailToUse);
        setIsLoading(false);
        return;
      }

      const rolNombre   = (perfil as any).roles?.nombre   ?? 'usuario';
      const rolLabelDB  = (perfil as any).roles?.label    ?? undefined;
      // Permisos vienen de rol_permisos (tabla relacional) — nunca de columna hardcodeada
      const rolPermisos: string[] = Array.isArray((perfil as any).roles?.rol_permisos)
        ? (perfil as any).roles.rol_permisos
            .filter((rp: any) => rp.activo !== false)   // ignorar permisos quitados (activo=false)
            .map((rp: any) => rp.permiso_clave)
            .filter(Boolean)
        : [];
      const cedula      = (perfil as any).cedula   ?? '';
      const telefono    = (perfil as any).telefono ?? '';
      const role: 'admin' | 'asociado' | 'usuario' =
        rolNombre === 'admin' ? 'admin'
        : rolNombre === 'asociado' ? 'asociado'
        : 'usuario';

      // Registrar último acceso en background (no bloquea el login)
      supabase.from('usuarios')
        .update({ ultimo_acceso: new Date().toISOString() })
        .eq('id', authData.user.id)
        .then(() => {});

      // Guardar en AuthContext
      iniciarSesion({
        id:       authData.user.id,
        nombre:   perfil.nombre,
        email:    perfil.email,
        username: perfil.username ?? perfil.email.split('@')[0],
        rol:      rolNombre,
        label:    rolLabelDB,
        rol_id:   perfil.rol_id ?? null,
        activo:   true,
        permisos: getPermisosEfectivos(rolNombre, rolPermisos),
        cedula:   cedula || undefined,
      });

      const roleLabel =
        role === 'admin' ? 'Administrador'
        : role === 'asociado' ? 'Asociado'
        : 'Usuario';
      toast.success(`¡Bienvenido ${perfil.nombre}!`, {
        description: `✓ Sesión iniciada como ${roleLabel}`,
      });

      onLogin(role, {
        id: authData.user.id, name: perfil.nombre, email: perfil.email,
        role, rol_nombre: rolNombre, permisos: rolPermisos,
        cedula, telefono,
      });
    } catch (err: any) {
      setError(
        err.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos'
          : err.message || 'Error al iniciar sesión'
      );
    }

    setIsLoading(false);
  };

  // ── Reenviar correo de confirmación ──────────────────────────────────────
  const handleResendEmail = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: pendingConfirmEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (resendErr) {
        toast.error('No se pudo reenviar', { description: resendErr.message });
      } else {
        toast.success('Correo reenviado', { description: `Revisa la bandeja de ${pendingConfirmEmail}` });
        setResendCooldown(60);
        const timer = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) { clearInterval(timer); return 0; }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (e: any) {
      toast.error('Error al reenviar', { description: e?.message ?? 'Intenta de nuevo en unos segundos' });
    } finally {
      setResendLoading(false);
    }
  };

  // ── Pantalla de confirmación de email ────────────────────────────────────
  if (pendingConfirmEmail) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-[#021810] via-[#032a1e] to-[#054030] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(#fff 1px,transparent 1px)',backgroundSize:'28px 28px'}}/>
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/5 blur-3xl"/>
        <div className="w-full max-w-md relative z-10">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#054030] via-[#f0c040] to-[#054030]"/>
            <div className="p-8">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="relative mb-5">
                  <div className="size-24 bg-gradient-to-br from-[#054030] to-[#0a7050] rounded-2xl flex items-center justify-center shadow-xl shadow-emerald-900/30">
                    <InboxIcon className="size-12 text-white" />
                  </div>
                  <span className="absolute -bottom-2 -right-2 size-9 bg-[#f0c040] rounded-xl flex items-center justify-center shadow-lg">
                    <Mail className="size-4 text-[#054030]" />
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Revisa tu correo</h2>
                <p className="text-slate-500 text-sm">Enviamos un enlace de confirmación a</p>
                <p className="font-bold text-[#054030] text-sm mt-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
                  {pendingConfirmEmail}
                </p>
              </div>
              <div className="space-y-3 mb-8">
                {[
                  { step: '1', text: 'Abre tu bandeja de entrada (o carpeta de spam)' },
                  { step: '2', text: 'Haz clic en el enlace "Confirmar correo electrónico"' },
                  { step: '3', text: 'Vuelve aquí e inicia sesión con tus credenciales' },
                ].map(({ step, text }) => (
                  <div key={step} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="shrink-0 size-7 bg-gradient-to-br from-[#054030] to-[#0a7050] text-white text-xs font-black rounded-xl flex items-center justify-center">
                      {step}
                    </span>
                    <p className="text-sm text-slate-600">{text}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <Button className="w-full gap-2 bg-gradient-to-r from-[#054030] to-[#0a7050] hover:from-[#032a1e] hover:to-[#054030] text-white rounded-xl h-12 font-bold shadow-lg shadow-emerald-900/20"
                  onClick={handleResendEmail} disabled={resendLoading || resendCooldown > 0}>
                  <RefreshCw className={`size-4 ${resendLoading ? 'animate-spin' : ''}`} />
                  {resendLoading ? 'Reenviando...' : resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar correo'}
                </Button>
                <Button variant="ghost" className="w-full gap-2 text-slate-500 hover:text-slate-900 rounded-xl h-11"
                  onClick={() => { setPendingConfirmEmail(''); setError(''); }}>
                  <ArrowLeft className="size-4" /> Volver al inicio de sesión
                </Button>
              </div>
              <p className="text-xs text-slate-400 text-center mt-5">El enlace expira en 24 horas. Revisa también la carpeta de spam.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── JSX principal — layout de dos columnas ───────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] flex">

      {/* ── Panel izquierdo: branding verde ── */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col items-center justify-center p-12 overflow-hidden bg-gradient-to-br from-[#021810] via-[#032a1e] to-[#054030]">
        {/* Patrón de puntos */}
        <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(#fff 1px,transparent 1px)',backgroundSize:'28px 28px'}}/>
        {/* Orbes */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5 blur-3xl"/>
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-black/20 blur-3xl"/>

        <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-xs">
          {/* Logo grande */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[#f0c040]/20 blur-2xl scale-150"/>
            <img src={logo} alt="UFCA" className="relative w-36 h-36 object-contain drop-shadow-2xl"/>
          </div>

          <div>
            <h1 className="text-5xl font-black text-white tracking-widest leading-none mb-2">UFCA</h1>
            <p className="text-[#f0c040] text-xs font-bold tracking-[0.3em] uppercase">Unión Familiar de Crédito y Ahorro</p>
          </div>

          <p className="text-emerald-100/80 text-base leading-relaxed">
            Administra tus <span className="text-[#f0c040] font-semibold">ahorros y crédito</span> con la confianza de una familia.
          </p>

          <div className="w-full space-y-3">
            {[
              { icon: <Shield className="size-4 text-[#f0c040]"/>, text: 'Plataforma 100% segura' },
              { icon: <CheckCircle2 className="size-4 text-[#f0c040]"/>, text: 'Ahorros permanentes y voluntarios' },
              { icon: <CheckCircle2 className="size-4 text-[#f0c040]"/>, text: 'Créditos' },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/8 border border-white/10 backdrop-blur-sm">
                {b.icon}
                <span className="text-white text-sm font-medium">{b.text}</span>
              </div>
            ))}
          </div>

          {/* Decoración dorada */}
          <div className="flex items-center gap-3 w-full pt-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#f0c040]/50 to-transparent" />
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f0c040]/40" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#f0c040]/70" />
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[#f0c040] flex items-center justify-center">
                <span className="w-1 h-1 rounded-full bg-[#f0c040]" />
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#f0c040]/70" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#f0c040]/40" />
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#f0c040]/50 to-transparent" />
          </div>
        </div>
      </div>

      {/* ── Panel derecho: formulario ── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-slate-50">
        <div className="w-full max-w-md">

          {/* Logo móvil */}
          <div className="flex lg:hidden flex-col items-center mb-8">
            <img src={logo} alt="UFCA" className="w-20 h-20 object-contain mb-3"/>
            <h1 className="text-2xl font-black text-[#054030] tracking-widest">UFCA</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 mb-1">Bienvenido</h2>
            <p className="text-slate-500">Ingresa tus credenciales para acceder a tu cuenta</p>
          </div>

          {/* Formulario de login */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#054030] via-[#f0c040] to-[#054030]"/>
            <div className="p-7">
              <div className="mb-6 flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                  <Shield className="size-5 text-[#054030]"/>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Iniciar sesión</h3>
                  <p className="text-slate-400 text-sm">Ingresa tus credenciales para acceder</p>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="py-3 rounded-xl">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-slate-700 font-semibold text-sm">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"/>
                    <Input id="login-email" type="email" placeholder="tu@correo.com"
                      className="pl-10 h-11 rounded-xl border-slate-200 focus:border-[#054030] focus:ring-[#054030]/20 bg-slate-50"
                      value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                      autoComplete="email" required disabled={isLoading}/>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-slate-700 font-semibold text-sm">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"/>
                    <Input id="login-password" type={showLoginPassword ? 'text' : 'password'} placeholder="••••••••"
                      className="pl-10 pr-11 h-11 rounded-xl border-slate-200 focus:border-[#054030] focus:ring-[#054030]/20 bg-slate-50"
                      value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                      required disabled={isLoading}/>
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      tabIndex={-1}
                      aria-label={showLoginPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showLoginPassword ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button type="button" onClick={() => onShowRecovery?.()}
                    className="text-[#054030] font-semibold hover:underline text-sm">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <Button type="submit" disabled={isLoading}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#054030] to-[#0a7050] hover:from-[#032a1e] hover:to-[#054030] text-white font-bold text-base shadow-lg shadow-emerald-900/20">
                  {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </Button>
              </form>

              {/* Aviso: ¿No tienes cuenta? */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <CheckCircle2 className="size-4 text-amber-600 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">¿Quieres ser asociado?</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      El acceso al sistema es exclusivo para asociados aprobados. Para unirte, usa el botón <strong>"Hazte asociado"</strong> en la página principal y envía tu solicitud.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}