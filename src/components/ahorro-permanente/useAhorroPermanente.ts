// ── useAhorroPermanente.ts ────────────────────────────────────────────────────
// Orquestador del módulo. Gestiona el estado compartido y delega la lógica
// especializada a cuatro sub-hooks. El objeto devuelto es idéntico al original
// para que los sub-componentes no necesiten cambios.

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import { asociadosApi } from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';
import type { UserRole } from '../../contexts/AuthContext';

import { useAhorroPermanenteCRUD }        from './useAhorroPermanenteCRUD';
import { useAhorroPermanenteAportes }      from './useAhorroPermanenteAportes';
import { useAhorroPermanenteSolicitudes }  from './useAhorroPermanenteSolicitudes';
import { useAhorroPermanentePDF }          from './useAhorroPermanentePDF';

export function useAhorroPermanente(userRole?: UserRole | null, userData?: any) {

  // ── Estado compartido ──────────────────────────────────────────────────────
  const [ahorros,              setAhorros]              = useState<any[]>([]);
  const [asociadosDisponibles, setAsociadosDisponibles] = useState<any[]>([]);
  const [loading,              setLoading]              = useState(true);
  const [periodos,             setPeriodos]             = useState<any[]>([]);

  // ── Búsqueda / orden / paginación ──────────────────────────────────────────
  const [searchTerm,           setSearchTerm]           = useState('');
  const [currentPage,          setCurrentPage]          = useState(1);
  const [currentPageAnulados,  setCurrentPageAnulados]  = useState(1);
  const [sortBy,               setSortBy]               = useState<
    'default' | 'saldo-desc' | 'saldo-asc' | 'antiguedad-desc' | 'antiguedad-asc'
  >('default');
  const itemsPerPage = 10;

  // ── Ítem seleccionado (compartido entre todos los sub-hooks) ───────────────
  const [selectedItem,         setSelectedItem]         = useState<any>(null);

  // ── Monto obligatorio (fuente de verdad para CRUD, Aportes y Solicitudes) ─
  const [montoObligatorio,     setMontoObligatorio]     = useState<number>(50000);

  // ── Detalle / movimientos ──────────────────────────────────────────────────
  const [movimientosDetalle,   setMovimientosDetalle]   = useState<any[]>([]);
  const [loadingMovimientos,   setLoadingMovimientos]   = useState(false);
  const [isDetailDialogOpen,   setIsDetailDialogOpen]   = useState(false);

  // ── Auditoría desplegable ──────────────────────────────────────────────────
  const [expandedAhorroId,   setExpandedAhorroId]   = useState<string | null>(null);
  const [auditoriaPorAhorro, setAuditoriaPorAhorro] = useState<Record<string, any[]>>({});
  const [loadingAuditoria,   setLoadingAuditoria]   = useState<string | null>(null);
  const [historialCambios,   setHistorialCambios]   = useState<any[]>([]);
  const [historialCambiosGeneral, setHistorialCambiosGeneral] = useState<any[]>([]);

  // Función estable de invalidación (se pasa como param al CRUD sub-hook)
  const invalidarAuditoria = (ahorroId: string) =>
    setAuditoriaPorAhorro(prev => { const n = { ...prev }; delete n[ahorroId]; return n; });

  // ── Sub-hooks especializados ───────────────────────────────────────────────
  const crud = useAhorroPermanenteCRUD({
    setAhorros,
    asociadosDisponibles,
    selectedItem, setSelectedItem,
    montoObligatorio, setMontoObligatorio,
    invalidarAuditoria,
  });

  const aportes = useAhorroPermanenteAportes({
    setAhorros,
    selectedItem, setSelectedItem,
    periodos,
    montoObligatorio,
    setMovimientosDetalle,
  });

  const solicitudes = useAhorroPermanenteSolicitudes({
    setAhorros,
    montoObligatorio,
  });

  const pdf = useAhorroPermanentePDF({
    movimientosDetalle,
    setMovimientosDetalle,
  });

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => { cargarDatos(); }, []);

  // ── Tiempo real: recarga cuando cambian cuentas o transacciones ───────────
  useRealtimeSubscription(
    'realtime:ahorro-permanente',
    ['cuentas_ahorro', 'transacciones'],
    cargarDatos,
  );

  async function cargarDatos() {
    try {
      setLoading(true);
      const [ahorrosRes, asociadosData, configData, periodosData, auditRes] = await Promise.all([
        // Usar supabase normal con RLS políticas
        supabase
          .from('cuentas_ahorro')
          .select('*')
          .eq('tipo', 'permanente')
          .order('created_at', { ascending: false }),
        asociadosApi.getAll().catch(() => []),
        supabase
          .from('configuracion')
          .select('valor')
          .eq('clave', 'cuota_ahorro_permanente')
          .maybeSingle(),
        supabase
          .from('periodos')
          .select('id, nombre, estado, fecha_inicio, fecha_fin')
          .order('fecha_inicio', { ascending: false }),
        supabase
          .from('auditoria')
          .select('id, accion, operacion, datos_antes, datos_despues, usuario_id, registro_id, created_at')
          .eq('tabla', 'cuentas_ahorro')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (!periodosData.error && periodosData.data) {
        setPeriodos(periodosData.data);
      }
      if (ahorrosRes.error) throw ahorrosRes.error;

      // Join manual: usuarios por asociado_id
      const ahIds = [...new Set((ahorrosRes.data || []).map((r: any) => r.asociado_id).filter(Boolean))];
      const ahUsrMap: Record<string, any> = {};
      if (ahIds.length > 0) {
        const { data: ahUsrs } = await supabase.from('usuarios').select('id, nombre, cedula').in('id', ahIds);
        (ahUsrs || []).forEach((u: any) => { ahUsrMap[u.id] = u; });
      }
      const data = (ahorrosRes.data || []).map((r: any) => ({ ...r, usuarios: ahUsrMap[r.asociado_id] ?? null }));
      const error = null; // ya manejado arriba
      if (!configData.error && configData.data) {
        const monto = parseFloat(configData.data.valor);
        if (!isNaN(monto) && monto > 0) {
          setMontoObligatorio(monto);
          // useAhorroPermanenteCRUD sincroniza tempMontoObligatorio vía useEffect
        }
      }

      // ── Pagos del mes actual y cálculo de mora ─────────────────────────────
      // Siempre consultamos qué cuentas ya pagaron este mes:
      //   · Para advertir al admin si intenta registrar un segundo aporte.
      //   · Para calcular mora (si hoy >= 17 y no han pagado).
      // Mora: $2.000 COP × (diaHoy - 16) días desde el día 17.
      const MORA_DIARIA    = 2_000;
      const hoy            = new Date();
      const diaHoy         = hoy.getDate();
      const diasMoraGlobal = diaHoy >= 17 ? diaHoy - 16 : 0;
      const primerDiaMes   = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;

      const ahorrosConPagoEsteMes: Set<string> = new Set();
      const { data: pagos } = await supabase
        .from('transacciones')
        .select('ahorro_id')
        .eq('tipo', 'aporte_permanente')
        .eq('anulado', false)
        .gte('fecha_pago', primerDiaMes);
      (pagos || []).forEach((p: any) => ahorrosConPagoEsteMes.add(p.ahorro_id));

      const mapeados = (data || []).map((a: any) => {
        const activo         = a.estado === 'activo' && !a.anulado;
        const pagadoEsteMes  = ahorrosConPagoEsteMes.has(a.id);
        const enMora         = activo && diasMoraGlobal > 0 && !pagadoEsteMes;
        return {
          id:              a.id,
          asociado:        a.usuarios?.nombre  ?? 'Sin nombre',
          cedula:          a.usuarios?.cedula || '',
          asociado_id:     a.asociado_id,
          montoAhorrado:   Number(a.monto_ahorrado) || 0,
          cuotaMensual:    a.cuota_mensual,
          fechaInicio:     a.created_at
            ? (() => { const d = new Date(a.created_at); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()
            : '',
          estado:          activo,
          anulado:         a.anulado,
          motivoAnulacion: a.motivo_anulacion || '',
          fechaAnulacion: a.anulado && a.updated_at
            ? (() => { const d = new Date(a.updated_at); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()
            : '',
          observaciones:   a.observaciones || '',
          createdAt:       a.created_at,
          // Pago mes actual
          pagadoEsteMes,
          // Mora
          enMora,
          diasMora:  enMora ? diasMoraGlobal : 0,
          montoMora: enMora ? diasMoraGlobal * MORA_DIARIA : 0,
        };
      });

      setAhorros(mapeados);

      // Map para buscar el nombre del asociado por registro_id (cuenta_id)
      const ahorroMap: Record<string, any> = {};
      mapeados.forEach(a => {
        ahorroMap[a.id] = { asociado: a.asociado, cedula: a.cedula };
      });

      // Historial general de cambios
      const allAudits = auditRes.error ? [] : (auditRes.data || []);
      const audits = allAudits.filter((r: any) => {
        // Solo mostrar cambios de cuentas que existen en el listado cargado de ahorros permanentes
        return ahorroMap[r.registro_id] !== undefined;
      });

      if (audits.length > 0) {
        const userIds = [...new Set(audits.map((r: any) => r.usuario_id).filter(Boolean))];
        const usersMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: usrs } = await supabase
            .from('usuarios')
            .select('id, nombre')
            .in('id', userIds);
          (usrs || []).forEach((u: any) => { usersMap[u.id] = u.nombre; });
        }

        const histGeneral = audits.map((r: any) => {
          const ahorroInfo = ahorroMap[r.registro_id];
          const oldCuota = r.datos_antes?.cuota_mensual;
          const newCuota = r.datos_despues?.cuota_mensual;
          const oldSaldo = r.datos_antes?.monto_ahorrado;
          const newSaldo = r.datos_despues?.monto_ahorrado;
          const oldEstado = r.datos_antes?.estado;
          const newEstado = r.datos_despues?.estado;
          const oldAnulado = r.datos_antes?.anulado;
          const newAnulado = r.datos_despues?.anulado;

          let desc = r.datos_despues?.descripcion || '';
          if (!desc) {
            const cambios: string[] = [];
            if (oldCuota !== undefined && newCuota !== undefined && oldCuota !== newCuota) {
              cambios.push(`Cuota: ${formatCurrency(Number(oldCuota))} ➔ ${formatCurrency(Number(newCuota))}`);
            }
            if (oldSaldo !== undefined && newSaldo !== undefined && oldSaldo !== newSaldo) {
              cambios.push(`Saldo: ${formatCurrency(Number(oldSaldo))} ➔ ${formatCurrency(Number(newSaldo))}`);
            }
            if (oldEstado !== undefined && newEstado !== undefined && oldEstado !== newEstado) {
              cambios.push(`Estado: ${oldEstado} ➔ ${newEstado}`);
            }
            if (oldAnulado !== undefined && newAnulado !== undefined && oldAnulado !== newAnulado) {
              cambios.push(newAnulado ? 'Cuenta anulada' : 'Cuenta reactivada');
            }
            desc = cambios.length > 0 ? cambios.join(' · ') : `Modificación (${r.operacion || r.accion})`;
          }

          return {
            id: r.id,
            asociado: ahorroInfo?.asociado ?? 'Asociado desconocido',
            cedula: ahorroInfo?.cedula ?? '',
            accion: r.accion || r.operacion || 'MODIFICACION',
            usuario_nombre: usersMap[r.usuario_id] ?? 'Sistema/Administrador',
            fecha_cambio: r.created_at,
            detalle: desc,
          };
        });
        setHistorialCambiosGeneral(histGeneral);
      } else {
        setHistorialCambiosGeneral([]);
      }

      const idsConAhorro = new Set(
        mapeados.filter(a => a.estado === true && !a.anulado).map(a => a.asociado_id)
      );
      setAsociadosDisponibles(
        (asociadosData || []).filter((a: any) => !idsConAhorro.has(a.id))
      );
    } catch (err: any) {
      toast.error('Error al cargar ahorros: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Valores computados / filtros ───────────────────────────────────────────
  const ahorrosActivos = userRole === 'asociado'
    ? ahorros.filter(a => a.cedula === userData?.cedula && !a.anulado)
    : ahorros.filter(a => !a.anulado);

  const filteredAhorros = ahorrosActivos.filter(a => {
    const term = searchTerm.toLowerCase();
    return !term ||
      a.asociado.toLowerCase().includes(term) ||
      a.cedula.includes(searchTerm) ||
      a.id.toLowerCase().includes(term);
  });

  const sortAhorros = (list: any[]) => {
    const s = [...list];
    switch (sortBy) {
      case 'saldo-desc':      return s.sort((a, b) => b.montoAhorrado - a.montoAhorrado);
      case 'saldo-asc':       return s.sort((a, b) => a.montoAhorrado - b.montoAhorrado);
      case 'antiguedad-desc': return s.sort((a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime());
      case 'antiguedad-asc':  return s.sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime());
      default: return s;
    }
  };
  const sortedAhorros = sortAhorros(filteredAhorros);

  const ahorrosAnulados = userRole === 'asociado'
    ? ahorros.filter(a => a.cedula === userData?.cedula && a.anulado)
    : ahorros.filter(a => a.anulado);

  const filteredAhorrosAnulados = ahorrosAnulados.filter(a => {
    const term = searchTerm.toLowerCase();
    return !term || a.asociado.toLowerCase().includes(term) || a.cedula.includes(searchTerm);
  });

  const totalPages         = Math.ceil(sortedAhorros.length / itemsPerPage);
  const startIndex         = (currentPage - 1) * itemsPerPage;
  const endIndex           = startIndex + itemsPerPage;
  const currentAhorros     = sortedAhorros.slice(startIndex, endIndex);

  const totalPagesAnulados     = Math.ceil(filteredAhorrosAnulados.length / itemsPerPage);
  const startIndexAnulados     = (currentPageAnulados - 1) * itemsPerPage;
  const endIndexAnulados       = startIndexAnulados + itemsPerPage;
  const currentAhorrosAnulados = filteredAhorrosAnulados.slice(startIndexAnulados, endIndexAnulados);

  // ── Abrir detalle y cargar movimientos ────────────────────────────────────
  const handleOpenDetail = async (ahorro: any) => {
    setMovimientosDetalle([]);
    setHistorialCambios([]);
    setIsDetailDialogOpen(true);
    setLoadingMovimientos(true);
    try {
      // Cargar transacciones, saldo real y auditoría en paralelo con supabase normal
      const db = supabase;
      const [txRes, cuentaRes, auditoriaRes] = await Promise.all([
        db
          .from('transacciones')
          .select('*, periodos(nombre)')
          .eq('ahorro_id', ahorro.id)
          .eq('tipo', 'aporte_permanente')
          .order('fecha_pago', { ascending: false }),
        db
          .from('cuentas_ahorro')
          .select('monto_ahorrado')
          .eq('id', ahorro.id)
          .single(),
        db
          .from('auditoria')
          .select('id, accion, operacion, datos_antes, datos_despues, usuario_id, created_at')
          .eq('tabla', 'cuentas_ahorro')
          .eq('registro_id', ahorro.id)
          .order('created_at', { ascending: false }),
      ]);

      // Saldo más confiable: último saldo_despues → fallback monto_ahorrado del DB
      const movs = txRes.data ?? [];
      const ultimoMov = movs.filter((m: any) => !m.anulado)[0];
      const saldoReal = Number(
        cuentaRes.data?.monto_ahorrado ?? ultimoMov?.saldo_despues ?? ahorro.montoAhorrado
      ) || 0;

      const ahorroActualizado = { ...ahorro, montoAhorrado: saldoReal };
      setSelectedItem(ahorroActualizado);
      setMovimientosDetalle(movs);
      setAhorros(prev => prev.map(a =>
        a.id === ahorro.id ? { ...a, montoAhorrado: saldoReal } : a
      ));

      // Mapear historial de cambios
      const audits = auditoriaRes.data ?? [];
      if (audits.length > 0) {
        const userIds = [...new Set(audits.map((r: any) => r.usuario_id).filter(Boolean))];
        const usersMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: usrs } = await db.from('usuarios').select('id, nombre').in('id', userIds);
          (usrs || []).forEach((u: any) => { usersMap[u.id] = u.nombre; });
        }

        const hist = audits.map((r: any) => {
          const oldCuota = r.datos_antes?.cuota_mensual;
          const newCuota = r.datos_despues?.cuota_mensual;
          const oldSaldo = r.datos_antes?.monto_ahorrado;
          const newSaldo = r.datos_despues?.monto_ahorrado;
          const oldEstado = r.datos_antes?.estado;
          const newEstado = r.datos_despues?.estado;
          const oldAnulado = r.datos_antes?.anulado;
          const newAnulado = r.datos_despues?.anulado;

          let desc = r.datos_despues?.descripcion || '';
          if (!desc) {
            const cambios: string[] = [];
            if (oldCuota !== undefined && newCuota !== undefined && oldCuota !== newCuota) {
              cambios.push(`Cuota: ${formatCurrency(Number(oldCuota))} ➔ ${formatCurrency(Number(newCuota))}`);
            }
            if (oldSaldo !== undefined && newSaldo !== undefined && oldSaldo !== newSaldo) {
              cambios.push(`Saldo: ${formatCurrency(Number(oldSaldo))} ➔ ${formatCurrency(Number(newSaldo))}`);
            }
            if (oldEstado !== undefined && newEstado !== undefined && oldEstado !== newEstado) {
              cambios.push(`Estado: ${oldEstado} ➔ ${newEstado}`);
            }
            if (oldAnulado !== undefined && newAnulado !== undefined && oldAnulado !== newAnulado) {
              cambios.push(newAnulado ? 'Cuenta anulada' : 'Cuenta reactivada');
            }
            desc = cambios.length > 0 ? cambios.join(' · ') : `Modificación (${r.operacion || r.accion})`;
          }

          return {
            id: r.id,
            accion: r.accion || r.operacion || 'MODIFICACION',
            usuario_nombre: usersMap[r.usuario_id] ?? 'Sistema/Administrador',
            fecha_cambio: r.created_at,
            detalle: desc,
          };
        });
        setHistorialCambios(hist);
      } else {
        setHistorialCambios([]);
      }
    } catch { /* sin movimientos aún */ }
    setLoadingMovimientos(false);
  };

  const closeDetailDialog = () => {
    setIsDetailDialogOpen(false);
    setSelectedItem(null);
    setMovimientosDetalle([]);
    setHistorialCambios([]);
  };

  // ── Auditoría lazy ─────────────────────────────────────────────────────────
  const cargarAuditoria = async (ahorroId: string) => {
    if (expandedAhorroId === ahorroId) { setExpandedAhorroId(null); return; }
    if (auditoriaPorAhorro[ahorroId])  { setExpandedAhorroId(ahorroId); return; }
    setLoadingAuditoria(ahorroId);
    const { data } = await supabase
      .from('transacciones')
      .select('*')
      .eq('ahorro_id', ahorroId)
      .eq('tipo', 'aporte_permanente')
      .order('created_at', { ascending: false });
    setAuditoriaPorAhorro(prev => ({ ...prev, [ahorroId]: data ?? [] }));
    setExpandedAhorroId(ahorroId);
    setLoadingAuditoria(null);
  };

  // ── Retorno del hook — mismo contrato que el original ────────────────────
  return {
    // Estado principal
    ahorros, loading, periodos,
    asociadosDisponibles,

    // Búsqueda / orden / paginación
    searchTerm, setSearchTerm,
    currentPage, setCurrentPage,
    currentPageAnulados, setCurrentPageAnulados,
    sortBy, setSortBy,
    itemsPerPage,

    // Valores computados
    filteredAhorros, sortedAhorros,
    filteredAhorrosAnulados,
    totalPages, startIndex, endIndex, currentAhorros,
    totalPagesAnulados, startIndexAnulados, endIndexAnulados, currentAhorrosAnulados,

    // Detalle
    isDetailDialogOpen, setIsDetailDialogOpen,
    movimientosDetalle,
    historialCambios,
    loadingMovimientos,

    // Auditoría
    expandedAhorroId,
    auditoriaPorAhorro,
    loadingAuditoria,
    historialCambiosGeneral,

    // Ítem seleccionado
    selectedItem, setSelectedItem,

    // Monto obligatorio
    montoObligatorio,

    // Handlers del orquestador
    handleOpenDetail,
    closeDetailDialog,
    cargarAuditoria,

    // ── CRUD sub-hook ──────────────────────────────────────────────────────
    ...crud,

    // ── Aportes sub-hook ───────────────────────────────────────────────────
    ...aportes,

    // ── Solicitudes sub-hook ───────────────────────────────────────────────
    ...solicitudes,

    // ── PDF sub-hook ───────────────────────────────────────────────────────
    ...pdf,
  };
}

/** Tipo inferido del hook — útil para tipar las props de sub-componentes */
export type AhorroPermanenteHook = ReturnType<typeof useAhorroPermanente>;
