/**
 * Componente de Gestión de Excepciones Administrativas — migrado a Supabase
 */
import { useState, useEffect } from 'react';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { AlertTriangle, CheckCircle, XCircle, Clock, Eye, FileText, Calendar, User, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

import { supabase } from '../lib/supabase';
import type { UserRole } from '../contexts/AuthContext';

// Tipo local que reemplaza ExcepcionAdministrativa del exceptionService
interface Excepcion {
  _id: string;
  tipo: string;
  descripcion: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  impacto: 'critico' | 'alto' | 'medio' | 'bajo';
  descripcionRegla: string;
  reglaViolada: string;
  motivo: string;
  entidad: string;
  datosRelevantes: Record<string, any>;
  fechaSolicitud: string;
  decision?: string;
  observacionesAdmin?: string;
  asociado_id?: string;
  resuelto_por?: string;
}

interface ExcepcionesManagerProps {
  userRole: UserRole;
  userId: string;
}

/** Deriva el nivel de impacto a partir del tipo de excepción en lugar de hardcodearlo */
function getImpactoFromTipo(tipo: string): Excepcion['impacto'] {
  const mapa: Record<string, Excepcion['impacto']> = {
    // Crítico — comprometen directamente los créditos o la liquidez del fondo
    'credito_con_mora':              'critico',
    'retiro_con_deudas':             'critico',
    // Alto — operaciones que violan reglas financieras importantes
    'credito_asociado_inactivo':     'alto',
    'eliminacion_credito_con_pagos': 'alto',
    'pago_credito_no_desembolsado':  'alto',
    // Medio — operaciones que violan reglas operativas pero con menor riesgo
    'retiro_parcial':                'medio',
    'operacion_periodo_cerrado':     'medio',
    // Bajo — validaciones menores o de configuración
    'aporte_menor_minimo':           'bajo',
    'asociado_referido':             'bajo',
  };
  return mapa[tipo] ?? 'medio';
}

export default function ExcepcionesManager({ userRole, userId }: ExcepcionesManagerProps) {
  const [excepciones, setExcepciones]                     = useState<Excepcion[]>([]);
  const [conteos, setConteos]                             = useState({ pendiente: 0, aprobada: 0, rechazada: 0 });
  const [filtro, setFiltro]                               = useState<'pendiente'|'aprobada'|'rechazada'|'todas'>('pendiente');
  const [excepcionSeleccionada, setExcepcionSeleccionada] = useState<Excepcion | null>(null);
  const [observaciones, setObservaciones]                 = useState('');
  const [loading, setLoading]                             = useState(false);

  useEffect(() => { cargarExcepciones(); }, [filtro]);
  useEffect(() => { cargarConteos(); }, []);
  useRealtimeSubscription('excepciones_realtime', ['excepciones'], () => { cargarExcepciones(); cargarConteos(); });

  async function cargarConteos() {
    const estados = ['pendiente', 'aprobada', 'rechazada'] as const;
    const resultados = await Promise.all(
      estados.map(e =>
        supabase.from('excepciones').select('*', { count: 'exact', head: true }).eq('estado', e)
      )
    );
    setConteos({
      pendiente: resultados[0].count ?? 0,
      aprobada:  resultados[1].count ?? 0,
      rechazada: resultados[2].count ?? 0,
    });
  }

  async function cargarExcepciones() {
    try {
      let query = supabase
        .from('excepciones')
        .select('*')
        .order('created_at', { ascending: false });

      if (filtro !== 'todas') query = query.eq('estado', filtro);

      const { data: excRaw, error } = await query;
      if (error) throw error;

      // Join manual: usuarios por asociado_id
      const excIds = [...new Set((excRaw || []).map((r: any) => r.asociado_id).filter(Boolean))];
      const excUsrMap: Record<string, any> = {};
      if (excIds.length > 0) {
        const { data: excUsrs } = await supabase.from('usuarios').select('id, nombre, cedula').in('id', excIds);
        (excUsrs || []).forEach((u: any) => { excUsrMap[u.id] = u; });
      }
      const data = (excRaw || []).map((r: any) => ({ ...r, usuarios: excUsrMap[r.asociado_id] ?? null }));

      const mapeadas: Excepcion[] = (data || []).map((e: any) => ({
        _id:              e.id,
        tipo:             e.tipo,
        descripcion:      e.descripcion,
        estado:           e.estado,
        impacto:          getImpactoFromTipo(e.tipo),
        descripcionRegla: e.descripcion,
        reglaViolada:     e.tipo,
        motivo:           e.descripcion,
        entidad:          e.usuarios?.nombre ?? 'Sin nombre',
        datosRelevantes:  { cedula: e.usuarios?.cedula, asociado_id: e.asociado_id },
        fechaSolicitud:   e.created_at,
        decision:         e.estado !== 'pendiente' ? e.estado : undefined,
        observacionesAdmin: undefined,
        asociado_id:      e.asociado_id,
        resuelto_por:     e.resuelto_por,
      }));
      setExcepciones(mapeadas);
    } catch (err: any) {
      toast.error('Error al cargar excepciones: ' + err.message);
    }
  }

  const handleAprobar = async () => {
    if (!excepcionSeleccionada || !observaciones.trim()) {
      toast.error('Debes ingresar observaciones para aprobar la excepción');
      return;
    }
    setLoading(true);
    try {
      await supabase.from('excepciones')
        .update({ estado: 'aprobada', resuelto_por: userId })
        .eq('id', excepcionSeleccionada._id);

      await supabase.from('auditoria').insert({
        tabla: 'excepciones', registro_id: excepcionSeleccionada._id,
        accion: 'EXCEPCIÓN APROBADA',
        detalle: `Aprobada por admin. Observaciones: ${observaciones.trim()}`,
      });

      toast.success('Excepción aprobada exitosamente');
      setExcepcionSeleccionada(null);
      setObservaciones('');
      cargarExcepciones();
      cargarConteos();
    } catch (err: any) {
      toast.error('Error al aprobar excepción: ' + err.message);
    }
    setLoading(false);
  };

  const handleRechazar = async () => {
    if (!excepcionSeleccionada || !observaciones.trim()) {
      toast.error('Debes ingresar observaciones para rechazar la excepción');
      return;
    }
    setLoading(true);
    try {
      await supabase.from('excepciones')
        .update({ estado: 'rechazada', resuelto_por: userId })
        .eq('id', excepcionSeleccionada._id);

      await supabase.from('auditoria').insert({
        tabla: 'excepciones', registro_id: excepcionSeleccionada._id,
        accion: 'EXCEPCIÓN RECHAZADA',
        detalle: `Rechazada por admin. Observaciones: ${observaciones.trim()}`,
      });

      toast.success('Excepción rechazada exitosamente');
      setExcepcionSeleccionada(null);
      setObservaciones('');
      cargarExcepciones();
      cargarConteos();
    } catch (err: any) {
      toast.error('Error al rechazar excepción: ' + err.message);
    }
    setLoading(false);
  };

  const getImpactoColor = (impacto: Excepcion['impacto']) => {
    switch (impacto) {
      case 'critico': return 'bg-red-100 text-red-700 border-red-300';
      case 'alto':    return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'medio':   return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'bajo':    return 'bg-blue-100 text-blue-700 border-blue-300';
    }
  };

  const getEstadoColor = (estado: Excepcion['estado']) => {
    switch (estado) {
      case 'pendiente': return 'bg-amber-500';
      case 'aprobada':  return 'bg-emerald-500';
      case 'rechazada': return 'bg-red-500';
    }
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      'asociado_referido':               'Asociado Referido',
      'aporte_menor_minimo':             'Aporte Menor al Mínimo',
      'credito_con_mora':                'Crédito con Mora',
      'credito_asociado_inactivo':       'Crédito - Asociado Inactivo',
      'pago_credito_no_desembolsado':    'Pago a Crédito No Desembolsado',
      'retiro_con_deudas':               'Retiro con Deudas',
      'retiro_parcial':                  'Retiro Parcial',
      'operacion_periodo_cerrado':       'Operación en Periodo Cerrado',
      'eliminacion_credito_con_pagos':   'Eliminación de Crédito con Pagos',
    };
    return labels[tipo] || tipo;
  };

  if (userRole !== 'admin') {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <AlertCircle className="size-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-slate-600">Solo los administradores pueden gestionar excepciones.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Gestión de Excepciones Administrativas</h1>
          <p className="text-slate-600">Revisa y decide sobre las excepciones a las reglas de negocio del sistema</p>
        </div>

        <div className="flex gap-3 mb-6">
          {(['pendiente', 'aprobada', 'rechazada', 'todas'] as const).map(f => (
            <Button
              key={f}
              variant={filtro === f ? 'default' : 'outline'}
              onClick={() => setFiltro(f)}
              className={filtro === f ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              {f === 'pendiente' && <Clock className="size-4 mr-2" />}
              {f === 'aprobada'  && <CheckCircle className="size-4 mr-2" />}
              {f === 'rechazada' && <XCircle className="size-4 mr-2" />}
              {f === 'pendiente' ? `Pendientes (${conteos.pendiente})`
               : f === 'aprobada'  ? 'Aprobadas'
               : f === 'rechazada' ? 'Rechazadas'
               : 'Todas'}
            </Button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="font-semibold text-slate-900">Excepciones</h2>
            {excepciones.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="size-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No hay excepciones {filtro !== 'todas' ? filtro + 's' : ''}</p>
              </Card>
            ) : (
              excepciones.map((excepcion) => (
                <Card
                  key={excepcion._id}
                  className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                    excepcionSeleccionada?._id === excepcion._id ? 'border-2 border-emerald-500 shadow-lg' : ''
                  }`}
                  onClick={() => setExcepcionSeleccionada(excepcion)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className={getEstadoColor(excepcion.estado)}>{excepcion.estado}</Badge>
                      <Badge variant="outline" className={getImpactoColor(excepcion.impacto)}>{excepcion.impacto}</Badge>
                    </div>
                    <AlertTriangle className="size-5 text-amber-500" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">{getTipoLabel(excepcion.tipo)}</h3>
                  <p className="text-sm text-slate-600 mb-3 line-clamp-2">{excepcion.descripcionRegla}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(excepcion.fechaSolicitud).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="size-3" />
                      {excepcion.entidad}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <div className="lg:sticky lg:top-4">
            {excepcionSeleccionada ? (
              <Card className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-900">Detalles de Excepción</h2>
                  <Badge className={getEstadoColor(excepcionSeleccionada.estado)}>{excepcionSeleccionada.estado}</Badge>
                </div>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Tipo</label>
                    <p className="text-slate-900">{getTipoLabel(excepcionSeleccionada.tipo)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Regla Violada</label>
                    <p className="text-slate-900">{excepcionSeleccionada.reglaViolada}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Descripción</label>
                    <p className="text-slate-900">{excepcionSeleccionada.descripcionRegla}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Motivo de Solicitud</label>
                    <p className="text-slate-900">{excepcionSeleccionada.motivo}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Impacto</label>
                    <Badge variant="outline" className={getImpactoColor(excepcionSeleccionada.impacto)}>
                      {excepcionSeleccionada.impacto}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700">Datos Relevantes</label>
                    <pre className="text-xs bg-slate-50 p-3 rounded-lg overflow-auto max-h-40">
                      {JSON.stringify(excepcionSeleccionada.datosRelevantes, null, 2)}
                    </pre>
                  </div>
                  {excepcionSeleccionada.estado !== 'pendiente' && excepcionSeleccionada.decision && (
                    <div>
                      <label className="text-sm font-semibold text-slate-700">Decisión Tomada</label>
                      <p className="text-slate-900 capitalize">{excepcionSeleccionada.decision}</p>
                    </div>
                  )}
                </div>

                {excepcionSeleccionada.estado === 'pendiente' && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-semibold text-slate-700 mb-2 block">
                        Observaciones de la Decisión *
                      </label>
                      <Textarea
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        placeholder="Ingresa las observaciones que justifican tu decisión..."
                        className="min-h-24"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleAprobar}
                        disabled={loading || !observaciones.trim()}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle className="size-4 mr-2" />Aprobar Excepción
                      </Button>
                      <Button
                        onClick={handleRechazar}
                        disabled={loading || !observaciones.trim()}
                        variant="destructive"
                        className="flex-1"
                      >
                        <XCircle className="size-4 mr-2" />Rechazar Excepción
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <Eye className="size-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Selecciona una excepción para ver los detalles</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}