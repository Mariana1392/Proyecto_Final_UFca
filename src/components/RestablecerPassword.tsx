import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
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
    <div className="relative z-10 w-full flex items-center justify-center px-4 py-8">
      {children}
    </div>
  </div>
);

interface RestablecerPasswordProps {
  onSuccess: () => void;
  onBack: () => void;
}

const RestablecerPassword = ({ onSuccess, onBack }: RestablecerPasswordProps) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  
  const newPasswordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // Estado de la sesión: 'checking' → 'ready' | 'error'
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'ready' | 'error'>('checking');

  // Verificar que Supabase procesó el token del link de recuperación
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
        setSessionStatus('ready');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        return;
      }

      // 2. Si no hay sesión, configurar listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && s) {
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

  const validaciones = {
    longitud: newPassword.length >= 8,
    mayuscula: /[A-Z]/.test(newPassword),
    minuscula: /[a-z]/.test(newPassword),
    numero: /[0-9]/.test(newPassword),
    coinciden: newPassword.length > 0 && newPassword === confirmPassword,
  };

  const todasOk = Object.values(validaciones).every(Boolean);
  const passwordsNoCoinciden = confirmPassword.length > 0 && newPassword !== confirmPassword;

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

      if (supaErr) throw supaErr;

      setDone(true);
      toast.success('¡Contraseña actualizada!', {
        description: 'Tu nueva clave ha sido guardada correctamente.',
      });

      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al actualizar la contraseña.');
    }
    setIsLoading(false);
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
            <h2 className="text-xl font-bold text-white mb-2">Verificando enlace de recuperación…</h2>
            <p className="text-emerald-200 text-sm">Por favor, espera un momento.</p>
          </div>
        </div>
      </Fondo>
    );
  }

  // ── Link expirado o inválido ─────────────────────────────────────────────
  if (sessionStatus === 'error') {
    return (
      <Fondo>
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center size-20 rounded-3xl mb-4 shadow-lg" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
            <AlertCircle className="size-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Enlace inválido o expirado</h1>
          <p className="text-emerald-200 text-sm leading-relaxed mb-6">
            El enlace para restablecer tu contraseña ya fue usado o ha expirado. Por favor, solicita uno nuevo desde la pantalla de inicio de sesión.
          </p>
          <Button variant="outline" className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-white" onClick={onBack}>
            Volver al inicio
          </Button>
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
            <h1 className="text-3xl font-bold text-white mb-3">¡Clave actualizada!</h1>
            <p className="text-emerald-200">Tu contraseña fue modificada correctamente. Estás ingresando a tu cuenta…</p>
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
            <KeyRound className="size-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Restablecer contraseña</h1>
          <p className="text-emerald-200 text-sm leading-relaxed">
            Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta.
          </p>
        </div>

        <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)' }}>
          <div className="px-6 pt-5 pb-2 border-b border-emerald-100">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <Lock className="size-4 text-emerald-600" />
              Tu nueva clave
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
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    ref={newPasswordRef}
                    id="newPassword"
                    type={showNew ? 'text' : 'password'}
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
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    ref={confirmPasswordRef}
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`pl-10 pr-10 ${
                      passwordsNoCoinciden
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/30'
                        : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500'
                    }`}
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
                {passwordsNoCoinciden && (
                  <p className="text-xs text-rose-600 flex items-center gap-1 mt-1 font-medium animate-fadeIn">
                    <AlertCircle className="size-3.5 flex-shrink-0" />
                    Las contraseñas no coinciden
                  </p>
                )}
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
                {isLoading ? 'Actualizando...' : 'Guardar y Entrar'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Fondo>
  );
};

export default RestablecerPassword;
