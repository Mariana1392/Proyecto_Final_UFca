/**
 * Componente de Notificaciones y Alertas — Supabase
 * Lee tanto de `excepciones` como de `notificaciones`
 * Al hacer clic navega automáticamente al módulo correspondiente.
 */
import { useState, useEffect } from 'react';
import {
  Bell, X, CheckCheck, AlertTriangle, Info, Edit, Ban,
  UserPlus, CreditCard, FileText, ArrowRight,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

interface Notif {
  _id:      string;
  titulo:   string;
  mensaje:  string;
  tipo:     string;
  leida:    boolean;
  createdAt: string;
  origen:   'excepciones' | 'notificaciones';
}

interface AlertasWidgetProps {
  userId:     string;
  userRole:   'admin' | 'asociado';
  asociadoId?: string | null;
  onNavigateToExcepciones?: () => void;
  onNavigate?: (view: string) => void;
}

// Mapa tipo → vista de navegación
const TIPO_VISTA: Record<string, string> = {
  solicitud_credito:   'creditos',
  credito_confirmado:  'creditos',
  credito_activo:      'creditos',
  credito_rechazado:   'creditos',
  simulacion:          'creditos',
  solicitud_afiliacion:'asociados',
  modificacion:        'creditos',
  anulacion:           'creditos',
  ahorro:              'ahorro-permanente',
  ahorro_voluntario:   'ahorro-voluntario',
};

export default function AlertasWidget({
  userId,
  userRole,
  asociadoId,
  onNavigateToExcepciones,
  onNavigate,
}: AlertasWidgetProps) {
  const [notifs, setNotifs]           = useState<Notif[]>([]);
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const noLeidas = notifs.filter(n => !n.leida).length;

  useEffect(() => {
    cargarTodas();

    const ch1 = supabase
      .channel('alertas-excepciones')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'excepciones' }, cargarTodas)
      .subscribe();

    const ch2 = supabase
      .channel('alertas-notificaciones')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificaciones' }, cargarTodas)
      .subscribe();

    const interval = setInterval(cargarTodas, 30000);
    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      clearInterval(interval);
    };
  }, [userId, asociadoId]);

  async function cargarTodas() {
    try {
      const promises: Promise<Notif[]>[] = [];

      // ── 1. Excepciones ───────────────────────────────────────────────────
      promises.push(
        (async () => {
          let q = supabase
            .from('excepciones')
            .select('id, tipo, descripcion, estado, created_at, asociado_id')
            .order('created_at', { ascending: false })
            .limit(10);
          if (userRole === 'asociado' && userId) q = q.eq('asociado_id', userId);
          const { data } = await q;
          return (data || []).map(e => ({
            _id:      e.id,
            titulo:   e.tipo,
            mensaje:  e.descripcion,
            tipo:     'excepcion',
            leida:    e.estado !== 'pendiente',
            createdAt: e.created_at,
            origen:   'excepciones' as const,
          }));
        })()
      );

      // ── 2. Notificaciones para asociados ─────────────────────────────────
      if (asociadoId) {
        promises.push(
          (async () => {
            const { data } = await supabase
              .from('notificaciones')
              .select('id, titulo, mensaje, tipo, leida, created_at')
              .eq('asociado_id', asociadoId)
              .order('created_at', { ascending: false })
              .limit(20);
            return (data || []).map(n => ({
              _id:      n.id,
              titulo:   n.titulo,
              mensaje:  n.mensaje,
              tipo:     n.tipo || 'info',
              leida:    n.leida ?? false,
              createdAt: n.created_at,
              origen:   'notificaciones' as const,
            }));
          })()
        );
      }

      // ── 3. Notificaciones para admin ──────────────────────────────────────
      if (userRole === 'admin') {
        promises.push(
          (async () => {
            const { data } = await supabase
              .from('notificaciones')
              .select('id, titulo, mensaje, tipo, leida, created_at')
              .eq('para_admin', true)
              .order('created_at', { ascending: false })
              .limit(30);
            return (data || []).map(n => ({
              _id:      n.id,
              titulo:   n.titulo,
              mensaje:  n.mensaje,
              tipo:     n.tipo || 'info',
              leida:    n.leida ?? false,
              createdAt: n.created_at,
              origen:   'notificaciones' as const,
            }));
          })()
        );
      }

      const resultados = await Promise.all(promises);
      const todas = resultados
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifs(todas);
    } catch (err: any) {
      console.error('Error cargando notificaciones:', err.message);
    }
  }

  const marcarComoLeida = async (notif: Notif) => {
    try {
      if (notif.origen === 'notificaciones') {
        await supabase.from('notificaciones').update({ leida: true }).eq('id', notif._id);
      } else {
        await supabase.from('auditoria').insert({
          tabla: 'excepciones',
          registro_id: notif._id,
          accion: 'ALERTA_LEIDA',
          detalle: 'Alerta marcada como leída desde el widget',
        });
      }
      setNotifs(prev => prev.map(n => n._id === notif._id ? { ...n, leida: true } : n));
    } catch (err: any) {
      console.error('Error marcando notificación:', err.message);
    }
  };

  const marcarTodasComoLeidas = async () => {
    try {
      await Promise.all(
        notifs.filter(n => !n.leida).map(n => {
          if (n.origen === 'notificaciones') {
            return supabase.from('notificaciones').update({ leida: true }).eq('id', n._id);
          }
          return supabase.from('auditoria').insert({
            tabla: 'excepciones', registro_id: n._id,
            accion: 'ALERTA_LEIDA', detalle: 'Marcada como leída (todas)',
          });
        })
      );
      setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
      toast.success('Todas las notificaciones han sido marcadas como leídas');
    } catch (err: any) {
      toast.error('Error al marcar notificaciones: ' + err.message);
    }
  };

  /** Navega al módulo correcto según el tipo de notificación */
  const handleClickNotif = async (n: Notif) => {
    await marcarComoLeida(n);
    setMostrarPanel(false);

    if (n.tipo === 'excepcion') {
      onNavigateToExcepciones?.();
      return;
    }
    const vista = TIPO_VISTA[n.tipo];
    if (vista && onNavigate) {
      onNavigate(vista);
    }
  };

  // ── Icono según tipo ──────────────────────────────────────────────────────
  const getIcono = (tipo: string) => {
    switch (tipo) {
      case 'solicitud_credito':    return <FileText className="size-4 text-blue-600" />;
      case 'credito_confirmado':
      case 'credito_activo':       return <CreditCard className="size-4 text-emerald-600" />;
      case 'credito_rechazado':    return <Ban className="size-4 text-red-500" />;
      case 'simulacion':           return <CreditCard className="size-4 text-purple-600" />;
      case 'modificacion':         return <Edit className="size-4 text-purple-600" />;
      case 'anulacion':            return <Ban className="size-4 text-red-500" />;
      case 'excepcion':            return <AlertTriangle className="size-4 text-amber-500" />;
      case 'solicitud_afiliacion': return <UserPlus className="size-4 text-emerald-600" />;
      default:                     return <Info className="size-4 text-blue-500" />;
    }
  };

  // ── Borde / fondo según tipo ──────────────────────────────────────────────
  const getBorde = (tipo: string, leida: boolean) => {
    const op = leida ? 'opacity-60' : '';
    switch (tipo) {
      case 'solicitud_credito':    return `border-l-4 border-blue-500 bg-blue-50/60 ${op}`;
      case 'credito_confirmado':
      case 'credito_activo':       return `border-l-4 border-emerald-400 bg-emerald-50/60 ${op}`;
      case 'credito_rechazado':    return `border-l-4 border-red-400 bg-red-50/60 ${op}`;
      case 'simulacion':           return `border-l-4 border-purple-400 bg-purple-50/60 ${op}`;
      case 'modificacion':         return `border-l-4 border-purple-400 bg-purple-50/60 ${op}`;
      case 'anulacion':            return `border-l-4 border-red-400 bg-red-50/60 ${op}`;
      case 'excepcion':            return `border-l-4 border-amber-400 bg-amber-50/60 ${op}`;
      case 'solicitud_afiliacion': return `border-l-4 border-emerald-400 bg-emerald-50/60 ${op}`;
      default:                     return `border-l-4 border-blue-400 bg-blue-50/60 ${op}`;
    }
  };

  // ── Badge etiqueta ────────────────────────────────────────────────────────
  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'solicitud_credito':
        return <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">Solicitud crédito</Badge>;
      case 'credito_confirmado':
      case 'credito_activo':
        return <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">Crédito activo</Badge>;
      case 'credito_rechazado':
        return <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200">Rechazado</Badge>;
      case 'simulacion':
        return <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200">Simulación</Badge>;
      case 'modificacion':
        return <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-200">Modificación</Badge>;
      case 'anulacion':
        return <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200">Anulación</Badge>;
      case 'excepcion':
        return <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">Excepción</Badge>;
      case 'solicitud_afiliacion':
        return <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">Afiliación</Badge>;
      default:
        return <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">Info</Badge>;
    }
  };

  /** Devuelve la etiqueta del módulo destino para mostrar en la notificación */
  const getDestinoLabel = (tipo: string): string | null => {
    if (tipo === 'excepcion') return 'Ver excepciones';
    const vista = TIPO_VISTA[tipo];
    if (!vista) return null;
    const labels: Record<string, string> = {
      'creditos':          'Ir a Créditos',
      'asociados':         'Ir a Asociados',
      'ahorro-permanente': 'Ir a Ahorros',
      'ahorro-voluntario': 'Ir a Ahorros',
    };
    return labels[vista] ?? 'Ver más';
  };

  return (
    <div className="relative">
      {/* Campana */}
      <button
        onClick={() => setMostrarPanel(!mostrarPanel)}
        className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
        title="Notificaciones"
      >
        <Bell className="size-5 text-slate-600" />
        {noLeidas > 0 && (
          <span className="absolute top-1 right-1 size-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {/* Panel */}
      {mostrarPanel && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMostrarPanel(false)} />
          <div className="absolute right-0 top-12 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[600px] overflow-hidden flex flex-col">

            {/* Encabezado */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-semibold text-slate-900">Notificaciones</h3>
                <p className="text-xs text-slate-500">
                  {noLeidas > 0 ? `${noLeidas} sin leer` : 'Todo al día'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {noLeidas > 0 && (
                  <button
                    onClick={marcarTodasComoLeidas}
                    className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <CheckCheck className="size-3" /> Marcar todas
                  </button>
                )}
                <button onClick={() => setMostrarPanel(false)} className="p-1 hover:bg-slate-200 rounded">
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1">
              {notifs.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="size-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">Sin notificaciones</p>
                  <p className="text-xs text-slate-400 mt-1">Aquí aparecerán los avisos del sistema</p>
                </div>
              ) : (
                notifs.map((n) => {
                  const destinoLabel = getDestinoLabel(n.tipo);
                  const esNavegable  = !!(destinoLabel && (TIPO_VISTA[n.tipo] || n.tipo === 'excepcion'));
                  return (
                    <div
                      key={`${n.origen}-${n._id}`}
                      className={`p-3 border-b border-slate-100 transition-all ${getBorde(n.tipo, n.leida)} ${esNavegable ? 'cursor-pointer hover:brightness-95' : ''}`}
                      onClick={() => esNavegable && handleClickNotif(n)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">{getIcono(n.tipo)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="font-semibold text-sm text-slate-900 truncate">{n.titulo}</p>
                            {!n.leida && <div className="size-2 bg-blue-500 rounded-full shrink-0" />}
                          </div>
                          <p className="text-xs text-slate-600 mb-1.5 line-clamp-2 whitespace-pre-line">{n.mensaje}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-slate-400">
                              {new Date(n.createdAt).toLocaleString('es-CO', {
                                day: '2-digit', month: 'short',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                            <div className="flex items-center gap-1.5">
                              {getTipoBadge(n.tipo)}
                              {esNavegable && (
                                <span className="text-[10px] text-blue-500 flex items-center gap-0.5 font-medium">
                                  {destinoLabel} <ArrowRight className="size-2.5" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pie — solo admin con excepciones */}
            {userRole === 'admin' && notifs.some(n => n.tipo === 'excepcion') && (
              <div className="p-3 border-t border-slate-200 bg-slate-50">
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { onNavigateToExcepciones?.(); setMostrarPanel(false); }}
                  className="w-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                >
                  Ver todas las excepciones
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
