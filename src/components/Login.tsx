import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Mail, Lock, User, AlertCircle, Shield, CheckCircle2, RefreshCw, ArrowLeft, InboxIcon, PiggyBank, UserCircle2, Eye, EyeOff } from 'lucide-react';
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
  const [registerName, setRegisterName]                     = useState('');
  const [registerEmail, setRegisterEmail]                   = useState('');
  const [registerPassword, setRegisterPassword]             = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [isLoading, setIsLoading]               = useState(false);
  const [error, setError]                       = useState('');
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState('');
  const [resendLoading, setResendLoading]       = useState(false);
  const [resendCooldown, setResendCooldown]     = useState(0);
  const [activeTab, setActiveTab]               = useState<'login'|'register'>('login');

  // ── Visibilidad de contraseñas ─────────────────────────────────────────────
  const [showLoginPassword,   setShowLoginPassword]   = useState(false);
  const [showRegisterPass,    setShowRegisterPass]    = useState(false);
  const [showConfirmPass,     setShowConfirmPass]     = useState(false);

  // ── Login con Supabase Auth ───────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let emailToUse = loginEmail.trim();

      // 1. Si ingresaron username en lugar de email, resolver primero
      if (!emailToUse.includes('@')) {
        const { data: found } = await supabase
          .from('usuarios')
          .select('email, activo')
          .eq('username', emailToUse.toLowerCase())
          .limit(1)
          .single();

        if (!found) { setError('Nombre de usuario no encontrado en el sistema'); setIsLoading(false); return; }
        if (!found.activo) { setError('Tu cuenta está desactivada. Contacta al administrador.'); setIsLoading(false); return; }
        emailToUse = found.email;
      }

      // 2. Autenticar
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

      // 3. Una sola query con todo: usuario + rol + asociado (joins de Supabase)
      const { data: perfil, error: perfilError } = await supabase
        .from('usuarios')
        .select(`
          id, nombre, email, username, identificacion, activo, rol_id, asociado_id,
          roles(nombre, label, permisos),
          asociados(cedula, telefono)
        `)
        .eq('id', authData.user.id)
        .single();

      if (perfilError || !perfil) throw new Error('Usuario no encontrado en el sistema.');
      if (!perfil.activo) { await supabase.auth.signOut(); throw new Error('Tu cuenta está desactivada. Contacta al administrador.'); }

      const rolNombre   = (perfil as any).roles?.nombre   ?? 'usuario';
      const rolLabelDB  = (perfil as any).roles?.label    ?? undefined;
      const rolPermisos = Array.isArray((perfil as any).roles?.permisos) ? (perfil as any).roles.permisos : [];
      const cedula      = (perfil as any).asociados?.cedula ?? perfil.identificacion ?? '';
      const telefono    = (perfil as any).asociados?.telefono ?? '';
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
        id:          authData.user.id,
        nombre:      perfil.nombre,
        email:       perfil.email,
        username:    perfil.username ?? perfil.email.split('@')[0],
        rol:         rolNombre,
        label:       rolLabelDB,
        rol_id:      perfil.rol_id ?? null,
        asociado_id: perfil.asociado_id ?? null,
        activo:      true,
        permisos:    getPermisosEfectivos(rolNombre, rolPermisos),
        cedula:      cedula || undefined,
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
        asociado_id: perfil.asociado_id ?? null, cedula, telefono,
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

  // ── Registro con Supabase Auth ────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (registerName.length < 3) { setError('El nombre debe tener al menos 3 caracteres'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerEmail)) { setError('Formato de correo electrónico inválido'); return; }
    if (registerPassword.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    if (registerPassword !== registerConfirmPassword) { setError('Las contraseñas no coinciden. Verifica e intenta de nuevo.'); return; }

    setIsLoading(true);
    try {
      // 1. Verificar si el correo ya existe en la tabla usuarios
      const { data: existente } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', registerEmail.trim().toLowerCase())
        .maybeSingle();

      if (existente) {
        setError('Este correo ya está registrado. Inicia sesión o usa otro correo.');
        setIsLoading(false);
        return;
      }

      // 2. Crear en Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email:    registerEmail.trim(),
        password: registerPassword,
        options:  { data: { nombre: registerName.trim() } },
      });
      if (signUpError) throw signUpError;

      // 3. Supabase devuelve identities=[] si el email ya existe en Auth pero no en usuarios
      //    (caso de eliminación parcial — borrado de usuarios pero no de Auth)
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        setError('Este correo ya está en uso. Si olvidaste tu contraseña, usa "¿Olvidaste tu contraseña?" o contacta al administrador.');
        setIsLoading(false);
        return;
      }

      // Obtener rol "usuario" de la BD (usuario normal, aún no asociado)
      const { data: rolData } = await supabase
        .from('roles')
        .select('id,nombre,permisos')
        .eq('nombre', 'usuario')
        .limit(1);

      // Insertar en tabla usuarios
      await supabase.from('usuarios').insert({
        id:     data.user!.id,
        nombre: registerName.trim(),
        email:  registerEmail.trim(),
        rol_id: rolData?.[0]?.id ?? null,
        activo: true,
      });

      // Si no hay sesión activa, Supabase requiere confirmación de email
      if (!data.session) {
        setPendingConfirmEmail(registerEmail.trim());
        setIsLoading(false);
        return;
      }

      // Sin confirmación requerida (modo dev/auto-confirm): entrar directamente
      const rolPermisos = Array.isArray(rolData?.[0]?.permisos) ? rolData[0].permisos : [];
      iniciarSesion({
        id:          data.user!.id,
        nombre:      registerName.trim(),
        email:       registerEmail.trim(),
        username:    registerEmail.trim().split('@')[0],
        rol:         'usuario',
        label:       'Usuario',
        rol_id:      rolData?.[0]?.id ?? null,
        asociado_id: null,
        activo:      true,
        permisos:    getPermisosEfectivos('usuario', rolPermisos),
      });

      toast.success('¡Cuenta creada exitosamente!', {
        description: 'Ahora puedes solicitar tu membresía como asociado.',
      });

      setTimeout(() => {
        onLogin('usuario', {
          id:        data.user!.id,
          name:      registerName.trim(),
          email:     registerEmail.trim(),
          role:      'usuario',
          rol_nombre: 'usuario',
        });
      }, 800);
    } catch (err: any) {
      setError(
        err.message?.includes('already registered')
          ? 'Este correo ya está registrado. Intenta iniciar sesión.'
          : err.message || 'Error al crear cuenta'
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
              { icon: <CheckCircle2 className="size-4 text-[#f0c040]"/>, text: 'Créditos con tasas preferenciales' },
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
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">

          {/* Logo móvil */}
          <div className="flex lg:hidden flex-col items-center mb-8">
            <img src={logo} alt="UFCA" className="w-20 h-20 object-contain mb-3"/>
            <h1 className="text-2xl font-black text-[#054030] tracking-widest">UFCA</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 mb-1">Bienvenido</h2>
            <p className="text-slate-500">Accede a tu cuenta o crea una nueva</p>
          </div>

          {/* Tabs propios */}
          <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-2xl mb-6 shadow-sm">
            {(['login','register'] as const).map((tab) => (
              <button key={tab} onClick={() => { setActiveTab(tab); setError(''); setRegisterConfirmPassword(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-gradient-to-r from-[#054030] to-[#0a7050] text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-700'
                }`}>
                {tab === 'login' ? <><Shield className="size-4"/> Iniciar sesión</> : <><UserCircle2 className="size-4"/> Registrarse</>}
              </button>
            ))}
          </div>

          {/* Formulario */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#054030] via-[#f0c040] to-[#054030]"/>
            <div className="p-7">

              {activeTab === 'login' ? (
                <>
                  <div className="mb-6">
                    <h3 className="text-xl font-black text-slate-900">Iniciar sesión</h3>
                    <p className="text-slate-400 text-sm mt-0.5">Ingresa tus credenciales para acceder</p>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                    {error && (
                      <Alert variant="destructive" className="py-3 rounded-xl">
                        <AlertCircle className="size-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email" className="text-slate-700 font-semibold text-sm">Correo o usuario</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"/>
                        <Input id="login-email" type="text" placeholder="tu@correo.com"
                          className="pl-10 h-11 rounded-xl border-slate-200 focus:border-[#054030] focus:ring-[#054030]/20 bg-slate-50"
                          value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                          autoComplete="username" required disabled={isLoading}/>
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
                    <div className="flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2 text-slate-500 cursor-pointer">
                        <input type="checkbox" className="rounded border-slate-300 text-[#054030] focus:ring-[#054030]"/>
                        Recordarme
                      </label>
                      <button type="button" onClick={() => onShowRecovery?.()}
                        className="text-[#054030] font-semibold hover:underline text-sm">
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <Button type="submit" disabled={isLoading}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-[#054030] to-[#0a7050] hover:from-[#032a1e] hover:to-[#054030] text-white font-bold text-base shadow-lg shadow-emerald-900/20 mt-2">
                      {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <h3 className="text-xl font-black text-slate-900">Crear cuenta</h3>
                    <p className="text-slate-400 text-sm mt-0.5">Regístrate y solicita ser asociado de UFCA</p>
                  </div>
                  <form onSubmit={handleRegister} className="space-y-4">
                    {error && (
                      <Alert variant="destructive" className="py-3 rounded-xl">
                        <AlertCircle className="size-4"/>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="register-name" className="text-slate-700 font-semibold text-sm">Nombre completo</Label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"/>
                        <Input id="register-name" type="text" placeholder="Juan Pérez"
                          className="pl-10 h-11 rounded-xl border-slate-200 focus:border-[#054030] focus:ring-[#054030]/20 bg-slate-50"
                          value={registerName} onChange={e => setRegisterName(e.target.value)} required/>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="register-email" className="text-slate-700 font-semibold text-sm">Correo electrónico</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"/>
                        <Input id="register-email" type="email" placeholder="tu@correo.com"
                          className="pl-10 h-11 rounded-xl border-slate-200 focus:border-[#054030] focus:ring-[#054030]/20 bg-slate-50"
                          value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} required/>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="register-password" className="text-slate-700 font-semibold text-sm">Contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400"/>
                        <Input id="register-password" type={showRegisterPass ? 'text' : 'password'} placeholder="••••••••"
                          className="pl-10 pr-11 h-11 rounded-xl border-slate-200 focus:border-[#054030] focus:ring-[#054030]/20 bg-slate-50"
                          value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} required/>
                        <button
                          type="button"
                          onClick={() => setShowRegisterPass(v => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          tabIndex={-1}
                          aria-label={showRegisterPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showRegisterPass ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}
                        </button>
                      </div>
                      <p className="text-xs text-slate-400">Mínimo 6 caracteres</p>
                    </div>

                    {/* ── Confirmar contraseña ── */}
                    <div className="space-y-1.5">
                      <Label htmlFor="register-confirm" className="text-slate-700 font-semibold text-sm">
                        Confirmar contraseña
                      </Label>
                      <div className="relative">
                        <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 size-4 ${
                          registerConfirmPassword.length > 0 && registerPassword !== registerConfirmPassword
                            ? 'text-red-400'
                            : registerConfirmPassword.length > 0 && registerPassword === registerConfirmPassword
                            ? 'text-emerald-500'
                            : 'text-slate-400'
                        }`}/>
                        <Input
                          id="register-confirm"
                          type={showConfirmPass ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={registerConfirmPassword}
                          onChange={e => setRegisterConfirmPassword(e.target.value)}
                          required
                          className={`pl-10 pr-11 h-11 rounded-xl bg-slate-50 transition-colors ${
                            registerConfirmPassword.length > 0 && registerPassword !== registerConfirmPassword
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-200 bg-red-50'
                              : registerConfirmPassword.length > 0 && registerPassword === registerConfirmPassword
                              ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200 bg-emerald-50/40'
                              : 'border-slate-200 focus:border-[#054030] focus:ring-[#054030]/20'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPass(v => !v)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          tabIndex={-1}
                          aria-label={showConfirmPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showConfirmPass ? <EyeOff className="size-4"/> : <Eye className="size-4"/>}
                        </button>
                      </div>
                      {/* Mensajes de validación en tiempo real */}
                      {registerConfirmPassword.length > 0 && registerPassword !== registerConfirmPassword && (
                        <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
                          <AlertCircle className="size-3 shrink-0"/>
                          Las contraseñas no coinciden
                        </p>
                      )}
                      {registerConfirmPassword.length > 0 && registerPassword === registerConfirmPassword && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                          <CheckCircle2 className="size-3 shrink-0"/>
                          Las contraseñas coinciden
                        </p>
                      )}
                    </div>

                    <Button type="submit"
                      disabled={isLoading || (registerConfirmPassword.length > 0 && registerPassword !== registerConfirmPassword)}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-[#054030] to-[#0a7050] hover:from-[#032a1e] hover:to-[#054030] text-white font-bold text-base shadow-lg shadow-emerald-900/20 mt-2">
                      {isLoading ? 'Creando cuenta...' : 'Crear cuenta'}
                    </Button>
                    <p className="text-xs text-slate-400 text-center">
                      Al registrarte aceptas nuestros{' '}
                      <span className="text-[#054030] font-semibold cursor-pointer hover:underline">términos y condiciones</span>
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}