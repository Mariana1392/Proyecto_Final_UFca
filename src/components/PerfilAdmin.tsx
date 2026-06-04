import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { User, Mail, AtSign, Shield, Edit, Save, X, Users, UserCheck, Clock, Phone, Lock, SendHorizonal, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function PerfilAdmin() {
  const { user, recargarPerfil } = useAuth();

  const [isEditing, setIsEditing]       = useState(false);
  const [nombre, setNombre]             = useState(user?.nombre ?? '');
  const [telefono, setTelefono]         = useState('');
  const [saving, setSaving]             = useState(false);
  // Copias originales para restaurar al cancelar
  const [originalNombre, setOriginalNombre]   = useState(user?.nombre ?? '');
  const [originalTelefono, setOriginalTelefono] = useState('');

  const [stats, setStats] = useState({ totalUsuarios: 0, totalAsociados: 0, solicitudesPendientes: 0 });

  // ── Cambio de correo ──────────────────────────────────────────────────────
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [nuevoEmail, setNuevoEmail]         = useState('');
  const [emailSent, setEmailSent]           = useState(false);
  const [sendingEmail, setSendingEmail]     = useState(false);

  // Al montar, siempre recargar desde la BD para evitar mostrar datos del caché
  useEffect(() => { recargarPerfil(); cargarStats(); cargarTelefono(); }, []);

  // Sincronizar estado local cuando el contexto de auth se actualiza
  useEffect(() => {
    if (user?.nombre) {
      setNombre(user.nombre);
      setOriginalNombre(user.nombre);
    }
  }, [user?.nombre]);

  async function cargarTelefono() {
    if (!user) return;
    const { data } = await supabase
      .from('usuarios')
      .select('telefono')
      .eq('id', user.id)
      .single();
    if (data?.telefono) {
      setTelefono(data.telefono);
      setOriginalTelefono(data.telefono);
    }
  }

  async function cargarStats() {
    // Obtener el rol_id de 'asociado' para filtrar usuarios por rol
    const { data: rolAsoc } = await supabase
      .from('roles').select('id').eq('nombre', 'asociado').limit(1).maybeSingle();
    const rolAsociadoId = rolAsoc?.id ?? null;

    const [
      { count: totalUsuarios },
      { count: totalAsociados },
      { count: solicitudesPendientes },
    ] = await Promise.all([
      supabase.from('usuarios').select('*', { count: 'exact', head: true }),
      rolAsociadoId
        ? supabase.from('usuarios').select('*', { count: 'exact', head: true }).eq('rol_id', rolAsociadoId)
        : supabase.from('usuarios').select('*', { count: 'exact', head: true }).not('rol_id', 'is', null),
      supabase.from('solicitudes_asociados').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    ]);
    setStats({
      totalUsuarios:        totalUsuarios  ?? 0,
      totalAsociados:       totalAsociados ?? 0,
      solicitudesPendientes: solicitudesPendientes ?? 0,
    });
  }

  async function handleSave() {
    if (!user) return;
    if (!nombre.trim()) { toast.error('El nombre no puede estar vacío'); return; }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({
          nombre:   nombre.trim(),
          telefono: telefono.trim(),
        })
        .eq('id', user.id);
      if (error) throw error;

      // Recargar perfil en el contexto global (ahora actualiza nombre correctamente)
      await recargarPerfil();

      // Actualizar copias originales con los valores guardados
      setOriginalNombre(nombre.trim());
      setOriginalTelefono(telefono.trim());

      toast.success('✅ Perfil actualizado correctamente');
      setIsEditing(false);
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    // Restaurar valores originales (antes de editar)
    setNombre(originalNombre);
    setTelefono(originalTelefono);
    setIsEditing(false);
  }

  function abrirModalEmail() {
    setNuevoEmail('');
    setEmailSent(false);
    setShowEmailModal(true);
  }

  async function handleEmailChange() {
    const emailTrimmed = nuevoEmail.trim().toLowerCase();

    // Validaciones
    if (!emailTrimmed) {
      toast.error('Ingresa el nuevo correo electrónico');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      toast.error('El formato del correo no es válido');
      return;
    }
    if (emailTrimmed === user?.email?.toLowerCase()) {
      toast.error('El nuevo correo debe ser diferente al actual');
      return;
    }

    setSendingEmail(true);
    try {
      const { data, error } = await supabase.auth.updateUser(
        { email: emailTrimmed },
        { emailRedirectTo: window.location.origin },
      );
      console.log('[UFCA] updateUser response:', { data, error });
      if (error) throw error;

      // Sincronizar el nuevo correo en la tabla usuarios de inmediato,
      // sin esperar el evento EMAIL_CHANGED (que solo dispara al hacer clic en el link)
      if (user?.id) {
        const { error: errTbl } = await supabase
          .from('usuarios')
          .update({ email: emailTrimmed })
          .eq('id', user.id);
        if (errTbl) console.error('[UFCA] Error sincronizando email en usuarios:', errTbl);
        else await recargarPerfil();
      }

      setEmailSent(true);
    } catch (err: any) {
      console.error('[UFCA] Error en cambio de correo:', err);
      toast.error('Error: ' + (err.message ?? 'No se pudo enviar el correo'), {
        description: 'Revisa la consola del navegador (F12) para más detalles.',
        duration: 8000,
      });
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] p-4 sm:p-6 lg:p-8">

      {/* ── Modal cambio de correo ── */}
      <Dialog open={showEmailModal} onOpenChange={open => { setShowEmailModal(open); if (!open) { setNuevoEmail(''); setEmailSent(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Mail className="size-5 text-emerald-600" />
              Cambiar correo electrónico
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              Se enviará un enlace de confirmación al nuevo correo. El cambio solo aplica cuando hagas clic en ese enlace.
            </DialogDescription>
          </DialogHeader>

          {!emailSent ? (
            <div className="space-y-4 pt-2">
              {/* Correo actual */}
              <div className="rounded-xl bg-slate-50 px-4 py-3 flex items-center gap-3">
                <Mail className="size-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">Correo actual</p>
                  <p className="text-sm font-semibold text-slate-600">{user?.email}</p>
                </div>
              </div>

              {/* Nuevo correo */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nuevo correo electrónico</Label>
                <Input
                  type="email"
                  placeholder="nuevo@correo.com"
                  value={nuevoEmail}
                  onChange={e => setNuevoEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEmailChange()}
                  className="rounded-xl"
                  autoFocus
                />
              </div>

              {/* Aviso */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertCircle className="size-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Recibirás un correo de confirmación. Debes hacer clic en el enlace para que el cambio se aplique. Tu sesión actual no se ve afectada.
                </p>
              </div>

              {/* Botones */}
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" className="rounded-xl" onClick={() => setShowEmailModal(false)}>
                  Cancelar
                </Button>
                <Button
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                  onClick={handleEmailChange}
                  disabled={sendingEmail || !nuevoEmail.trim()}
                >
                  <SendHorizonal className="size-4" />
                  {sendingEmail ? 'Enviando...' : 'Enviar confirmación'}
                </Button>
              </div>
            </div>
          ) : (
            /* Estado: correo enviado */
            <div className="space-y-4 pt-2 text-center">
              <div className="flex justify-center">
                <div className="size-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="size-8 text-emerald-600" />
                </div>
              </div>
              <div>
                <p className="font-bold text-slate-800">¡Correo de confirmación enviado!</p>
                <p className="text-sm text-slate-500 mt-1">
                  Revisa la bandeja de entrada de <span className="font-semibold text-slate-700">{nuevoEmail}</span> y haz clic en el enlace para confirmar el cambio.
                </p>
              </div>
              <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500">
                Si no ves el correo, revisa tu carpeta de spam. El enlace expira en 24 horas.
              </div>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl" onClick={() => { setShowEmailModal(false); setEmailSent(false); setNuevoEmail(''); }}>
                Entendido
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <div className="max-w-4xl mx-auto space-y-5">

        {/* ── Tarjeta de perfil principal ── */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">

          {/* Banner — nombre y badges DENTRO del banner */}
          <div className="relative bg-gradient-to-r from-slate-900 via-emerald-900 to-teal-800 px-6 pt-6 pb-12 overflow-hidden">
            <div className="absolute -top-8 -right-8 size-40 rounded-full bg-emerald-500/15" />
            <div className="absolute top-4 left-1/2 size-28 rounded-full bg-teal-400/10" />

            {/* Botones arriba a la derecha */}
            <div className="absolute top-4 right-4 flex gap-2 z-20">
              {!isEditing ? (
                <Button size="sm" className="gap-2 bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm rounded-xl" onClick={() => setIsEditing(true)}>
                  <Edit className="size-3.5" />Editar perfil
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl" onClick={handleCancel}>
                    <X className="size-3.5" />Cancelar
                  </Button>
                  <Button size="sm" className="gap-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl shadow-lg" onClick={handleSave} disabled={saving}>
                    <Save className="size-3.5" />{saving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </>
              )}
            </div>

            {/* Nombre y badges dentro del banner */}
            <div className="relative z-10">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">{user?.nombre ?? 'Administrador'}</h2>
              <p className="text-emerald-300 text-sm mt-0.5">Administrador del sistema · UFCA</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="inline-flex items-center gap-1.5 bg-white/15 text-white text-xs font-semibold px-3 py-1 rounded-full border border-white/20">
                  <Shield className="size-3" />Administrador
                </span>
                <span className="inline-flex items-center gap-1.5 bg-white/10 text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full border border-white/10">
                  <span className="size-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />Cuenta activa
                </span>
              </div>
            </div>
          </div>

          {/* Avatar sobresaliendo del banner */}
          <div className="px-6 pb-6">
            <div className="-mt-8 mb-5">
              <div className="relative inline-block">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg ring-4 ring-white">
                  <Shield className="size-8 text-white" />
                </div>
                <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-400 border-2 border-white flex items-center justify-center">
                  <span className="size-2 rounded-full bg-white inline-block animate-pulse" />
                </span>
              </div>
            </div>

            {/* Separador */}
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2 mb-4">
                <p className="text-sm font-bold text-slate-700">Datos de la cuenta</p>
                {isEditing && (
                  <span className="text-xs bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">Modo edición</span>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">

                {/* Nombre completo */}
                <div className={`rounded-xl p-4 transition-all ${isEditing ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <User className="size-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Nombre completo</span>
                    {isEditing && <span className="ml-auto text-xs text-emerald-600 font-medium">✏️ editable</span>}
                  </div>
                  <Input
                    className={`border-0 p-0 h-auto text-sm font-semibold text-slate-800 bg-transparent focus-visible:ring-0 shadow-none ${!isEditing ? 'cursor-default' : ''}`}
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    disabled={!isEditing}
                  />
                </div>

                {/* Correo */}
                <div className="rounded-xl p-4 bg-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="size-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Correo electrónico</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-600">{user?.email ?? '—'}</p>
                    <button
                      onClick={abrirModalEmail}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1 rounded-full transition-colors"
                    >
                      <Edit className="size-3" />
                      Cambiar
                    </button>
                  </div>
                </div>

                {/* Username */}
                <div className="rounded-xl p-4 bg-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <AtSign className="size-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Usuario</span>
                    <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
                      <Lock className="size-3" />No editable
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-500">{user?.username ?? '—'}</p>
                </div>

                {/* Teléfono */}
                <div className={`rounded-xl p-4 transition-all ${isEditing ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="size-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Teléfono</span>
                    {isEditing && <span className="ml-auto text-xs text-emerald-600 font-medium">✏️ editable</span>}
                  </div>
                  <Input
                    className={`border-0 p-0 h-auto text-sm font-semibold text-slate-800 bg-transparent focus-visible:ring-0 shadow-none ${!isEditing ? 'cursor-default' : ''}`}
                    placeholder="Sin teléfono registrado"
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    disabled={!isEditing}
                  />
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* ── Stats cards ── */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: Users,     label: 'Usuarios totales',       value: stats.totalUsuarios,          bg: 'bg-emerald-100', text: 'text-emerald-600', num: 'text-emerald-700', bar: 'bg-gradient-to-r from-emerald-500 to-teal-400' },
            { icon: UserCheck, label: 'Asociados activos',      value: stats.totalAsociados,         bg: 'bg-blue-100',    text: 'text-blue-600',    num: 'text-blue-700',    bar: 'bg-gradient-to-r from-blue-500 to-indigo-400'  },
            { icon: Clock,     label: 'Solicitudes pendientes', value: stats.solicitudesPendientes,  bg: 'bg-amber-100',   text: 'text-amber-600',   num: 'text-amber-700',   bar: 'bg-gradient-to-r from-amber-500 to-orange-400' },
          ].map(({ icon: Icon, label, value, bg, text, num, bar }) => (
            <div key={label} className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className={`h-1 ${bar}`} />
              <div className="p-5 flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${bg}`}>
                  <Icon className={`size-5 ${text}`} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">{label}</p>
                  <p className={`text-3xl font-extrabold ${num}`}>{value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
