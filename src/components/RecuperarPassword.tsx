import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Mail, Lock, ArrowLeft, CheckCircle, AlertCircle, Clock } from 'lucide-react';

import { supabase } from '../lib/supabase';
import { validateEmail } from '../lib/validation';

const LS_KEY = 'ufca_recuperar_cooldown_until';

interface RecuperarPasswordProps {
  onBack: () => void;
}

export default function RecuperarPassword({ onBack }: RecuperarPasswordProps) {
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ── Cooldown para no exceder el límite de Supabase ────────────────────────
  const [cooldownUntil, setCooldownUntil] = useState<number>(() => {
    const v = localStorage.getItem(LS_KEY);
    return v ? parseInt(v, 10) : 0;
  });
  const [countdown, setCountdown] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) { setCountdown(''); return; }
    const tick = () => {
      const rem = cooldownUntil - Date.now();
      if (rem <= 0) { setCountdown(''); if (timerRef.current) clearInterval(timerRef.current); return; }
      const m = Math.floor(rem / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      setCountdown(m > 0 ? `${m}:${String(s).padStart(2, '0')} min` : `${s} seg`);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cooldownUntil]);

  const iniciarCooldown = (segundos: number) => {
    const until = Date.now() + segundos * 1000;
    localStorage.setItem(LS_KEY, String(until));
    setCooldownUntil(until);
  };

  const enCooldown = cooldownUntil > Date.now();

  // ── Paso 1: Enviar enlace de recuperación por email ───────────────────────
  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (enCooldown) return;

    if (!validateEmail(email)) {
      setError('Formato de correo electrónico inválido');
      return;
    }

    setIsLoading(true);
    try {
      const { error: supaErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/?recuperar=1`,
      });

      if (supaErr) {
        if (supaErr.message.toLowerCase().includes('rate limit') ||
          supaErr.message.toLowerCase().includes('too many')) {
          iniciarCooldown(180); // 3 minutos de espera tras rate limit
          throw new Error('Demasiados intentos. El botón estará disponible de nuevo en 3 minutos.');
        }
        throw supaErr;
      }

      iniciarCooldown(60); // 60 segundos entre envíos para no abusar
      setStep('sent');
    } catch (err: any) {
      setError(err.message || 'Error al enviar el correo de recuperación');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-20 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl mb-4 shadow-lg shadow-emerald-200">
            <Lock className="size-10 text-white" />
          </div>
          <h1 className="text-slate-900 mb-2">Recuperar Contraseña</h1>
          <p className="text-slate-600">
            {step === 'email' && 'Ingresa tu correo electrónico registrado'}
            {step === 'sent' && 'Revisa tu bandeja de entrada'}
          </p>
        </div>

        <Card className="border-slate-200 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="flex items-center gap-2">
              {step === 'email' && <Mail className="size-5 text-emerald-600" />}
              {step === 'sent' && <CheckCircle className="size-5 text-emerald-600" />}
              {step === 'email' && 'Solicitar enlace de recuperación'}
              {step === 'sent' && 'Enlace enviado'}
            </CardTitle>
            <CardDescription>
              {step === 'email' && 'Te enviaremos un enlace seguro para restablecer tu contraseña'}
              {step === 'sent' && 'Haz clic en el enlace del correo para continuar'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* PASO 1: Ingresar email */}
            {step === 'email' && (
              <form onSubmit={handleSendLink} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="py-3">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@correo.com"
                      className="pl-10 border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-200 disabled:opacity-60"
                    disabled={isLoading || enCooldown}
                  >
                    {isLoading ? (
                      'Enviando enlace...'
                    ) : enCooldown ? (
                      <span className="flex items-center gap-2">
                        <Clock className="size-4" /> Disponible en {countdown}
                      </span>
                    ) : (
                      'Enviar enlace de recuperación'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={onBack}
                  >
                    <ArrowLeft className="size-4" />
                    Volver al inicio de sesión
                  </Button>
                </div>

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <strong>Informacion:</strong> Recibirás un enlace seguro en tu correo.
                    Al hacer clic podrás establecer tu nueva contraseña directamente.
                  </p>
                </div>
              </form>
            )}

            {/* PASO 2: Enlace enviado — instrucciones */}
            {step === 'sent' && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2 text-emerald-700 mb-2">
                    <CheckCircle className="size-4" />
                    <p className="text-sm font-medium">Enlace enviado exitosamente</p>
                  </div>
                  <p className="text-xs text-emerald-600">Correo: {email}</p>
                </div>

                <p className="text-sm text-slate-600">
                  Te enviamos un enlace a tu correo para restablecer tu contraseña.
                  Revisa tu bandeja de entrada.
                </p>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <p className="text-xs text-slate-600 font-medium">Pasos a seguir:</p>
                  <ol className="text-xs text-slate-600 space-y-1 list-decimal ml-4">
                    <li>Abre el correo que te enviamos</li>
                    <li>Haz clic en el enlace "Restablecer contraseña"</li>
                    <li>Serás redirigido para crear tu nueva contraseña</li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full disabled:opacity-60"
                    disabled={enCooldown}
                    onClick={() => { setStep('email'); setError(''); }}
                  >
                    {enCooldown
                      ? <span className="flex items-center gap-2"><Clock className="size-4" /> Reenviar disponible en {countdown}</span>
                      : 'Reenviar enlace'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={onBack}
                  >
                    <ArrowLeft className="size-4" />
                    Volver al inicio de sesión
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}