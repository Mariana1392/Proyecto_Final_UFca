import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

// ── Fondo decorativo reutilizable ────────────────────────────────────────
const Fondo = ({ children }: { children: React.ReactNode }) => (
  <div className="relative min-h-screen overflow-hidden flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 70%, #059669 100%)' }}>
    {/* Círculos decorativos */}
    <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-20" style={{ background: '#34d399' }} />
    <div className="absolute top-10 right-16 w-48 h-48 rounded-full opacity-15" style={{ background: '#6ee7b7' }} />
    <div className="absolute top-1/3 -left-16 w-64 h-64 rounded-full opacity-10" style={{ background: '#a7f3d0' }} />
    <div className="absolute -bottom-20 right-0 w-96 h-96 rounded-full opacity-20" style={{ background: '#10b981' }} />
    <div className="absolute bottom-16 left-1/4 w-40 h-40 rounded-full opacity-15" style={{ background: '#34d399' }} />
    <div className="absolute top-1/2 right-1/4 w-24 h-24 rounded-full opacity-10" style={{ background: '#d1fae5' }} />
    <div className="absolute top-3/4 -right-10 w-56 h-56 rounded-full opacity-15" style={{ background: '#059669' }} />
    {/* Marranitos flotantes */}
    <span className="absolute top-8 left-12 text-4xl opacity-30 select-none" style={{ transform: 'rotate(-15deg)' }}>🐷</span>
    <span className="absolute top-1/4 right-10 text-3xl opacity-25 select-none" style={{ transform: 'rotate(10deg)' }}>🐽</span>
    <span className="absolute bottom-1/3 left-8 text-5xl opacity-20 select-none" style={{ transform: 'rotate(-8deg)' }}>🐷</span>
    <span className="absolute bottom-10 right-20 text-3xl opacity-30 select-none" style={{ transform: 'rotate(20deg)' }}>🐽</span>
    <span className="absolute top-2/3 left-1/3 text-2xl opacity-20 select-none" style={{ transform: 'rotate(-5deg)' }}>🐷</span>
    <span className="absolute top-16 right-1/3 text-xl opacity-25 select-none" style={{ transform: 'rotate(12deg)' }}>🐽</span>
    <div className="relative z-10 w-full flex items-center justify-center px-4 py-8">
      {children}
    </div>
  </div>
);

interface CrearPasswordProps {
  onSuccess: () => void;
}

