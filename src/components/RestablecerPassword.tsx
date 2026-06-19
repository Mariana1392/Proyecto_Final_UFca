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
// ── Fondo decorativo reutilizable ────────────────────────────────────────
const Fondo = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-8 bg-slate-50 dark:bg-slate-900">
    <div className="w-full flex items-center justify-center">
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

  // Enfocar el campo nueva contraseña una sola vez cuando la sesión esté lista
  useEffect(() => {
    if (sessionStatus === 'ready') {
      newPasswordRef.current?.focus();
    }
  }, [sessionStatus]);

  const validaciones = {
    longitud: newPassword.length >= 8,
    mayuscula: /[A-Z]/.test(newPassword),
    minuscula: /[a-z]/.test(newPassword),
    numero: /[0-9]/.test(newPassword),
    especial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword),
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
          <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 shadow-md">
            <Loader2 className="size-8 text-[#054030] dark:text-emerald-400 animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Verificando enlace de recuperación…</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Por favor, espera un momento.</p>
          </div>
        </div>
      </Fondo>
    );
  }

  // ── Link expirado o inválido ─────────────────────────────────────────────
  if (sessionStatus === 'error') {
    return (
      <Fondo>
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center size-16 rounded-2xl mb-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 shadow-md">
              <AlertCircle className="size-8 text-rose-600 dark:text-rose-400" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Enlace inválido o expirado</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              El enlace para restablecer tu contraseña ya fue usado o ha expirado. Por favor, solicita uno nuevo desde la pantalla de inicio de sesión.
            </p>
          </div>
          <Button variant="outline" className="w-full border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 bg-white dark:bg-slate-800 h-11 rounded-xl" onClick={onBack}>
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
          <div className="inline-flex items-center justify-center size-20 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 shadow-md">
            <CheckCircle className="size-10" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Clave actualizada!</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Tu contraseña fue modificada correctamente. Estás ingresando a tu cuenta…</p>
          </div>
          <div className="flex justify-center">
            <div className="size-8 border-4 border-[#054030] dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
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
          <div className="inline-flex items-center justify-center size-16 rounded-2xl mb-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 shadow-md">
            <Lock className="size-8 text-[#054030] dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Restablecer contraseña</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#054030] via-[#f0c040] to-[#054030]"/>
          <div className="p-7">
            <div className="mb-6 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                <Lock className="size-5 text-[#054030] dark:text-emerald-400"/>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Tu nueva clave</h3>
                <p className="text-slate-400 dark:text-slate-500 text-sm">Ingresa una clave segura que cumpla con las políticas</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-3 rounded-xl">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    ref={newPasswordRef}
                    id="newPassword"
                    type={showNew ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-10 pr-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-900 focus:border-[#054030] focus:ring-[#054030]/20 border-slate-200 dark:border-slate-700"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  <Input
                    ref={confirmPasswordRef}
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`pl-10 pr-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-900 ${
                      passwordsNoCoinciden
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/30'
                        : 'border-slate-200 dark:border-slate-700 focus:border-[#054030] focus:ring-[#054030]/20'
                    }`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
              <div className="p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/10">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 mb-2">La contraseña debe tener:</p>
                <ul className="space-y-1">
                  {[
                    { ok: validaciones.longitud,  texto: 'Mínimo 8 caracteres' },
                    { ok: validaciones.mayuscula, texto: 'Al menos una letra mayúscula (A–Z)' },
                    { ok: validaciones.minuscula, texto: 'Al menos una letra minúscula (a–z)' },
                    { ok: validaciones.numero,    texto: 'Al menos un número (0–9)' },
                    { ok: validaciones.especial,  texto: 'Al menos un carácter especial (ej. !, @, #, $, %)' },
                    { ok: validaciones.coinciden, texto: 'Las contraseñas coinciden' },
                  ].map(({ ok, texto }) => (
                    <li key={texto} className="flex items-center gap-2 text-xs">
                      <CheckCircle className={`size-3.5 flex-shrink-0 transition-colors ${ok ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                      <span className={ok ? 'text-emerald-800 dark:text-emerald-300 font-medium' : 'text-slate-400 dark:text-slate-500'}>{texto}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[#054030] to-[#0a7050] hover:from-[#032a1e] hover:to-[#054030] text-white font-bold text-base shadow-lg shadow-emerald-900/20"
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
