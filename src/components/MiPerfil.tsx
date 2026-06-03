import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  User, Mail, Phone, MapPin, Calendar, Edit, Save, X, Users,
  CreditCard, DollarSign, TrendingUp, Clock,
  CheckCircle2, AlertTriangle, PiggyBank, Landmark, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

interface MiPerfilProps {
  userData: any;
}

export default function MiPerfil({ userData }: MiPerfilProps) {
  const [isEditing, setIsEditing]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validarCampoPerfil = (name: string, value: string) => {
    let error = '';
    if (name === 'email') {
      if (!value.trim()) error = 'El correo es obligatorio';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) error = 'Formato de correo no válido';
    }
    if (name === 'telefono') {
      if (!value.trim()) error = 'El teléfono es obligatorio';
      else if (!/^\d{7,15}$/.test(value.trim().replace(/[\s\-()+]/g, ''))) error = 'Debe contener entre 7 y 15 dígitos';
    }
    setFieldErrors(prev => ({ ...prev, [name]: error }));
    return error;
  };
  const [activeTab, setActiveTab]   = useState('info');
  const [formData, setFormData]     = useState({
    nombre:       userData?.nombre ?? userData?.name ?? '',
    cedula:       userData?.cedula  || '',
    email:        userData?.email   || '',
    telefono:     '',
    direccion:    '',
    fechaIngreso: '',
  });
  const [originalData, setOriginalData] = useState({ ...formData });

  const [asociadoId, setAsociadoId] = useState<string | null>(null);
  const [creditos, setCreditos]     = useState<any[]>([]);
  const [ahorros, setAhorros]       = useState<any[]>([]);
  const [referidos, setReferidos]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (userData?.id) {
      cargarPerfilPorUserId(userData.id);
    } else {
      setLoading(false);
    }
  }, [userData]);

  async function cargarPerfilPorUserId(userId: string) {
    try {
      setLoading(true);
      const { data: base, error: e1 } = await supabase
        .from('usuarios')
        .select('id, nombre, email, cedula, telefono, direccion, fecha_ingreso, estado_cuenta, referido_por_id')
        .eq('id', userId)
        .single();
      if (e1 || !base) throw e1 ?? new Error('Usuario no encontrado');

      const [
        { data: ahPerm },
        { data: ahVol },
        { data: creds },
        { data: refs },
      ] = await Promise.all([
        supabase.from('cuentas_ahorro').select('id, tipo, monto_ahorrado, cuota_mensual, estado, anulado').eq('tipo','permanente').eq('asociado_id', base.id).eq('anulado', false).eq('estado', 'activo'),
        supabase.from('cuentas_ahorro').select('id, tipo, monto_ahorrado, estado, anulado').eq('tipo','voluntario').eq('asociado_id', base.id).eq('anulado', false).eq('estado', 'activo'),
        supabase.from('creditos').select('id, monto, saldo, cuota_mensual, fecha_desembolso, plazo_meses, estado, anulado, tasa_interes').eq('asociado_id', base.id),
        supabase.from('usuarios').select('id, nombre, cedula, telefono, fecha_ingreso, estado_cuenta').eq('referido_por_id', base.id).order('fecha_ingreso', { ascending: false }),
      ]);

      mapearDatos({
        ...base,
        ahorro_permanente: ahPerm ?? [],
        ahorro_voluntario: ahVol  ?? [],
        creditos:          creds  ?? [],
        referidos:         refs   ?? [],
      });
    } catch (err: any) {
      console.warn('Error cargando perfil:', err.message);
      setLoading(false);
    }
  }

  function mapearDatos(data: any) {
    setAsociadoId(data.id);
    const mapped = {
      nombre:       data.nombre       || '',
      cedula:       data.cedula       || '',
      email:        data.email        || '',
      telefono:     data.telefono     || '',
      direccion:    data.direccion    || '',
      fechaIngreso: data.fecha_ingreso || '',
    };
    setFormData(mapped);
    setOriginalData(mapped);

    setCreditos((data.creditos || []).map((c: any) => ({
      id:               `CRE-${c.id.slice(0, 6).toUpperCase()}`,
      monto:            c.monto,
      saldoPendiente:   c.saldo,
      cuotaMensual:     c.cuota_mensual,
      plazo:            c.plazo_meses,
      cuotasPagadas:    Math.round((c.monto - c.saldo) / (c.cuota_mensual || 1)),
      tasaInteres:      c.tasa_interes ?? 0,   // viene de la BD, no hardcodeado
      fechaDesembolso:  c.fecha_desembolso,
      estado:           c.anulado ? 'Anulado' : c.estado ? 'Activo' : 'Liquidado',
    })));

    setAhorros([
      ...(data.ahorro_permanente || []).map((a: any) => ({
        id:            `AHP-${a.id.slice(0, 6).toUpperCase()}`,
        tipo:          'Ahorro Permanente',
        saldo:         a.monto_ahorrado,
        cuota:         a.cuota_mensual,
        ultimoAporte:  a.fecha_inicio,
        fechaApertura: a.fecha_inicio,
        estado:        a.estado === 'activo' ? 'Activo' : 'Inactivo',
      })),
      ...(data.ahorro_voluntario || []).map((a: any) => ({
        id:            `AHV-${a.id.slice(0, 6).toUpperCase()}`,
        tipo:          'Ahorro Voluntario',
        saldo:         a.monto_ahorrado,
        cuota:         0,
        ultimoAporte:  a.fecha_inicio,
        fechaApertura: a.fecha_inicio,
        estado:        a.estado === 'activo' ? 'Activo' : 'Inactivo',
      })),
    ]);

    setReferidos((data.referidos || []).map((r: any) => ({
      nombre:        r.nombre,
      cedula:        r.cedula,
      telefono:      r.telefono || '—',
      fechaReferido: r.fecha_ingreso,
      estado:        r.estado_cuenta === 'activo' ? 'Aprobado' : 'Pendiente',
    })));

    setLoading(false);
  }

  const handleSave = async () => {
    if (!formData.email.trim()) { toast.error('El correo electrónico es obligatorio'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) { toast.error('El correo no tiene formato válido'); return; }
    if (!formData.telefono.trim()) { toast.error('El teléfono es obligatorio'); return; }

    setSaving(true);
    try {
      const usuarioId: string | null = asociadoId || userData?.id || null;

      if (!usuarioId) { toast.error('No se pudo identificar el usuario. Contacta al administrador.'); return; }

      const payload = {
        email:     formData.email.trim(),
        telefono:  formData.telefono.trim(),
        direccion: formData.direccion.trim(),
      };

      const { error: errUsr } = await supabase.from('usuarios').update(payload).eq('id', usuarioId);
      if (errUsr) throw errUsr;

      if (formData.email.trim() !== originalData.email) {
        try { await supabase.auth.updateUser({ email: formData.email.trim() }); } catch { /* no crítico */ }
      }

      const nuevosDatos = { ...formData };
      setFormData(nuevosDatos);
      setOriginalData(nuevosDatos);
      toast.success('✅ Perfil actualizado exitosamente');
      setIsEditing(false);
    } catch (err: any) {
      toast.error('Error al guardar los cambios', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => { setFormData({ ...originalData }); setIsEditing(false); };

  const totalAhorros    = ahorros.reduce((sum, a) => sum + (a.saldo || 0), 0);
  const creditosActivos = creditos.filter(c => c.estado === 'Activo').length;
  const totalReferidos  = referidos.length;

  const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
  const fmtDate = (d: string) => {
    if (!d || d === '-') return '—';
    return new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const perfilIncompleto = !isEditing && (!formData.telefono.trim() || !formData.direccion.trim());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Banner de perfil ── */}
        <Card className="overflow-hidden border-0 shadow-md">
          <div className="h-24 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500" />
          <CardContent className="px-6 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-10">
              <div className="flex items-end gap-4">
                <div className="size-20 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center shrink-0">
                  <User className="size-10 text-emerald-600" />
                </div>
                <div className="mb-1">
                  <h2 className="text-xl font-bold text-slate-900">{formData.nombre}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
                      <CheckCircle2 className="size-3 mr-1" />
                      Asociado activo
                    </Badge>
                    {formData.fechaIngreso && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="size-3" />
                        Miembro desde {new Date(formData.fechaIngreso).getFullYear()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {!isEditing ? (
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 shrink-0" onClick={() => setIsEditing(true)}>
                  <Edit className="size-4" /> Editar perfil
                </Button>
              ) : (
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" className="gap-2" onClick={handleCancel} disabled={saving}>
                    <X className="size-4" /> Cancelar
                  </Button>
                  <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
                    {saving ? <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando...</> : <><Save className="size-4" />Guardar</>}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Estadísticas ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Ahorros Totales</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{fmt(totalAhorros)}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">{ahorros.length} cuenta(s) activa(s)</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <PiggyBank className="size-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Créditos Activos</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{creditosActivos}</p>
                  <p className="text-xs text-blue-600 mt-0.5">{creditos.length} crédito(s) en total</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Landmark className="size-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Referidos</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{totalReferidos}</p>
                  <p className="text-xs text-orange-600 mt-0.5">personas referidas</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <UserCheck className="size-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 bg-white border shadow-sm">
            <TabsTrigger value="info" className="gap-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <User className="size-4" /> Información
            </TabsTrigger>
            <TabsTrigger value="creditos" className="gap-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <CreditCard className="size-4" /> Créditos
            </TabsTrigger>
            <TabsTrigger value="ahorros" className="gap-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <DollarSign className="size-4" /> Ahorros
            </TabsTrigger>
            <TabsTrigger value="referidos" className="gap-2 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">
              <Users className="size-4" /> Referidos
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: Información ── */}
          <TabsContent value="info" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Datos personales</CardTitle>
                <CardDescription>
                  {isEditing
                    ? 'Puedes editar tu correo, teléfono y dirección.'
                    : 'Tu información registrada en la cooperativa.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {perfilIncompleto && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-800 font-medium">Perfil incompleto</p>
                      <p className="text-xs text-amber-700 mt-0.5">Tu teléfono y/o dirección no están registrados.</p>
                      <button className="mt-1.5 text-xs text-amber-800 underline font-medium" onClick={() => setIsEditing(true)}>
                        Completar ahora →
                      </button>
                    </div>
                  </div>
                )}
                {isEditing && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-sm text-emerald-800">
                      <strong>Campos editables:</strong> Correo electrónico, Teléfono y Dirección.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Nombre — no editable */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 flex items-center gap-1">
                      Nombre completo <span className="text-slate-400">(🔒 No editable)</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input value={formData.nombre} disabled className="pl-10 bg-slate-50 text-slate-600 cursor-not-allowed" />
                    </div>
                    <p className="text-xs text-slate-400">El nombre no se puede modificar</p>
                  </div>

                  {/* Cédula — no editable */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 flex items-center gap-1">
                      Cédula <span className="text-slate-400">(🔒 No editable)</span>
                    </Label>
                    <Input value={formData.cedula} disabled className="bg-slate-50 text-slate-600 cursor-not-allowed" />
                    <p className="text-xs text-slate-400">La cédula no se puede modificar</p>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">
                      Correo electrónico {isEditing && <span className="text-emerald-600">(✅ Editable)</span>}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={e => { setFormData({ ...formData, email: e.target.value }); if (fieldErrors.email) validarCampoPerfil('email', e.target.value); }}
                        onBlur={e => isEditing && validarCampoPerfil('email', e.target.value)}
                        disabled={!isEditing}
                        className={`pl-10 ${isEditing ? (fieldErrors.email ? 'border-red-400' : 'border-emerald-300 focus-visible:ring-emerald-500') : ''}`}
                      />
                    </div>
                    {fieldErrors.email && isEditing && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3 shrink-0"/>{fieldErrors.email}</p>}
                    </div>
                  </div>

                  {/* Teléfono */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">
                      Teléfono {isEditing && <span className="text-emerald-600">(✅ Editable)</span>}
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input
                        value={formData.telefono}
                        onChange={e => { setFormData({ ...formData, telefono: e.target.value }); if (fieldErrors.telefono) validarCampoPerfil('telefono', e.target.value); }}
                        onBlur={e => isEditing && validarCampoPerfil('telefono', e.target.value)}
                        disabled={!isEditing}
                        className={`pl-10 ${isEditing ? (fieldErrors.telefono ? 'border-red-400' : 'border-emerald-300 focus-visible:ring-emerald-500') : ''}`}
                      />
                    </div>
                    {fieldErrors.telefono && isEditing && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="size-3 shrink-0"/>{fieldErrors.telefono}</p>}
                  </div>

                  {/* Dirección */}
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-slate-500">
                      Dirección {isEditing && <span className="text-emerald-600">(✅ Editable)</span>}
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input
                        value={formData.direccion}
                        onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                        disabled={!isEditing}
                        className={`pl-10 ${isEditing ? 'border-emerald-300 focus-visible:ring-emerald-500' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Fecha de ingreso */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Fecha de ingreso</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input type="date" value={formData.fechaIngreso} disabled className="pl-10 bg-slate-50" />
                    </div>
                    <p className="text-xs text-slate-400">La fecha de ingreso no se puede modificar</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Créditos ── */}
          <TabsContent value="creditos" className="mt-4 space-y-4">
            {creditos.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <div className="p-4 bg-slate-100 rounded-2xl w-fit mx-auto mb-4">
                    <CreditCard className="size-10 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-700">No tienes créditos registrados</p>
                  <p className="text-sm text-slate-500 mt-1">Contacta a la cooperativa para solicitar un crédito.</p>
                </CardContent>
              </Card>
            ) : (
              creditos.map((c) => {
                const progreso = Math.min((c.cuotasPagadas / c.plazo) * 100, 100);
                const estadoColor = c.estado === 'Activo' ? 'bg-emerald-100 text-emerald-700'
                  : c.estado === 'Liquidado' ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600';
                return (
                  <Card key={c.id} className="border-0 shadow-sm overflow-hidden">
                    <div className={`h-1 ${c.estado === 'Activo' ? 'bg-blue-500' : c.estado === 'Liquidado' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-900">Crédito</span>
                            <Badge className={`${estadoColor} hover:${estadoColor} text-xs`}>{c.estado}</Badge>
                          </div>
                          <p className="text-xs text-slate-500">ID: {c.id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Saldo pendiente</p>
                          <p className="text-2xl font-bold text-blue-600">{fmt(c.saldoPendiente)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                        <div>
                          <p className="text-xs text-slate-500">Monto original</p>
                          <p className="font-semibold text-slate-900">{fmt(c.monto)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Cuota mensual</p>
                          <p className="font-semibold text-slate-900">{fmt(c.cuotaMensual)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Tasa interés</p>
                          <p className="font-semibold text-slate-900">{c.tasaInteres}% mensual</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Plazo</p>
                          <p className="font-semibold text-slate-900">{c.plazo} meses</p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Progreso de pago</span>
                          <span className="font-medium text-slate-700">{c.cuotasPagadas} de {c.plazo} cuotas</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progreso}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="size-3.5" />
                          Desembolso: {fmtDate(c.fechaDesembolso)}
                        </span>
                        {c.estado === 'Liquidado' && (
                          <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                            <CheckCircle2 className="size-3.5" /> Crédito pagado en su totalidad
                          </span>
                        )}
                        {c.estado === 'Activo' && (
                          <span className="flex items-center gap-1.5 text-orange-600">
                            <Clock className="size-3.5" /> En curso
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ── TAB: Ahorros ── */}
          <TabsContent value="ahorros" className="mt-4 space-y-4">
            {ahorros.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <div className="p-4 bg-slate-100 rounded-2xl w-fit mx-auto mb-4">
                    <PiggyBank className="size-10 text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-700">Sin ahorros activos</p>
                  <p className="text-sm text-slate-500 mt-1">Dirígete a <strong>Mis Ahorros</strong> para solicitar un plan.</p>
                </CardContent>
              </Card>
            ) : (
              ahorros.map((a) => (
                <Card key={a.id} className="border-0 shadow-sm overflow-hidden">
                  <div className="h-1 bg-emerald-500" />
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-slate-900">{a.tipo}</span>
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">{a.estado}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">ID: {a.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Saldo acumulado</p>
                        <p className="text-2xl font-bold text-emerald-600">{fmt(a.saldo)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                      <div>
                        <p className="text-xs text-slate-500">Total ahorrado</p>
                        <p className="font-semibold text-slate-900">{fmt(a.saldo)}</p>
                      </div>
                      {a.cuota > 0 && (
                        <div>
                          <p className="text-xs text-slate-500">Cuota mensual</p>
                          <p className="font-semibold text-slate-900">{fmt(a.cuota)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-500">Fecha apertura</p>
                        <p className="font-semibold text-slate-900">{fmtDate(a.fechaApertura)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 text-xs text-emerald-600">
                      <TrendingUp className="size-3.5" />
                      <span>Último movimiento: {fmtDate(a.ultimoAporte)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ── TAB: Referidos ── */}
          <TabsContent value="referidos" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Mis Referidos</CardTitle>
                <CardDescription>Personas que ingresaron a la cooperativa gracias a ti.</CardDescription>
              </CardHeader>
              <CardContent>
                {referidos.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="p-4 bg-slate-100 rounded-2xl w-fit mx-auto mb-4">
                      <Users className="size-10 text-slate-400" />
                    </div>
                    <p className="font-medium text-slate-700">No has referido a nadie aún</p>
                    <p className="text-sm text-slate-500 mt-1">¡Comparte la cooperativa y haz crecer la comunidad!</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Nombre</TableHead>
                        <TableHead>Cédula</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Fecha ingreso</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referidos.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-slate-900">{r.nombre}</TableCell>
                          <TableCell className="text-slate-600">{r.cedula}</TableCell>
                          <TableCell className="text-slate-600">{r.telefono}</TableCell>
                          <TableCell className="text-slate-600">{fmtDate(r.fechaReferido)}</TableCell>
                          <TableCell>
                            <Badge className={r.estado === 'Aprobado'
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-100'}>
                              {r.estado}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
