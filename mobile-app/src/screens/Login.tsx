import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import logo from '../assets/logo.svg';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4 bg-slate-50 dark:bg-slate-900">
      <Card className="w-full max-w-sm animate-fade-in shadow-xl border-slate-200 dark:border-slate-800">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="flex justify-center mb-2 animate-bounce-in">
            <img src={logo} alt="UFCA Logo" className="w-16 h-16 object-contain drop-shadow-md" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-widest">UFCA</CardTitle>
          <CardDescription className="text-slate-500 font-medium text-[10px] tracking-[0.2em] uppercase">Unión Familiar de Crédito y Ahorro</CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm mb-6 text-center animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                className="bg-white dark:bg-slate-900"
              />
            </div>

            <div className="space-y-2 text-left">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-white dark:bg-slate-900"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-4 h-11 text-base font-medium transition-all active:scale-[0.98]"
            >
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