export default function CrearPassword({ onSuccess }: CrearPasswordProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Recovery email temporal en caso de token expirado
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Estado de la sesión: 'checking' → 'ready' | 'error'
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  // Verificar que Supabase procesó el token del link de invitación
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const hash = window.location.hash;

    // Detección inmediata de error
    if (hash.includes('error=') || hash.includes('error_code=')) {
      setSessionStatus('error');
      return;
    }

    const verificarSesion = async () => {
      // 1. Intentar obtener sesión existente
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        localStorage.setItem('ufca_creando_password', '1');
        setRecoveryEmail(session.user.email ?? '');
        setSessionStatus('ready');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return;
      }

      // 2. Si no hay sesión, configurar listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && s) {
          localStorage.setItem('ufca_creando_password', '1');
          setRecoveryEmail(s.user.email ?? '');
          setSessionStatus('ready');
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          subscription.unsubscribe();
          clearTimeout(timeout);
        }
      });

      // 3. Timeout
      timeout = setTimeout(() => {
        subscription.unsubscribe();
        setSessionStatus('error');
      }, 5000);
    };

    verificarSesion();
    return () => clearTimeout(timeout);
  }, []);

  // Advertir si intenta salir a la mitad
  useEffect(() => {
    if (sessionStatus !== 'ready' || done) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sessionStatus, done]);

  const validaciones = {
    longitud: newPassword.length >= 8,
    mayuscula: /[A-Z]/.test(newPassword),
    minuscula: /[a-z]/.test(newPassword),
    numero: /[0-9]/.test(newPassword),
    coinciden: newPassword.length > 0 && newPassword === confirmPassword,
  };

  const todasOk = Object.values(validaciones).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!todasOk) {
      setError('Asegúrate de cumplir con todos los requisitos de seguridad.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: supaErr } = await supabase.auth.updateUser({ password: newPassword });

      if (supaErr) {
        if (
          supaErr.message.toLowerCase().includes('session') ||
          supaErr.message.toLowerCase().includes('auth session missing')
        ) {
          setSessionStatus('error');
          setIsLoading(false);
          return;
        }
        throw supaErr;
      }

      localStorage.removeItem('ufca_creando_password');
      setDone(true);
      toast.success('¡Contraseña creada exitosamente!', {
        description: 'Ya puedes acceder a tu cuenta de asociado UFCA.',
      });

      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al crear la contraseña.');
    }
    setIsLoading(false);
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    setRecoveryLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
      redirectTo: `${window.location.origin}/?bienvenido=1`,
    });
    setRecoveryLoading(false);
    if (error) {
      toast.error('No se pudo enviar el correo. Contacta al administrador.');
    } else {
      setRecoverySent(true);
    }
  };

  // ── Verificando sesión ───────────────────────────────────────────────────
  if (sessionStatus === 'checking') {
    return (
      <Fondo>
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="inline-flex items-center justify-center size-20 rounded-3xl shadow-lg" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
            <Loader2 className="size-10 text-white animate-spin" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Verificando tu invitación…</h2>
            <p className="text-emerald-200 text-sm">Estamos validando tu acceso. Esto solo toma un momento.</p>
          </div>
        </div>
      </Fondo>
    );
  }

  // ── Link expirado o ya usado ─────────────────────────────────────────────
  if (sessionStatus === 'error') {
    return (
      <Fondo>
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center size-20 rounded-3xl mb-4 shadow-lg" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
              <AlertCircle className="size-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Enlace inválido o expirado</h1>
            <p className="text-emerald-200 text-sm leading-relaxed">
              Este enlace de invitación ya fue usado o expiró. Ingresa tu correo para recibir un nuevo enlace.
            </p>
          </div>
          <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)' }}>
            <div className="p-6 space-y-4">
              {recoverySent ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 text-center space-y-2">
                  <CheckCircle className="size-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold">¡Correo enviado!</p>
                  <p className="text-xs">Revisa tu bandeja de entrada y haz clic en el nuevo enlace.</p>
                </div>
              ) : (
                <form onSubmit={handleRecovery} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cp-recoveryEmail">Tu correo electrónico</Label>
                    <Input
                      id="cp-recoveryEmail"
                      type="email"
                      placeholder="ejemplo@correo.com"
                      value={recoveryEmail}
                      onChange={e => setRecoveryEmail(e.target.value)}
                      required
                      disabled={recoveryLoading}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full text-white font-semibold"
                    style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
                    disabled={recoveryLoading || !recoveryEmail.trim()}
                  >
                    {recoveryLoading ? 'Enviando…' : 'Enviarme un nuevo enlace'}
                  </Button>
                </form>
              )}
              <Button variant="outline" className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-white" onClick={onSuccess}>
                Ir al inicio de sesión
              </Button>
            </div>
          </div>
        </div>
      </Fondo>
    );
  }

  // ── Pantalla de éxito ────────────────────────────────────────────────────
  if (done) {
    return (
      <Fondo>
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="inline-flex items-center justify-center size-24 rounded-full shadow-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
            <CheckCircle className="size-12 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-3">¡Bienvenido/a a UFCA!</h1>
            <p className="text-emerald-200">Tu contraseña fue creada correctamente. Estás ingresando a tu cuenta…</p>
          </div>
          <div className="flex justify-center">
            <div className="size-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </Fondo>
    );
  }

  // ── Formulario principal ─────────────────────────────────────────────────
  return (
    <Fondo>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-20 rounded-3xl mb-4 shadow-xl" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
            <Sparkles className="size-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">¡Bienvenido/a a UFCA!</h1>
          <p className="text-emerald-200 text-sm leading-relaxed">
            Tu cuenta ha sido aprobada. Crea una contraseña segura para acceder al sistema.
          </p>
        </div>

        <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)' }}>
          <div className="px-6 pt-5 pb-2 border-b border-emerald-100">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <Lock className="size-4 text-emerald-600" />
              Crear mi contraseña
            </h2>
          </div>

          <div className="px-6 py-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-3">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="sec-alpha-input">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="sec-alpha-input"
                    name="sec-alpha-input"
                    type="text"
                    style={{ WebkitTextSecurity: showNew ? 'none' : 'disc' }}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    placeholder="••••••••"
                    className="pl-10 pr-10 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sec-beta-input">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="sec-beta-input"
                    name="sec-beta-input"
                    type="text"
                    style={{ WebkitTextSecurity: showConfirm ? 'none' : 'disc' }}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    placeholder="••••••••"
                    className="pl-10 pr-10 border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Checklist */}
              <div className="p-3 rounded-xl border border-emerald-100" style={{ background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)' }}>
                <p className="text-xs font-semibold text-emerald-800 mb-2">La contraseña debe tener:</p>
                <ul className="space-y-1">
                  {[
                    { ok: validaciones.longitud,  texto: 'Mínimo 8 caracteres' },
                    { ok: validaciones.mayuscula, texto: 'Al menos una letra mayúscula (A–Z)' },
                    { ok: validaciones.minuscula, texto: 'Al menos una letra minúscula (a–z)' },
                    { ok: validaciones.numero,    texto: 'Al menos un número (0–9)' },
                    { ok: validaciones.coinciden, texto: 'Las contraseñas coinciden' },
                  ].map(({ ok, texto }) => (
                    <li key={texto} className="flex items-center gap-2 text-xs">
                      <CheckCircle className={`size-3.5 flex-shrink-0 transition-colors ${ok ? 'text-emerald-500' : 'text-slate-300'}`} />
                      <span className={ok ? 'text-emerald-800' : 'text-slate-400'}>{texto}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full text-white font-semibold h-11 text-sm"
                style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}
                disabled={isLoading || !todasOk}
              >
                {isLoading ? 'Creando...' : 'Crear contraseña e ingresar'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Fondo>
  );
}
