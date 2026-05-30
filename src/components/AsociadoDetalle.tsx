import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import {
  ArrowLeft, User, Mail, Phone, MapPin, Calendar,
  PiggyBank, CreditCard, TrendingUp, FileText, Edit, Trash2, Users
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import { toast } from 'sonner';

// ── Supabase ──────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';

interface AsociadoDetalleProps {
  asociadoId: string | null;
  onBack: () => void;
}

export default function AsociadoDetalle({ asociadoId, onBack }: AsociadoDetalleProps) {
  const [asociado, setAsociado]               = useState<any>(null);
  const [referidos, setReferidos]             = useState<any[]>([]);
  const [movimientosAhorros, setMovimientosAhorros] = useState<any[]>([]);
  const [movimientosCreditos, setMovimientosCreditos] = useState<any[]>([]);
  const [loading, setLoading]                 = useState(true);

  useEffect(() => {
    if (asociadoId) cargarDetalle(asociadoId);
  }, [asociadoId]);

  async function cargarDetalle(id: string) {
    try {
      setLoading(true);

      // Tras la migración, los asociados viven en la tabla usuarios.
      // Los referidos se identifican por referido_por_id en usuarios.
      const [{ data, error }, { data: cfgData }, { data: cuentasAhorro }, { data: referidosData }, { data: creditosData }] = await Promise.all([
        supabase
          .from('usuarios')
          .select('id, nombre, cedula, telefono, email, direccion, fecha_ingreso, activo, estado_cuenta')
          .eq('id', id)
          .single(),
        supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', 'bonificacion_referido')
          .maybeSingle(),
        supabase
          .from('cuentas_ahorro')
          .select('id, tipo, monto_ahorrado, cuota_mensual, estado, anulado')
          .eq('asociado_id', id)
          .eq('anulado', false),
        supabase
          .from('usuarios')
          .select('id, nombre, cedula, telefono, fecha_ingreso, activo, estado_cuenta')
          .eq('referido_por_id', id)
          .order('fecha_ingreso', { ascending: false }),
        supabase
          .from('creditos')
          .select('id, monto, saldo, cuota_mensual, fecha_desembolso, plazo_meses, estado, anulado')
          .eq('asociado_id', id),
      ]);
      const bonif = cfgData?.valor ? Number(cfgData.valor) : 50_000; // Q-04

      if (error) throw error;

      const ahorroPerm  = (cuentasAhorro || []).filter((a: any) => a.tipo === 'permanente').reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
      const ahorroVol   = (cuentasAhorro || []).filter((a: any) => a.tipo === 'voluntario').reduce((s: number, a: any) => s + (a.monto_ahorrado || 0), 0);
      const creditoActivo = (creditosData || []).find((c: any) => !c.anulado && c.estado);

      setAsociado({
        id:                   data.id,
        nombre:               data.nombre,
        cedula:               data.cedula,
        telefono:             data.telefono || '',
        email:                data.email || '',
        direccion:            data.direccion || '',
        fechaIngreso:         data.fecha_ingreso,
        estado:               (data.activo === true || data.estado_cuenta === 'activo') ? 'Activo' : 'Inactivo',
        ahorrosPermanentes:   ahorroPerm,
        ahorrosVoluntarios:   ahorroVol,
        creditoActivo:        !!creditoActivo,
        montoCredito:         creditoActivo?.monto || 0,
        saldoCredito:         creditoActivo?.saldo || 0,
      });

      // Referidos (usuarios que tienen referido_por_id = este asociado)
      setReferidos((referidosData || []).map((r: any) => ({
        nombre:        r.nombre,
        cedula:        r.cedula,
        telefono:      r.telefono || '',
        fechaReferido: r.fecha_ingreso,
        estadoReferido: (r.activo === true || r.estado_cuenta === 'activo') ? 'Aprobado' : 'Inactivo',
        bonificacion:  bonif,
      })));

      // Movimientos ahorros
      const movAh = (cuentasAhorro || []).map((a: any) => ({
        id:       a.id,
        fecha:    a.created_at || '',
        tipo:     'Depósito',
        concepto: a.tipo === 'permanente' ? 'Ahorro permanente' : 'Ahorro voluntario',
        monto:    a.monto_ahorrado,
      })).sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 5);
      setMovimientosAhorros(movAh);

      // Movimientos créditos
      const movCr = (creditosData || []).map((c: any, i: number) => ({
        id:       i + 1,
        fecha:    c.fecha_desembolso,
        concepto: c.anulado ? 'Crédito anulado' : 'Desembolso crédito',
        monto:    c.monto,
        saldo:    c.saldo,
      }));
      setMovimientosCreditos(movCr);

    } catch (err: any) {
      toast.error('Error al cargar detalles: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando detalles del asociado...</p>
        </div>
      </div>
    );
  }

  if (!asociado) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-slate-500 mb-4">No se encontró información del asociado.</p>
          <Button onClick={onBack} variant="outline">Volver</Button>
        </div>
      </div>
    );
  }

  // ── JSX original desde aquí (sin cambios) ────────────────────────────────
  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={onBack}>
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-slate-900 mb-1">Detalles del Asociado</h1>
              <p className="text-slate-600">Información completa y movimientos</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => alert('Función de edición disponible próximamente')}>
              <Edit className="size-4" />
              Editar
            </Button>
            <Button variant="outline" className="gap-2 text-red-600 hover:text-red-700" onClick={() => {
              if (window.confirm('¿Estás seguro de que deseas eliminar este asociado?')) {
                alert('Asociado eliminado exitosamente');
                onBack();
              }
            }}>
              <Trash2 className="size-4" />
              Eliminar
            </Button>
          </div>
        </div>

        {/* Personal Info */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Información Personal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="size-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Nombre completo</p>
                      <p className="text-slate-900">{asociado.nombre}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText className="size-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Cédula</p>
                      <p className="text-slate-900">{asociado.cedula}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Calendar className="size-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Fecha de ingreso</p>
                      <p className="text-slate-900">{formatDate(asociado.fechaIngreso)}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Phone className="size-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Teléfono</p>
                      <p className="text-slate-900">{asociado.telefono}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="size-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Correo electrónico</p>
                      <p className="text-slate-900">{asociado.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="size-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Dirección</p>
                      <p className="text-slate-900">{asociado.direccion}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">Estado actual</p>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                  {asociado.estado}
                </Badge>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-slate-600 mb-2">Crédito activo</p>
                <Badge variant={asociado.creditoActivo ? "default" : "secondary"}>
                  {asociado.creditoActivo ? 'Sí' : 'No'}
                </Badge>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-slate-600 mb-2">Total ahorrado</p>
                <p className="text-slate-900">
                  {formatCurrency(asociado.ahorrosPermanentes + asociado.ahorrosVoluntarios)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <PiggyBank className="size-6 text-emerald-600" />
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-1">Ahorros permanentes</p>
              <p className="text-slate-900 mb-2">{formatCurrency(asociado.ahorrosPermanentes)}</p>
              <Button variant="link" className="p-0 h-auto text-sm">Ver movimientos</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <TrendingUp className="size-6 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-1">Ahorros voluntarios</p>
              <p className="text-slate-900 mb-2">{formatCurrency(asociado.ahorrosVoluntarios)}</p>
              <Button variant="link" className="p-0 h-auto text-sm">Ver movimientos</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <CreditCard className="size-6 text-purple-600" />
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-1">Saldo crédito activo</p>
              <p className="text-slate-900 mb-2">{formatCurrency(asociado.saldoCredito)}</p>
              <Button variant="link" className="p-0 h-auto text-sm">Ver detalles</Button>
            </CardContent>
          </Card>
        </div>

        {/* Movement Tables */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Movimientos de Ahorros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientosAhorros.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-slate-600">{mov.fecha}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-slate-900 text-sm">{mov.concepto}</p>
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {mov.tipo}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className={`text-right ${mov.monto > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(mov.monto)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Movimientos de Créditos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientosCreditos.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell className="text-slate-600">{mov.fecha}</TableCell>
                        <TableCell>
                          <p className="text-slate-900 text-sm">{mov.concepto}</p>
                          <p className={`text-xs ${mov.monto > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrency(mov.monto)}
                          </p>
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatCurrency(mov.saldo)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referidos */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Referidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Cédula</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Fecha Referido</TableHead>
                      <TableHead>Estado Referido</TableHead>
                      <TableHead>Bonificación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referidos.map((ref) => (
                      <TableRow key={ref.cedula}>
                        <TableCell className="text-slate-600">{ref.nombre}</TableCell>
                        <TableCell className="text-slate-600">{ref.cedula}</TableCell>
                        <TableCell className="text-slate-600">{ref.telefono}</TableCell>
                        <TableCell className="text-slate-600">{formatDate(ref.fechaReferido)}</TableCell>
                        <TableCell className="text-slate-600">
                          <Badge variant={ref.estadoReferido === 'Aprobado' ? "default" : "secondary"}>
                            {ref.estadoReferido}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-900">
                          {formatCurrency(ref.bonificacion)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}