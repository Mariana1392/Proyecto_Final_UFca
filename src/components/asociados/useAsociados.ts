import { useState, useEffect, useRef } from 'react';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { businessRules } from '../../services/businessRules';

export interface AsociadoMapped {
  id: string;
  nombre: string;
  cedula: string;
  telefono: string;
  email: string;
  direccion: string;
  fechaIngreso: string;
  estado: boolean;
  tieneCreditos: boolean;
  referidos: any[];
  ahorros: any[];
  creditos: any[];
  eventos: any[];
  totalAhorros: number;
  totalCreditos: number;
  historialAuditoria: any[];
  estadoAhorroPerm?: { estado: string; mensaje: string };
}

export function useAsociados() {
  const [asociados, setAsociados]               = useState<AsociadoMapped[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [usuarioActualId, setUsuarioActualId]   = useState<string | null>(null);
  const [usuarioActualNombre, setUsuarioActualNombre] = useState('Administrador');
  const asociadosRef = useRef<AsociadoMapped[]>([]);

  useEffect(() => { asociadosRef.current = asociados; }, [asociados]);
  useRealtimeSubscription('asociados_realtime', ['usuarios', 'cuentas_ahorro', 'creditos'], cargarAsociados);

  async function cargarAsociados() {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsuarioActualId(user.id);
        const { data: perfil } = await supabase
          .from('usuarios').select('nombre').eq('id', user.id).single();
        if (perfil?.nombre) setUsuarioActualNombre(perfil.nombre);
      }

      const { data: rolAsoc } = await supabase
        .from('roles').select('id').eq('nombre', 'asociado').limit(1).maybeSingle();
      const rolAsociadoId = rolAsoc?.id ?? null;

      let usuariosQuery = supabase
        .from('usuarios')
        .select(`
          id, nombre, cedula, telefono, email, direccion, fecha_ingreso,
          activo, estado_cuenta,
          creditos(id, monto, saldo, cuota_mensual, fecha_desembolso, plazo_meses, estado, anulado)
        `)
        .order('nombre');
      if (rolAsociadoId) {
        usuariosQuery = (usuariosQuery as any).eq('rol_id', rolAsociadoId);
      }

      const [{ data, error }, { data: todasCuentas }, { data: pagosPerm }] = await Promise.all([
        usuariosQuery,
        supabase
          .from('cuentas_ahorro')
          .select('id, tipo, monto_ahorrado, cuota_mensual, estado, anulado, asociado_id'),
        supabase
          .from('transacciones')
          .select('asociado_id, fecha_pago, created_at')
          .eq('tipo', 'aporte_permanente')
          .order('created_at', { ascending: false })
      ]);
      if (error) throw error;

      const cuentasPorAsociado = (todasCuentas || []).reduce((acc: any, c: any) => {
        if (!acc[c.asociado_id]) acc[c.asociado_id] = [];
        acc[c.asociado_id].push(c);
        return acc;
      }, {});

      // Extraer la fecha del último pago para cada asociado
      const ultimoPagoPorAsociado: Record<string, string | null> = {};
      (pagosPerm || []).forEach((p: any) => {
        // Como están ordenados desc, el primero que encontramos es el más reciente
        if (!ultimoPagoPorAsociado[p.asociado_id]) {
          ultimoPagoPorAsociado[p.asociado_id] = p.fecha_pago;
        }
      });

      const mapeados: AsociadoMapped[] = (data || []).map((a: any) => {
        const cuentas = cuentasPorAsociado[a.id] || [];
        const ultimoPago = ultimoPagoPorAsociado[a.id] || null;
        return {
          id:           a.id,
          nombre:       a.nombre || '',
          cedula:       a.cedula || '',
          telefono:     a.telefono || '',
          email:        a.email || '',
          direccion:    a.direccion || '',
          fechaIngreso: a.fecha_ingreso || '',
          estado:       a.activo === true || a.estado_cuenta === 'activo',
          tieneCreditos: (a.creditos || []).some((c: any) => !c.anulado && c.saldo > 0),
          referidos: [],
          ahorros: cuentas.map((ah: any) => ({
            id:           ah.id,
            tipo:         ah.tipo === 'permanente' ? 'Ahorro Permanente' : 'Ahorro Voluntario',
            monto:        ah.monto_ahorrado,
            saldo:        ah.monto_ahorrado,
            cuotaMensual: ah.cuota_mensual ?? null,
            estado:       ah.anulado ? 'Anulado' : (ah.estado === 'activo' ? 'Activo' : 'Inactivo'),
          })),
          creditos: (a.creditos || []).map((c: any) => ({
            id:             c.id,
            tipo:           'Crédito',
            monto:          c.monto,
            saldo:          c.saldo,
            saldoPendiente: c.saldo,
            cuota:          c.cuota_mensual,
            fechaDesembolso: c.fecha_desembolso,
            plazo:          `${c.plazo_meses} meses`,
            estado:         c.anulado ? 'Anulado' : (c.estado ? 'Activo' : 'Inactivo'),
          })),
          eventos:            [],
          totalAhorros:       cuentas.reduce((sum: number, ah: any) => sum + (ah.monto_ahorrado || 0), 0),
          totalCreditos:      (a.creditos || [])
                                .filter((c: any) => !c.anulado)
                                .reduce((sum: number, c: any) => sum + (c.saldo || 0), 0),
          historialAuditoria: [],
          estadoAhorroPerm:   businessRules.calcularEstadoAhorroPermanente(ultimoPago),
        };
      });

      setAsociados(mapeados);
      return mapeados; // para pasar snapshot a auditoría
    } catch (error: any) {
      if (error?.message?.includes('Lock') || error?.message?.includes('lock')) {
        console.warn('Auth lock transitorio, reintentando...', error.message);
        setTimeout(() => cargarAsociados(), 800);
        return [];
      }
      toast.error('Error al cargar asociados: ' + error.message);
      return [];
    } finally {
      setLoading(false);
    }
  }

  return {
    asociados,
    setAsociados,
    asociadosRef,
    loading,
    usuarioActualId,
    usuarioActualNombre,
    cargarAsociados,
  };
}
