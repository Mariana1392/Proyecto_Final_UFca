import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { User, Mail, AtSign, Shield, Edit, Save, X, Users, UserCheck, Clock } from 'lucide-react';
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

  useEffect(() => { cargarStats(); cargarTelefono(); }, []);

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
    const [
      { count: totalUsuarios },
      { count: totalAsociados },
      { count: solicitudesPendientes },
    ] = await Promise.all([
      supabase.from('usuarios').select('*', { count: 'exact', head: true }),
      supabase.from('asociados').select('*', { count: 'exact', head: true }),
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mi Perfil</h1>
          <p className="text-slate-500 mt-1 text-sm">Información de tu cuenta de administrador</p>
        </div>

        {/* Stats cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="border-slate-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Users className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Usuarios totales</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalUsuarios}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <UserCheck className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Asociados activos</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalAsociados}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Solicitudes pendientes</p>
                <p className="text-2xl font-bold text-slate-900">{stats.solicitudesPendientes}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Perfil card */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 rounded-full">
                  <Shield className="size-6 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-base">{user?.nombre}</CardTitle>
                  <CardDescription>Administrador del sistema</CardDescription>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 ml-2">
                  Administrador
                </Badge>
              </div>

              {!isEditing ? (
                <Button
                  size="sm"
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="size-4" />
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-2" onClick={handleCancel}>
                    <X className="size-4" />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    <Save className="size-4" />
                    {saving ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid sm:grid-cols-2 gap-5">

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  Nombre completo
                  {isEditing && <span className="text-xs text-emerald-600">(✅ Editable)</span>}
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    className="pl-10"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  Correo electrónico
                  <span className="text-xs text-slate-400">(🔒 No editable)</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    className="pl-10 bg-slate-50 cursor-not-allowed text-slate-600"
                    value={user?.email ?? ''}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  Nombre de usuario
                  <span className="text-xs text-slate-400">(🔒 No editable)</span>
                </Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    className="pl-10 bg-slate-50 cursor-not-allowed text-slate-600"
                    value={user?.username ?? ''}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-2">
                  Teléfono
                  {isEditing && <span className="text-xs text-emerald-600">(✅ Editable)</span>}
                </Label>
                <Input
                  placeholder="+57 300 000 0000"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Rol</Label>
                <div className="flex items-center h-10">
                  <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                    Administrador
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Estado de cuenta</Label>
                <div className="flex items-center h-10">
                  <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
                    ● Activo
                  </Badge>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
