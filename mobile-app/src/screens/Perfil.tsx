import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  User, Mail, Phone, MapPin, Calendar, Edit, Save, X, CreditCard,
  DollarSign, CheckCircle2, AlertTriangle, PiggyBank, Landmark, LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/formatters';

export default function PerfilScreen() {
  const { userData, logout, userRole } = useAuth();
  const navigate = useNavigate();

  const [isEditing,   setIsEditing]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('info');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    nombre: '', cedula: '', email: '', telefono: '', direccion: '', fechaIngreso: '',
  });
  const [originalData, setOriginalData] = useState({ ...formData });
  const [asociadoId,   setAsociadoId]   = useState<string | null>(null);
  const [creditos,     setCreditos]     = useState<any[]>([]);
  const [ahorros,      setAhorros]      = useState<any[]>([]);

  useEffect(() => { if (userData?.id) cargar(userData.id); else setLoading(false); }, [userData]);

  async function cargar(userId: string) {
    try {
      setLoading(true);
      const { data: base } = await supabase
        .from('usuarios')
        .select('id,nombre,email,cedula,telefono,direccion,fecha_ingreso,estado_cuenta')
        .eq('id', userId).single();
      if (!base) return;

      const [{ data: ahPerm }, { data: ahVol }, { data: creds }] = await Promise.all([
        supabase.from('cuentas_ahorro').select('id,tipo,monto_ahorrado,cuota_mensual,estado,anulado').eq('tipo','permanente').eq('asociado_id', base.id).eq('anulado',false).eq('estado','activo'),
        supabase.from('cuentas_ahorro').select('id,tipo,monto_ahorrado,estado,anulado').eq('tipo','voluntario').eq('asociado_id', base.id).eq('anulado',false).eq('estado','activo'),
        supabase.from('creditos').select('id,monto,saldo,cuota_mensual,fecha_desembolso,plazo_meses,estado,anulado,tasa_interes,estado_aprobacion').eq('asociado_id', base.id),
      ]);

      const mapped = {
        nombre:       base.nombre       || '',
        cedula:       base.cedula       || '',
        email:        base.email        || '',
        telefono:     (base as any).telefono  || '',
        direccion:    (base as any).direccion || '',
        fechaIngreso: (base as any).fecha_ingreso || '',
      };
      setFormData(mapped);
      setOriginalData(mapped);
      setAsociadoId(base.id);

      setCreditos((creds || []).map((c: any) => ({
        id:              `CRE-${c.id.slice(0, 6).toUpperCase()}`,
        monto:           c.monto,
        saldoPendiente:  c.saldo,
        cuotaMensual:    c.cuota_mensual,
        plazo:           c.plazo_meses,
        cuotasPagadas:   Math.round((c.monto - c.saldo) / (c.cuota_mensual || 1)),
        tasaInteres:     c.tasa_interes ?? 0,
        fechaDesembolso: c.fecha_desembolso,
        estado:          c.anulado ? 'Anulado' : c.estado === 'pagado' ? 'Liquidado' : 'Activo',
        estadoAprobacion: c.estado_aprobacion,
      })));

      setAhorros([
        ...(ahPerm || []).map((a: any) => ({
          id:    `AHP-${a.id.slice(0, 6).toUpperCase()}`,
          tipo:  'Ahorro Permanente',
          saldo: a.monto_ahorrado,
          cuota: a.cuota_mensual,
          estado: a.estado === 'activo' ? 'Activo' : 'Inactivo',
        })),
        ...(ahVol || []).map((a: any) => ({
          id:    `AHV-${a.id.slice(0, 6).toUpperCase()}`,
          tipo:  'Ahorro Voluntario',
          saldo: a.monto_ahorrado,
          cuota: 0,
          estado: a.estado === 'activo' ? 'Activo' : 'Inactivo',
        })),
      ]);
    } catch (err: any) {
      toast.error('Error al cargar perfil: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function validarCampo(name: string, value: string) {
    let error = '';
    if (name === 'email') {
      if (!value.trim()) error = 'El correo es obligatorio';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) error = 'Formato no válido';
    }
    if (name === 'telefono') {
      if (!value.trim()) error = 'El teléfono es obligatorio';
      else if (!/^\d{7,15}$/.test(value.trim().replace(/[\s\-()+]/g, ''))) error = 'Debe tener 7-15 dígitos';
    }
    setFieldErrors(prev => ({ ...prev, [name]: error }));
    return error;
  }

  async function handleSave() {
    if (validarCampo('email', formData.email) || validarCampo('telefono', formData.telefono)) return;
    setSaving(true);
    try {
      const userId = asociadoId || userData?.id;
      if (!userId) { toast.error('No se pudo identificar el usuario'); return; }
      const { error } = await supabase.from('usuarios').update({
        email: formData.email.trim(), telefono: formData.telefono.trim(), direccion: formData.direccion.trim(),
      }).eq('id', userId);
      if (error) throw error;
      if (formData.email.trim() !== originalData.email) {
        try { await supabase.auth.updateUser({ email: formData.email.trim() }); } catch {}
      }
      setOriginalData({ ...formData });
      toast.success('✅ Perfil actualizado exitosamente');
      setIsEditing(false);
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const handleSignOut = async () => { await logout(); navigate('/login'); };
  const totalAhorros    = ahorros.reduce((s, a) => s + (a.saldo || 0), 0);
  const creditosActivos = creditos.filter(c => c.estado === 'Activo').length;
  const perfilIncompleto = !isEditing && (!formData.telefono.trim() || !formData.direccion.trim());
  const fmtDate = (d: string) => !d ? '—' : new Date(d).toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      {/* Banner perfil */}
      <Card className="overflow-hidden border-0 shadow-md">
        <div className="h-16 bg-gradient-to-r from-emerald-600 to-teal-500" />
        <CardContent className="px-4 pb-4">
          <div className="flex items-end justify-between -mt-8 gap-3">
            <div className="flex items-end gap-3">
              <div className="size-16 rounded-2xl bg-white border-4 border-white shadow-lg flex items-center justify-center shrink-0">
                <User className="size-8 text-emerald-600" />
              </div>
              <div className="mb-1">
                <h2 className="text-base font-bold text-foreground">{formData.nombre}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
                    <CheckCircle2 className="size-3 mr-1" />
                    {userRole === 'admin' ? 'Administrador' : 'Asociado activo'}
                  </Badge>
                </div>
              </div>
            </div>
            {!isEditing
              ? <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 shrink-0" onClick={() => setIsEditing(true)}>
                  <Edit className="size-3.5" /> Editar
                </Button>
              : <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => { setFormData({...originalData}); setIsEditing(false); }} disabled={saving}>
                    <X className="size-3.5" />
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
                    {saving ? '...' : <><Save className="size-3.5" /> Guardar</>}
                  </Button>
                </div>
            }
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Ahorros totales',   value: formatCurrency(totalAhorros), sub: `${ahorros.length} cuenta(s)`, icon: PiggyBank, bg: 'bg-emerald-100', text: 'text-emerald-600' },
          { label: 'Créditos activos',  value: String(creditosActivos),      sub: `${creditos.length} en total`,  icon: Landmark,  bg: 'bg-blue-100',    text: 'text-blue-600'    },
        ].map(({ label, value, sub, icon: Icon, bg, text }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-2`}>
                <Icon className={`size-5 ${text}`} />
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className={`text-lg font-bold mt-0.5 ${text}`}>{value}</p>
              <p className="text-[10px] text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info" className="gap-1 text-xs"><User className="size-3" /> Info</TabsTrigger>
          <TabsTrigger value="creditos" className="gap-1 text-xs"><CreditCard className="size-3" /> Créditos</TabsTrigger>
          <TabsTrigger value="ahorros"  className="gap-1 text-xs"><DollarSign className="size-3" /> Ahorros</TabsTrigger>
        </TabsList>

        {/* TAB info */}
        <TabsContent value="info" className="mt-3">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Datos personales</CardTitle>
              <CardDescription className="text-xs">
                {isEditing ? 'Puedes editar correo, teléfono y dirección.' : 'Tu información en la cooperativa.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {perfilIncompleto && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-amber-800 font-medium">Perfil incompleto</p>
                    <button className="text-xs text-amber-800 underline" onClick={() => setIsEditing(true)}>Completar ahora →</button>
                  </div>
                </div>
              )}

              {/* Nombre */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex gap-1">Nombre completo <span className="text-muted-foreground/60">(🔒 No editable)</span></Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input value={formData.nombre} disabled className="pl-10 bg-muted/50" />
                </div>
              </div>

              {/* Cédula */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex gap-1">Cédula <span className="text-muted-foreground/60">(🔒 No editable)</span></Label>
                <Input value={formData.cedula} disabled className="bg-muted/50" />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Correo {isEditing && <span className="text-emerald-600">(✅ Editable)</span>}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={e => { setFormData({ ...formData, email: e.target.value }); if (fieldErrors.email) validarCampo('email', e.target.value); }}
                    onBlur={e => isEditing && validarCampo('email', e.target.value)}
                    disabled={!isEditing}
                    className={`pl-10 ${isEditing ? (fieldErrors.email ? 'border-red-400' : 'border-emerald-300') : ''}`}
                  />
                </div>
                {fieldErrors.email && isEditing && <p className="text-xs text-red-500">{fieldErrors.email}</p>}
              </div>

              {/* Teléfono */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Teléfono {isEditing && <span className="text-emerald-600">(✅ Editable)</span>}</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={formData.telefono}
                    onChange={e => { setFormData({ ...formData, telefono: e.target.value }); if (fieldErrors.telefono) validarCampo('telefono', e.target.value); }}
                    onBlur={e => isEditing && validarCampo('telefono', e.target.value)}
                    disabled={!isEditing}
                    className={`pl-10 ${isEditing ? (fieldErrors.telefono ? 'border-red-400' : 'border-emerald-300') : ''}`}
                  />
                </div>
                {fieldErrors.telefono && isEditing && <p className="text-xs text-red-500">{fieldErrors.telefono}</p>}
              </div>

              {/* Dirección */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dirección {isEditing && <span className="text-emerald-600">(✅ Editable)</span>}</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    value={formData.direccion}
                    onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                    disabled={!isEditing}
                    className={`pl-10 ${isEditing ? 'border-emerald-300' : ''}`}
                  />
                </div>
              </div>

              {/* Fecha ingreso */}
              {formData.fechaIngreso && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fecha de ingreso</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input value={formData.fechaIngreso} disabled className="pl-10 bg-muted/50" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB créditos */}
        <TabsContent value="creditos" className="mt-3 space-y-3">
          {creditos.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <CreditCard className="size-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No tienes créditos registrados</p>
              </CardContent>
            </Card>
          ) : creditos.map(c => {
            const progreso = Math.min((c.cuotasPagadas / c.plazo) * 100, 100);
            return (
              <Card key={c.id} className="border-0 shadow-sm overflow-hidden">
                <div className={`h-1 ${c.estado === 'Activo' ? 'bg-blue-500' : c.estado === 'Liquidado' ? 'bg-emerald-500' : 'bg-muted'}`} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">{c.id}</p>
                      <Badge className={`text-xs mt-0.5 ${c.estado === 'Activo' ? 'bg-blue-100 text-blue-700' : c.estado === 'Liquidado' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                        {c.estado}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Saldo</p>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(c.saldoPendiente)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { l: 'Monto original', v: formatCurrency(c.monto) },
                      { l: 'Cuota mensual',  v: formatCurrency(c.cuotaMensual) },
                      { l: 'Tasa interés',   v: `${c.tasaInteres}%` },
                      { l: 'Plazo',          v: `${c.plazo} meses` },
                    ].map(({ l, v }) => (
                      <div key={l} className="p-2 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground text-[10px]">{l}</p>
                        <p className="font-semibold">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Progreso</span>
                      <span>{c.cuotasPagadas} de {c.plazo} cuotas</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progreso}%` }} />
                    </div>
                  </div>
                  {c.fechaDesembolso && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3" /> Desembolso: {fmtDate(c.fechaDesembolso)}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* TAB ahorros */}
        <TabsContent value="ahorros" className="mt-3 space-y-3">
          {ahorros.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <PiggyBank className="size-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Sin ahorros activos</p>
              </CardContent>
            </Card>
          ) : ahorros.map(a => (
            <Card key={a.id} className="border-0 shadow-sm overflow-hidden">
              <div className="h-1 bg-emerald-500" />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{a.tipo}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">{a.id}</p>
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs mt-0.5">{a.estado}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Saldo acumulado</p>
                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(a.saldo)}</p>
                  </div>
                </div>
                {a.cuota > 0 && (
                  <p className="text-xs text-muted-foreground">Cuota mensual: <span className="font-semibold">{formatCurrency(a.cuota)}</span></p>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Cerrar sesión */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <Button variant="destructive" className="w-full gap-2" onClick={handleSignOut}>
            <LogOut className="size-4" /> Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
