import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { LiquidacionRecord, Concepto, LiqDoc } from './liquidacionTypes';
import { validateDateRange, numLiq } from './liquidacionUtils';

interface UseLiquidacionesCRUDProps {
  esVistaPropia: boolean;
  userData: any;
}

export function useLiquidacionesCRUD({ esVistaPropia, userData }: UseLiquidacionesCRUDProps) {
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionRecord[]>([]);
  const [asociadosDisponibles, setAsociadosDisponibles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');
  const [filterRegDesde, setFilterRegDesde] = useState('');
  const [filterRegHasta, setFilterRegHasta] = useState('');
  const [dateRangeError, setDateRangeError] = useState('');
  const [sortBy, setSortBy] = useState<'fecha_desc'|'fecha_asc'|'monto_desc'|'monto_asc'|'estado_az'>('fecha_desc');

  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageAnuladas, setCurrentPageAnuladas] = useState(1);
  const itemsPerPage = 10;

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildAsocMap = useCallback((lista: any[]) => {
    return Object.fromEntries(lista.map((a: any) => [a.id, { nombre: a.nombre ?? '', cedula: a.cedula ?? '' }]));
  }, []);

  const mapearFilas = useCallback((rows: any[], asocMap: Record<string, { nombre: string; cedula: string }> = {}): LiquidacionRecord[] => {
    return rows.map((l: any) => {
      const det = (l.detalle as any) ?? {};
      const asoc = asocMap[l.asociado_id] ?? { nombre: 'Sin nombre', cedula: '' };
      return {
        id: l.id,
        asociado: asoc.nombre,
        cedula: asoc.cedula,
        asociado_id: l.asociado_id,
        tipo: l.tipo ?? 'retiro',
        fechaCorte: l.fecha_corte ?? det.fechaCorte ?? l.fecha ?? '',
        fechaLiquidacion: l.fecha_liquidacion ?? det.fechaLiquidacion ?? '',
        estado: l.estado ?? det.estado ?? 'Pendiente',
        motivo: l.motivo ?? det.motivo ?? '',
        observaciones: l.observaciones ?? det.observaciones ?? '',
        conceptos: ((l.conceptos ?? det.conceptos) as Concepto[]) ?? [],
        documentos: ((l.documentos ?? det.documentos) as LiqDoc[]) ?? [],
        calculo: det.calculo ?? null,
        montoFinal: l.monto_total ?? 0,
        anulado: l.anulado ?? det.anulado ?? false,
        justificacionAnulacion: l.justificacion_anulacion ?? det.justificacionAnulacion ?? '',
        anuladoPor: l.anulado_por ?? det.anuladoPor ?? '',
        anuladoEn: l.anulado_en ?? det.anuladoEn ?? '',
        createdAt: l.created_at ?? l.fecha ?? '',
      };
    });
  }, []);

  const buscarLiquidaciones = useCallback(async (opts: { term?: string } = {}) => {
    const nombre = (opts.term ?? searchTerm).trim();

    const err = validateDateRange(filterRegDesde, filterRegHasta);
    setDateRangeError(err);
    if (err) return;

    setIsSearching(true);
    try {
      const esNombre = nombre.length >= 2
        && !nombre.toUpperCase().startsWith('LIQ-')
        && !/^\d+$/.test(nombre)
        && !/^[0-9a-f-]{6,}$/i.test(nombre);

      let asociadoIds: string[] | null = null;
      if (esNombre) {
        const { data: asocMatch, error: asocErr } = await supabase
          .from('usuarios')
          .select('id')
          .ilike('nombre', `%${nombre}%`)
          .limit(200);
        if (asocErr) throw asocErr;
        asociadoIds = (asocMatch || []).map((a: any) => a.id);
        if (asociadoIds.length === 0) {
          setLiquidaciones([]);
          return;
        }
      }

      if (esVistaPropia) {
        const asociadoId = userData?.id ?? null;
        if (!asociadoId) { setLiquidaciones([]); return; }
        asociadoIds = [asociadoId];
      }

      const { data, error } = await supabase.rpc('buscar_liquidaciones', {
        p_asociado_ids: asociadoIds,
        p_tipo: (filterTipo && filterTipo !== 'todas') ? filterTipo : null,
        p_reg_desde: filterRegDesde ? filterRegDesde + 'T00:00:00' : null,
        p_reg_hasta: filterRegHasta ? filterRegHasta + 'T23:59:59' : null,
        p_limite: 500,
      });
      if (error) throw error;

      const asocMap = buildAsocMap(asociadosDisponibles);
      if (esVistaPropia) {
        asocMap[userData?.id] = { nombre: userData?.name ?? userData?.nombre ?? '', cedula: userData?.cedula ?? '' };
      }
      setLiquidaciones(mapearFilas(data || [], asocMap));
    } catch (err: any) {
      toast.error('Error en búsqueda: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, filterRegDesde, filterRegHasta, filterTipo, esVistaPropia, userData, asociadosDisponibles, buildAsocMap, mapearFilas]);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      if (esVistaPropia) {
        const asociadoId = userData?.id ?? null;
        if (!asociadoId) {
          setLiquidaciones([]);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.rpc('buscar_liquidaciones', {
          p_asociado_ids: [asociadoId],
          p_tipo: null,
          p_reg_desde: null,
          p_reg_hasta: null,
          p_limite: 200,
        });
        if (error) throw error;
        const asocMap = {
          [asociadoId]: {
            nombre: userData?.name ?? userData?.nombre ?? '',
            cedula: userData?.cedula ?? '',
          },
        };
        setLiquidaciones(mapearFilas(data || [], asocMap));
      } else {
        const { data: rolAsoc } = await supabase
          .from('roles').select('id').eq('nombre', 'asociado').limit(1).maybeSingle();
        const rolAsociadoId = rolAsoc?.id ?? null;
        const [liqResult, { data: usuariosAsoc }] = await Promise.all([
          supabase.rpc('listar_liquidaciones', { p_limite: 500 }),
          rolAsociadoId
            ? supabase.from('usuarios').select('id,nombre,cedula').eq('rol_id', rolAsociadoId).order('nombre')
            : supabase.from('usuarios').select('id,nombre,cedula').order('nombre'),
        ]);
        if (liqResult.error) throw liqResult.error;
        const asocData = usuariosAsoc ?? [];
        const asocMap = buildAsocMap(asocData);
        setLiquidaciones(mapearFilas(liqResult.data || [], asocMap));
        setAsociadosDisponibles(asocData);
      }
    } catch (err: any) {
      toast.error('Error al cargar: ' + (err.message ?? JSON.stringify(err)), { duration: 15000 });
      console.error('[cargarDatos]', err);
    } finally {
      setLoading(false);
    }
  }, [esVistaPropia, userData, buildAsocMap, mapearFilas]);

  // Effects for searching
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const term = searchTerm;
    if (term === '' && !filterTipo && !filterRegDesde && !filterRegHasta) return;
    searchTimerRef.current = setTimeout(() => {
      setCurrentPage(1);
      buscarLiquidaciones({ term });
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchTerm, filterTipo, filterRegDesde, filterRegHasta, buscarLiquidaciones]);

  const handleCambiarEstado = async (liq: LiquidacionRecord, nuevoEstado: string, handleCargarAuditoria?: (id: string, asocId: string, accion: string, detalle: any) => Promise<void>) => {
    try {
      const { error } = await supabase.rpc('actualizar_liquidacion', {
        p_id: liq.id,
        p_estado: nuevoEstado,
      });
      if (error) throw error;
      setLiquidaciones(prev => prev.map(l => l.id === liq.id ? { ...l, estado: nuevoEstado } : l));
      toast.success(`Estado cambiado a ${nuevoEstado}`);
      if (handleCargarAuditoria) {
         await handleCargarAuditoria(liq.id, liq.asociado_id, 'CAMBIO_ESTADO', { estadoAnterior: liq.estado, estadoNuevo: nuevoEstado });
      }
    } catch (err: any) {
      toast.error('Error al cambiar estado: ' + err.message);
    }
  };

  const applyFilters = (list: LiquidacionRecord[]) =>
    list
      .filter(l => {
        const term = searchTerm.toLowerCase().trim();
        const nL = numLiq(l.id).toLowerCase();
        const matchSearch = !term || term.length < 2
          || l.asociado.toLowerCase().includes(term)
          || l.cedula.includes(term)
          || nL.includes(term)
          || (l.motivo || '').toLowerCase().includes(term);

        const matchEstado = !filterEstado || filterEstado === 'todas' || l.estado === filterEstado;
        const matchDesde = !filterDesde || (l.fechaCorte >= filterDesde);
        const matchHasta = !filterHasta || (l.fechaCorte <= filterHasta);

        return matchSearch && matchEstado && matchDesde && matchHasta;
      })
      .sort((a, b) => {
        if (sortBy === 'fecha_desc') return new Date(b.fechaCorte||b.createdAt).getTime() - new Date(a.fechaCorte||a.createdAt).getTime();
        if (sortBy === 'fecha_asc') return new Date(a.fechaCorte||a.createdAt).getTime() - new Date(b.fechaCorte||b.createdAt).getTime();
        if (sortBy === 'monto_desc') return (b.montoFinal??0) - (a.montoFinal??0);
        if (sortBy === 'monto_asc') return (a.montoFinal??0) - (b.montoFinal??0);
        if (sortBy === 'estado_az') return (a.estado??'').localeCompare(b.estado??'', 'es');
        return 0;
      });

  return {
    liquidaciones,
    setLiquidaciones,
    asociadosDisponibles,
    loading,
    isSearching,
    searchTerm, setSearchTerm,
    filterEstado, setFilterEstado,
    filterTipo, setFilterTipo,
    filterDesde, setFilterDesde,
    filterHasta, setFilterHasta,
    filterRegDesde, setFilterRegDesde,
    filterRegHasta, setFilterRegHasta,
    dateRangeError,
    sortBy, setSortBy,
    currentPage, setCurrentPage,
    currentPageAnuladas, setCurrentPageAnuladas,
    itemsPerPage,
    cargarDatos,
    buscarLiquidaciones,
    handleCambiarEstado,
    applyFilters
  };
}
