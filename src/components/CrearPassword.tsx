import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

interface CrearPasswordProps {
  onSuccess: () => void;
}

export default function CrearPassword({ onSuccess }: CrearPasswordProps) {
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew]                 = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [error, setError]                     = useState('');
  const [isLoading, setIsLoading]             = useState(false);
  const [done, setDone]                       = useState(false);
  const [recoveryEmail, setRecoveryEmail]     = useState('');
  const [recoverySent, setRecoverySent]       = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Estado de la sesión: 'checking' → 'ready' | 'error'
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  // Verificar que Supabase procesó el token del link y hay una sesión activa
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const verificarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        sessionStorage.setItem('ufca_creando_password', '1');
        setRecoveryEmail(session.user.email ?? '');
        setSessionStatus('ready');
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && s) {
          sessionStorage.setItem('ufca_creando_password', '1');
          setRecoveryEmail(s.user.email ?? '');
          setSessionStatus('ready');
          subscription.unsubscribe();
          clearTimeout(timeout);
        }
      });

      timeout = setTimeout(() => {
        subscription.unsubscribe();
        setSessionStatus('error');
      }, 10000);
    };

    verificarSesion();
    return () => clearTimeout(timeout);
  }, []);

  // Advertir si el usuario intenta salir sin haber creado la contraseña
  useEffect(() => {
    if (sessionStatus !== 'ready' || done) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sessionStatus, done]);

  // Validaciones en tiempo real
  const validaciones = {
    longitud:   newPassword.length >= 8,
    mayuscula:  /[A-Z]/.test(newPassword),
    minuscula:  /[a-z]/.test(newPassword),
    numero:     /[0-9]/.test(newPassword),
    coinciden:  newPassword.length > 0 && newPassword === confirmPassword,
  };

  const todasOk = Object.values(validaciones).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validaciones.longitud || !validaciones.mayuscula || !validaciones.minuscula || !validaciones.numero) {
      setError('La contraseña no cumple los requisitos mínimos de seguridad.');
      return;
    }
    if (!validaciones.coinciden) {
      setError('Las contraseñas no coinciden.');
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
          // La sesión se perdió mientras el usuario llenaba el formulario (timeout, etc.)
          setSessionStatus('error');
          setIsLoading(false);
          return;
        }
        throw supaErr;
      }

      sessionStorage.removeItem('ufca_creando_password');
      setDone(true);
      toast.success('¡Contraseña creada exitosamente!', {
        description: 'Ya puedes acceder a tu cuenta de asociado UFCA.',
      });

      // Esperar 2 segundos para que el usuario lea el mensaje, luego redirigir
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al crear la contraseña. Inténtalo de nuevo.');
    }
    setIsLoading(false);
  };

  // ── Verificando sesión ───────────────────────────────────────────────────
  if (sessionStatus === 'checking') {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-8">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="inline-flex items-center justify-center size-20 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl shadow-lg shadow-emerald-200">
            <Loader2 className="size-10 text-white animate-spin" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Verificando tu enlace…</h2>
            <p className="text-slate-500 text-sm">Estamos validando tu acceso. Esto solo toma un momento.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Link expirado o ya usado ─────────────────────────────────────────────
  if (sessionStatus === 'error') {
    const handleRecovery = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!recoveryEmail.trim()) return;
      setRecoveryLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
        redirectTo: `${window.location.origin}/?recuperar=1`,
      });
      setRecoveryLoading(false);
      if (error) {
        toast.error('No se pudo enviar el correo. Contacta al administrador.');
      } else {
        setRecoverySent(true);
      }
    };

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center size-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-3xl mb-4 shadow-lg shadow-red-200">
              <AlertCircle className="size-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Enlace inválido o expirado</h1>
            <p className="text-slate-600 text-sm leading-relaxed">
              Este enlace ya fue usado o expiró. Ingresa tu correo para recibir un nuevo enlace de acceso.
            </p>
          </div>
          <Card className="border-red-200 shadow-xl">
            <CardContent className="pt-6 space-y-4">
              {recoverySent ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 text-center space-y-2">
                  <CheckCircle className="size-8 text-emerald-500 mx-auto" />
                  <p className="font-semibold">¡Correo enviado!</p>
                  <p className="text-xs">Revisa tu bandeja de entrada y haz clic en el enlace para crear tu contraseña.</p>
                </div>
              ) : (
                <form onSubmit={handleRecovery} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="recoveryEmail">Tu correo electrónico</Label>
                    <Input
                      id="recoveryEmail"
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
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={recoveryLoading || !recoveryEmail.trim()}
                  >
                    {recoveryLoading ? 'Enviando…' : 'Enviarme un nuevo enlace'}
                  </Button>
                </form>
              )}
              <Button variant="outline" className="w-full" onClick={onSuccess}>
                Ir al inicio de sesión
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Pantalla de éxito ────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-8">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="inline-flex items-center justify-center size-24 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full shadow-xl shadow-emerald-200 animate-pulse">
            <CheckCircle className="size-12 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">¡Bienvenido/a a UFCA!</h1>
            <p className="text-slate-600">Tu contraseña fue creada correctamente. Estás ingresando a tu cuenta…</p>
          </div>
          <div className="flex justify-center">
            <div className="size-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario principal ─────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md">

        {/* Encabezado de bienvenida */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-20 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl mb-4 shadow-lg shadow-emerald-200">
            <Sparkles className="size-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">¡Bienvenido/a a UFCA!</h1>
          <p className="text-slate-600 text-sm leading-relaxed">
            Tu cuenta ha sido aprobada. Crea una contraseña segura para acceder al sistema.
          </p>
        </div>

        <Card className="border-slate-200 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Lock className="size-5 text-emerald-600" />
              Crear mi contraseña
            </CardTitle>
            <CardDescription>
              Elige una contraseña que sea fácil de recordar pero difícil de adivinar.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Alerta de error */}
              {error && (
                <Alert variant="destructive" className="py-3">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Campo: Nueva contraseña */}
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="newPassword"
                    type={showNew ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
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

              {/* Campo: Confirmar contraseña */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
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

              {/* Checklist de requisitos */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-medium text-slate-700 mb-2">La contraseña debe tener:</p>
                <ul className="space-y-1.5">
                  {[
                    { ok: validaciones.longitud,  texto: 'Mínimo 8 caracteres' },
                    { ok: validaciones.mayuscula, texto: 'Al menos una letra mayúscula (A–Z)' },
                    { ok: validaciones.minuscula, texto: 'Al menos una letra minúscula (a–z)' },
                    { ok: validaciones.numero,    texto: 'Al menos un número (0–9)' },
                    { ok: validaciones.coinciden, texto: 'Las contraseñas coinciden' },
                  ].map(({ ok, texto }) => (
                    <li key={texto} className="flex items-center gap-2 text-xs">
                      <CheckCircle
                        className={`size-3.5 flex-shrink-0 transition-colors ${ok ? 'text-emerald-500' : 'text-slate-300'}`}
                      />
                      <span className={ok ? 'text-slate-700' : 'text-slate-400'}>{texto}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Botón de envío */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200 text-white font-semibold"
                disabled={isLoading || !todasOk}
              >
                {isLoading
                  ? 'Creando contraseña…'
                  : 'Crear contraseña e ingresar'}
              </Button>

              {/* Nota informativa */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700 leading-relaxed">
                  <strong>ℹ Información:</strong> Este enlace es de uso único y exclusivo para tu cuenta.
                  Después de crear tu contraseña podrás iniciar sesión normalmente desde la pantalla de acceso.
                </p>
              </div>

            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
