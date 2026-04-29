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
  CreditCard, DollarSign, ShoppingCart, TrendingUp, Clock,
  CheckCircle2, Package, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '../lib/supabase';

interface MiPerfilProps {
  userData: any;
}

export default function MiPerfil({ userData }: MiPerfilProps) {
  const [isEditing, setIsEditing]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [activeTab, setActiveTab]   = useState('info');
  const [formData, setFormData]     = useState({
    nombre:       userData?.nombre ?? userData?.name ?? '',
    cedula:       userData?.cedula  || '',
    email:        userData?.email   || '',
    telefono:     '',
    direccion:    '',
    fechaIngreso: '',
  });
  // Copia de respaldo para restaurar al cancelar
  const [originalData, setOriginalData] = useState({ ...formData });

  const [asociadoId, setAsociadoId] = useState<string | null>(null);
  const [creditos, setCreditos]     = useState<any[]>([]);
  const [ahorros, setAhorros]       = useState<any[]>([]);
  const [pedidos, setPedidos]       = useState<any[]>([]);
  const [referidos, setReferidos]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (userData?.asociado_id) {
      // Ruta más directa: tenemos el ID del asociado desde el login
      cargarPerfilPorAsociadoId(userData.asociado_id);
    } else if (userData?.cedula) {
      cargarPerfil(userData.cedula);
    } else if (userData?.id) {
      cargarPerfilPorUserId(userData.id);
    } else {
      setLoading(false);
    }
  }, [userData]);

  // Query seguro: solo tablas que existen con certeza
  async function queryAsociado(filtro: { campo: 'id' | 'cedula'; valor: string }) {
    // Paso 1: cargar datos básicos del asociado (siempre existe)
    const q1 = supabase.from('asociados').select('*');
    const { data: base, error: e1 } = await (filtro.campo === 'id'
      ? q1.eq('id', filtro.valor).single()
      : q1.eq('cedula', filtro.valor).single());
    if (e1 || !base) throw e1 ?? new Error('Asociado no encontrado');

    // Paso 2: cargar relaciones opcionales de forma independiente (si fallan, no bloquean)
    const [
      { data: ahPerm },
      { data: ahVol },
      { data: creds },
      { data: refs },
      { data: peds },
    ] = await Promise.all([
      supabase.from('ahorro_permanente').select('id, monto_ahorrado, cuota_mensual, fecha_inicio, estado').eq('asociado_id', base.id),
      supabase.from('ahorro_voluntario').select('id, monto_ahorrado, cuota_mensual, fecha_inicio, estado').eq('asociado_id', base.id),
      supabase.from('creditos').select('id, monto, saldo, cuota_mensual, fecha_desembolso, plazo_meses, estado, anulado').eq('asociado_id', base.id),
      supabase.from('asociados').select('id, nombre, cedula, telefono, fecha_ingreso, estado').eq('referido_por_id', base.id),
      supabase.from('pedidos').select('id, total, fecha, estado').eq('asociado_id', base.id).then(r => r).catch(() => ({ data: [] })),
    ]);

    return {
      ...base,
      ahorro_permanente: ahPerm ?? [],
      ahorro_voluntario: ahVol ?? [],
      creditos:          creds ?? [],
      referidos:         refs  ?? [],
      pedidos:           peds  ?? [],
    };
  }

  async function cargarPerfilPorAsociadoId(id: string) {
    try {
      setLoading(true);
      const data = await queryAsociado({ campo: 'id', valor: id });
      mapearDatos(data);
    } catch (err: any) {
      console.warn('Error cargando perfil por asociado_id:', err.message);
      // Aunque falle la carga de relaciones, setear el ID para que handleSave funcione
      setAsociadoId(id);
      setLoading(false);
    }
  }

  async function cargarPerfil(cedula: string) {
    try {
      setLoading(true);
      const data = await queryAsociado({ campo: 'cedula', valor: cedula });
      mapearDatos(data);
    } catch (err: any) {
      console.warn('Perfil no encontrado en BD:', err.message);
      setLoading(false);
    }
  }

  async function cargarPerfilPorUserId(userId: string) {
    try {
      setLoading(true);
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('asociado_id')
        .eq('id', userId)
        .single();

      if (usuario?.asociado_id) {
        const data = await queryAsociado({ campo: 'id', valor: usuario.asociado_id });
        mapearDatos(data);
      }
    } catch (err: any) {
      console.warn('Error cargando perfil:', err.message);
    } finally {
      setLoading(false);
    }
  }

  function mapearDatos(data: any) {
    setAsociadoId(data.id);
    const mapped = {
      nombre:       data.nombre,
      cedula:       data.cedula,
      email:        data.email         || '',
      telefono:     data.telefono      || '',
      direccion:    data.direccion     || '',
      fechaIngreso: data.fecha_ingreso || '',
    };
    setFormData(mapped);
    setOriginalData(mapped); // guardar copia para el botón Cancelar

    setCreditos((data.creditos || []).map((c: any) => ({
      id:               `CRE-${c.id.slice(0, 6).toUpperCase()}`,
      tipo:             'Crédito',
      monto:            c.monto,
      saldoPendiente:   c.saldo,
      cuotaMensual:     c.cuota_mensual,
      plazo:            c.plazo_meses,
      cuotasPagadas:    Math.round((c.monto - c.saldo) / (c.cuota_mensual || 1)),
      cuotasPendientes: Math.round(c.saldo / (c.cuota_mensual || 1)),
      tasaInteres:      1.8,
      fechaDesembolso:  c.fecha_desembolso,
      estado:           c.anulado ? 'Anulado' : c.estado ? 'Activo' : 'Liquidado',
      proximoPago:      '-',
    })));

    setAhorros([
      ...(data.ahorro_permanente || []).map((a: any) => ({
        id:                `AHP-${a.id.slice(0, 6).toUpperCase()}`,
        tipo:              'Ahorro Permanente',
        saldo:             a.monto_ahorrado,
        aporteObligatorio: a.cuota_mensual,
        ultimoAporte:      a.fecha_inicio,
        totalAportes:      a.monto_ahorrado,
        rendimientos:      0,
        estado:            a.estado ? 'Activo' : 'Inactivo',
        fechaApertura:     a.fecha_inicio,
      })),
      ...(data.ahorro_voluntario || []).map((a: any) => ({
        id:                `AHV-${a.id.slice(0, 6).toUpperCase()}`,
        tipo:              'Ahorro Voluntario',
        saldo:             a.monto_ahorrado,
        aporteObligatorio: 0,
        ultimoAporte:      a.fecha_inicio,
        totalAportes:      a.monto_ahorrado,
        rendimientos:      0,
        estado:            a.estado ? 'Activo' : 'Inactivo',
        fechaApertura:     a.fecha_inicio,
      })),
    ]);

    setPedidos((data.pedidos || []).map((p: any) => ({
      id:          `PED-${p.id.slice(0, 6).toUpperCase()}`,
      productos:   (p.pedidos_detalle || []).map((d: any) => ({
        nombre:   d.productos?.nombre ?? 'Producto',
        cantidad: d.cantidad,
        precio:   d.precio_unit,
      })),
      total:        p.total,
      fechaPedido:  p.fecha,
      estado:       p.estado === 'entregado' ? 'Entregado'
                  : p.estado === 'aprobado'  ? 'En tránsito'
                  : p.estado === 'pendiente' ? 'Pendiente'
                  : p.estado,
      metodoPago:   'Contado',
      fechaEntrega: '-',
    })));

    setReferidos((data.referidos || []).map((r: any) => ({
      nombre:         r.nombre,
      cedula:         r.cedula,
      telefono:       r.telefono || '',
      fechaReferido:  r.fecha_ingreso,
      estadoReferido: r.estado ? 'Aprobado' : 'Pendiente',
      bonificacion:   50000,
    })));

    setLoading(false);
  }

  // ── Guardar cambios en Supabase ───────────────────────────────────────────
  const handleSave = async () => {
    // Validaciones
    if (!formData.email.trim()) {
      toast.error('El correo electrónico es obligatorio');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      toast.error('El correo electrónico no tiene un formato válido');
      return;
    }
    if (!formData.telefono.trim()) {
      toast.error('El teléfono es obligatorio');
      return;
    }

    setSaving(true);
    try {
      // ── 1. Resolver el ID del asociado ───────────────────────────────────
      let idFinal: string | null = asociadoId || userData?.asociado_id || null;
      let usuarioId: string | null = userData?.id || null;

      if (!idFinal || !usuarioId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          usuarioId = usuarioId ?? user.id;
          const { data: usr } = await supabase
            .from('usuarios')
            .select('id, asociado_id')
            .eq('id', user.id)
            .single();
          if (usr?.asociado_id) {
            idFinal  = idFinal  ?? usr.asociado_id;
            usuarioId = usuarioId ?? usr.id;
          } else {
            const { data: asoc } = await supabase
              .from('asociados')
              .select('id')
              .eq('email', user.email ?? '')
              .maybeSingle();
            if (asoc?.id) idFinal = asoc.id;
          }
        }
      }

      if (!idFinal) {
        toast.error('No se pudo identificar el asociado. Contacta al administrador.');
        return;
      }

      const ahora  = new Date().toISOString();
      const payload = {
        email:              formData.email.trim(),
        telefono:           formData.telefono.trim(),
        direccion:          formData.direccion.trim(),
        fecha_modificacion: ahora,
      };

      // ── 2. Actualizar tabla asociados ────────────────────────────────────
      const { error: errAsoc } = await supabase
        .from('asociados')
        .update(payload)
        .eq('id', idFinal);
      if (errAsoc) throw errAsoc;

      // ── 3. Sincronizar tabla usuarios (email, telefono, direccion) ────────
      if (usuarioId) {
        await supabase
          .from('usuarios')
          .update({
            email:    formData.email.trim(),
            telefono: formData.telefono.trim(),
            direccion: formData.direccion.trim(),
          })
          .eq('id', usuarioId);
        // Si el email cambió, actualizamos también Supabase Auth
        if (formData.email.trim() !== originalData.email) {
          try {
            await supabase.auth.updateUser({ email: formData.email.trim() });
          } catch { /* no crítico si falla Auth */ }
        }
      }

      // ── 4. Actualizar estado local ────────────────────────────────────────
      if (!asociadoId) setAsociadoId(idFinal);
      const nuevosDatos = { ...formData };
      setFormData(nuevosDatos);
      setOriginalData(nuevosDatos); // nueva base para futuros cancelar

      toast.success('✅ Perfil actualizado exitosamente', {
        description: 'Los cambios se han guardado en el sistema.',
      });
      setIsEditing(false);
    } catch (err: any) {
      toast.error('Error al guardar los cambios', {
        description: err.message ?? 'Inténtalo nuevamente.',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Cancelar: restaura los valores originales desde la BD ─────────────────
  const handleCancel = () => {
    setFormData({ ...originalData });
    setIsEditing(false);
  };

  // ── Estadísticas calculadas ───────────────────────────────────────────────
  const totalAhorros    = ahorros.reduce((sum, a) => sum + (a.saldo || 0), 0);
  const creditosActivos = creditos.filter(c => c.estado === 'Activo').length;
  const totalReferidos  = referidos.length;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', {
      style:                 'currency',
      currency:              'COP',
      minimumFractionDigits: 0,
    }).format(amount);

  const formatDate = (date: string) => {
    if (!date || date === '-') return '-';
    return new Date(date).toLocaleDateString('es-CO', {
      year:  'numeric',
      month: 'long',
      day:   'numeric',
    });
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'Activo':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Activo</Badge>;
      case 'Liquidado':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Liquidado</Badge>;
      case 'Entregado':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Entregado</Badge>;
      case 'En tránsito':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">En tránsito</Badge>;
      case 'Pendiente':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Pendiente</Badge>;
      default:
        return <Badge>{estado}</Badge>;
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Mi Perfil</h1>
            <p className="text-slate-600">Gestiona tu información personal y consulta tus productos</p>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Ahorros Totales</p>
                  <p className="text-2xl font-semibold text-slate-900">{formatCurrency(totalAhorros)}</p>
                </div>
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <DollarSign className="size-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Créditos Activos</p>
                  <p className="text-2xl font-semibold text-slate-900">{creditosActivos}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <CreditCard className="size-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Pedidos</p>
                  <p className="text-2xl font-semibold text-slate-900">{pedidos.length}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-xl">
                  <ShoppingCart className="size-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Referidos</p>
                  <p className="text-2xl font-semibold text-slate-900">{totalReferidos}</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Users className="size-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto">
            <TabsTrigger value="info" className="gap-2">
              <User className="size-4" />
              Información
            </TabsTrigger>
            <TabsTrigger value="creditos" className="gap-2">
              <CreditCard className="size-4" />
              Créditos
            </TabsTrigger>
            <TabsTrigger value="ahorros" className="gap-2">
              <DollarSign className="size-4" />
              Ahorros
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-2">
              <ShoppingCart className="size-4" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="referidos" className="gap-2">
              <Users className="size-4" />
              Referidos
            </TabsTrigger>
          </TabsList>

          {/* TAB: Información Personal */}
          <TabsContent value="info" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-emerald-100 rounded-2xl">
                      <User className="size-8 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle>{formData.nombre}</CardTitle>
                      <CardDescription>Asociado activo</CardDescription>
                    </div>
                    <Badge className="ml-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      Activo
                    </Badge>
                  </div>
                  {!isEditing ? (
                    <Button
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="size-4" />
                      Editar perfil
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={handleCancel}
                        disabled={saving}
                      >
                        <X className="size-4" />
                        Cancelar
                      </Button>
                      <Button
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? (
                          <>
                            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <Save className="size-4" />
                            Guardar cambios
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Alerta cuando hay datos incompletos */}
                {!isEditing && (
                  formData.telefono === 'Sin registro' ||
                  formData.direccion === 'Sin registro' ||
                  !formData.telefono.trim() ||
                  !formData.direccion.trim()
                ) && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-800 font-medium">Perfil incompleto</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        Tu teléfono y/o dirección no están registrados. Por favor actualiza tu información.
                      </p>
                      <button
                        className="mt-2 text-xs text-amber-800 underline font-medium"
                        onClick={() => setIsEditing(true)}
                      >
                        Completar ahora →
                      </button>
                    </div>
                  </div>
                )}
                {isEditing && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Campos editables:</strong> Correo electrónico, Teléfono y Dirección.
                      Los campos Nombre y Cédula no pueden modificarse.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="nombre" className="flex items-center gap-2">
                      Nombre completo
                      <span className="text-xs text-slate-400 font-normal">(🔒 No editable)</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        disabled
                        className="pl-10 bg-slate-50 cursor-not-allowed text-slate-600"
                      />
                    </div>
                    <p className="text-xs text-slate-500">El nombre no se puede modificar</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cedula" className="flex items-center gap-2">
                      Cédula
                      <span className="text-xs text-slate-400 font-normal">(🔒 No editable)</span>
                    </Label>
                    <Input id="cedula" value={formData.cedula} disabled className="bg-slate-50 cursor-not-allowed text-slate-600" />
                    <p className="text-xs text-slate-500">La cédula no se puede modificar</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      Correo electrónico
                      {isEditing && <span className="text-xs text-emerald-600 font-normal">(✅ Editable)</span>}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={!isEditing}
                        className={`pl-10 ${isEditing ? 'border-emerald-300 focus:ring-emerald-500' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefono" className="flex items-center gap-2">
                      Teléfono
                      {isEditing && <span className="text-xs text-emerald-600 font-normal">(✅ Editable)</span>}
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input
                        id="telefono"
                        value={formData.telefono}
                        onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                        disabled={!isEditing}
                        className={`pl-10 ${isEditing ? 'border-emerald-300 focus:ring-emerald-500' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="col-span-1 md:col-span-2 space-y-2">
                    <Label htmlFor="direccion" className="flex items-center gap-2">
                      Dirección
                      {isEditing && <span className="text-xs text-emerald-600 font-normal">(✅ Editable)</span>}
                    </Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input
                        id="direccion"
                        value={formData.direccion}
                        onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                        disabled={!isEditing}
                        className={`pl-10 ${isEditing ? 'border-emerald-300 focus:ring-emerald-500' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fechaIngreso">Fecha de ingreso</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input
                        id="fechaIngreso"
                        type="date"
                        value={formData.fechaIngreso}
                        disabled
                        className="pl-10 bg-slate-50"
                      />
                    </div>
                    <p className="text-xs text-slate-500">La fecha de ingreso no se puede modificar</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Mis Créditos */}
          <TabsContent value="creditos" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-blue-100 rounded-2xl">
                    <CreditCard className="size-8 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Mis Créditos</CardTitle>
                    <CardDescription>Consulta el estado de tus créditos</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {creditos.map((credito) => (
                    <Card key={credito.id} className="border border-slate-200">
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-slate-900">{credito.tipo}</h3>
                                {getEstadoBadge(credito.estado)}
                              </div>
                              <p className="text-sm text-slate-600">ID: {credito.id}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-600">Saldo Pendiente</p>
                              <p className="text-2xl font-bold text-blue-600">{formatCurrency(credito.saldoPendiente)}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
                            <div>
                              <p className="text-xs text-slate-500">Monto Original</p>
                              <p className="font-semibold text-slate-900">{formatCurrency(credito.monto)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Cuota Mensual</p>
                              <p className="font-semibold text-slate-900">{formatCurrency(credito.cuotaMensual)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Tasa de Interés</p>
                              <p className="font-semibold text-slate-900">{credito.tasaInteres}% mensual</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Plazo</p>
                              <p className="font-semibold text-slate-900">{credito.plazo} meses</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-600">Progreso de pagos</span>
                              <span className="font-semibold text-slate-900">
                                {credito.cuotasPagadas} de {credito.plazo} cuotas
                              </span>
                            </div>
                            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all"
                                style={{ width: `${Math.min((credito.cuotasPagadas / credito.plazo) * 100, 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Calendar className="size-4" />
                              <span>Desembolso: {formatDate(credito.fechaDesembolso)}</span>
                            </div>
                            {credito.estado === 'Activo' && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="size-4 text-orange-600" />
                                <span className="text-slate-900">
                                  Próximo pago: <span className="font-semibold">{formatDate(credito.proximoPago)}</span>
                                </span>
                              </div>
                            )}
                            {credito.estado === 'Liquidado' && (
                              <div className="flex items-center gap-2 text-sm text-emerald-600">
                                <CheckCircle2 className="size-4" />
                                <span className="font-semibold">Crédito completamente pagado</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {creditos.length === 0 && (
                    <div className="text-center py-12">
                      <div className="flex justify-center mb-4">
                        <div className="p-4 bg-slate-100 rounded-2xl">
                          <CreditCard className="size-12 text-slate-400" />
                        </div>
                      </div>
                      <p className="text-slate-600">No tienes créditos activos</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Mis Ahorros */}
          <TabsContent value="ahorros" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-emerald-100 rounded-2xl">
                    <DollarSign className="size-8 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle>Mis Ahorros</CardTitle>
                    <CardDescription>Consulta el estado de tus cuentas de ahorro</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ahorros.map((ahorro) => (
                    <Card key={ahorro.id} className="border border-slate-200">
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-slate-900">{ahorro.tipo}</h3>
                                {getEstadoBadge(ahorro.estado)}
                              </div>
                              <p className="text-sm text-slate-600">ID: {ahorro.id}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-600">Saldo Total</p>
                              <p className="text-2xl font-bold text-emerald-600">{formatCurrency(ahorro.saldo)}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
                            <div>
                              <p className="text-xs text-slate-500">Total Aportes</p>
                              <p className="font-semibold text-slate-900">{formatCurrency(ahorro.totalAportes)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Rendimientos</p>
                              <p className="font-semibold text-emerald-600">{formatCurrency(ahorro.rendimientos)}</p>
                            </div>
                            {ahorro.aporteObligatorio > 0 && (
                              <div>
                                <p className="text-xs text-slate-500">Aporte Obligatorio</p>
                                <p className="font-semibold text-slate-900">{formatCurrency(ahorro.aporteObligatorio)}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-slate-500">Último Aporte</p>
                              <p className="font-semibold text-slate-900">{formatDate(ahorro.ultimoAporte)}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Calendar className="size-4" />
                              <span>Apertura: {formatDate(ahorro.fechaApertura)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <TrendingUp className="size-4 text-emerald-600" />
                              <span className="text-sm text-emerald-600 font-semibold">
                                +{ahorro.totalAportes > 0
                                  ? ((ahorro.rendimientos / ahorro.totalAportes) * 100).toFixed(2)
                                  : '0.00'}% rendimiento
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {ahorros.length === 0 && (
                    <div className="text-center py-12">
                      <div className="flex justify-center mb-4">
                        <div className="p-4 bg-slate-100 rounded-2xl">
                          <DollarSign className="size-12 text-slate-400" />
                        </div>
                      </div>
                      <p className="text-slate-600">No tienes cuentas de ahorro</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Mis Pedidos */}
          <TabsContent value="pedidos" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-purple-100 rounded-2xl">
                    <ShoppingCart className="size-8 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle>Mis Pedidos</CardTitle>
                    <CardDescription>Historial de compras y estado de pedidos</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pedidos.map((pedido) => (
                    <Card key={pedido.id} className="border border-slate-200">
                      <CardContent className="p-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-slate-900">Pedido #{pedido.id}</h3>
                                {getEstadoBadge(pedido.estado)}
                              </div>
                              <p className="text-sm text-slate-600">Fecha: {formatDate(pedido.fechaPedido)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-600">Total</p>
                              <p className="text-2xl font-bold text-slate-900">{formatCurrency(pedido.total)}</p>
                            </div>
                          </div>

                          <div className="space-y-2 pt-4 border-t border-slate-200">
                            <p className="text-sm font-semibold text-slate-700">Productos:</p>
                            {pedido.productos.map((producto: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <Package className="size-4 text-slate-400" />
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">{producto.nombre}</p>
                                    <p className="text-xs text-slate-500">Cantidad: {producto.cantidad}</p>
                                  </div>
                                </div>
                                <p className="text-sm font-semibold text-slate-900">{formatCurrency(producto.precio)}</p>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                            <div className="flex items-center gap-2 text-sm">
                              <CreditCard className="size-4 text-slate-400" />
                              <span className="text-slate-600">Método de pago:</span>
                              <span className="font-semibold text-slate-900">{pedido.metodoPago}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              {pedido.estado === 'Entregado' ? (
                                <>
                                  <CheckCircle2 className="size-4 text-emerald-600" />
                                  <span className="text-slate-600">Entregado:</span>
                                  <span className="font-semibold text-slate-900">{formatDate(pedido.fechaEntrega)}</span>
                                </>
                              ) : (
                                <>
                                  <Clock className="size-4 text-yellow-600" />
                                  <span className="text-slate-600">Entrega estimada:</span>
                                  <span className="font-semibold text-slate-900">{formatDate(pedido.fechaEntrega)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {pedidos.length === 0 && (
                    <div className="text-center py-12">
                      <div className="flex justify-center mb-4">
                        <div className="p-4 bg-slate-100 rounded-2xl">
                          <ShoppingCart className="size-12 text-slate-400" />
                        </div>
                      </div>
                      <p className="text-slate-600">No tienes pedidos registrados</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Referidos */}
          <TabsContent value="referidos" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-orange-100 rounded-2xl">
                    <Users className="size-8 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle>Mis Referidos</CardTitle>
                    <CardDescription>Personas que has referido al sistema</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {referidos.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Cédula</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Fecha de Referido</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Bonificación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referidos.map((referido, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{referido.nombre}</TableCell>
                          <TableCell>{referido.cedula}</TableCell>
                          <TableCell>{referido.telefono}</TableCell>
                          <TableCell>{formatDate(referido.fechaReferido)}</TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              {referido.estadoReferido}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-emerald-600">
                            {formatCurrency(referido.bonificacion)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-12">
                    <div className="flex justify-center mb-4">
                      <div className="p-4 bg-slate-100 rounded-2xl">
                        <Users className="size-12 text-slate-400" />
                      </div>
                    </div>
                    <p className="text-slate-600 mb-2">No has referido a ninguna persona aún</p>
                    <p className="text-sm text-slate-500">¡Refiere a tus conocidos y gana bonificaciones!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}