import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Search, Plus, Eye, ChevronLeft, ChevronRight,
  Calculator, CheckCircle2, Clock, AlertTriangle, Activity,
  FileX, TrendingUp, ListFilter, Upload
} from 'lucide-react';
import { getEstadoBadge, fmtCOP, numLiq } from './liquidacionUtils';
import { LiquidacionRecord } from './liquidacionTypes';

interface LiquidacionTablaProps {
  esVistaPropia: boolean;
  can: (perm: string) => boolean;
  liquidaciones: LiquidacionRecord[];
  loading: boolean;
  isSearching: boolean;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  filterEstado: string;
  setFilterEstado: (s: string) => void;
  filterTipo: string;
  setFilterTipo: (s: string) => void;
  filterDesde: string;
  setFilterDesde: (s: string) => void;
  filterHasta: string;
  setFilterHasta: (s: string) => void;
  filterRegDesde: string;
  setFilterRegDesde: (s: string) => void;
  filterRegHasta: string;
  setFilterRegHasta: (s: string) => void;
  dateRangeError: string;
  sortBy: any;
  setSortBy: (s: any) => void;
  pagActivas: LiquidacionRecord[];
  pagAnuladas: LiquidacionRecord[];
  currentPage: number;
  setCurrentPage: (n: number) => void;
  totalPagActivas: number;
  currentPageAnuladas: number;
  setCurrentPageAnuladas: (n: number) => void;
  totalPagAn: number;
  montoTotal: number;
  cantPagadas: number;
  cantPendientes: number;
  setIsCreateOpen: (b: boolean) => void;
  setSelectedItem: (item: any) => void;
  setIsDetailOpen: (b: boolean) => void;
  setIsAnularOpen: (b: boolean) => void;
  setIsUploadDocOpen: (b: boolean) => void;
}

export function LiquidacionTabla({
  esVistaPropia, can, liquidaciones, loading, isSearching,
  searchTerm, setSearchTerm, filterEstado, setFilterEstado,
  filterTipo, setFilterTipo, filterDesde, setFilterDesde,
  filterHasta, setFilterHasta, filterRegDesde, setFilterRegDesde,
  filterRegHasta, setFilterRegHasta, dateRangeError,
  sortBy, setSortBy, pagActivas, pagAnuladas,
  currentPage, setCurrentPage, totalPagActivas,
  currentPageAnuladas, setCurrentPageAnuladas, totalPagAn,
  montoTotal, cantPagadas, cantPendientes,
  setIsCreateOpen, setSelectedItem, setIsDetailOpen, setIsAnularOpen, setIsUploadDocOpen
}: LiquidacionTablaProps) {

  // Lógica local para el rol Asociado (criterios de consulta simplificada)
  const [asocTab, setAsocTab] = React.useState<'activas' | 'historial'>('activas');
  const [asocPage, setAsocPage] = React.useState(1);

  // Filtrar liquidaciones en memoria
  const filteredAsoc = React.useMemo(() => {
    if (!esVistaPropia) return [];
    
    return liquidaciones.filter(l => {
      // 1. Filtrar por Tab (Activas vs Historial)
      // CA_62_03: Separar solicitudes activas de las finalizadas/anuladas
      const matchesTab = asocTab === 'activas'
        ? (!l.anulado && l.estado !== 'Pagada')
        : (l.anulado || l.estado === 'Pagada');
      
      if (!matchesTab) return false;

      // 2. Filtrar por Tipo de Liquidación (CA_62_02)
      if (filterTipo && filterTipo !== 'todas' && l.tipo !== filterTipo) return false;

      // 3. Filtrar por Estado (CA_62_01)
      if (filterEstado && filterEstado !== 'todas') {
        if (asocTab === 'historial') {
          if (filterEstado === 'Anulada' && !l.anulado) return false;
          if (filterEstado === 'Pagada' && (l.anulado || l.estado !== 'Pagada')) return false;
        } else {
          if (l.estado !== filterEstado) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'fecha_desc') return new Date(b.fechaCorte||b.createdAt).getTime() - new Date(a.fechaCorte||a.createdAt).getTime();
      if (sortBy === 'fecha_asc') return new Date(a.fechaCorte||a.createdAt).getTime() - new Date(b.fechaCorte||b.createdAt).getTime();
      if (sortBy === 'monto_desc') return (b.montoFinal??0) - (a.montoFinal??0);
      if (sortBy === 'monto_asc') return (a.montoFinal??0) - (b.montoFinal??0);
      if (sortBy === 'estado_az') return (a.estado??'').localeCompare(b.estado??'', 'es');
      return 0;
    });
  }, [esVistaPropia, liquidaciones, asocTab, filterTipo, filterEstado, sortBy]);

  const itemsPerPage = 10;
  const pagAsoc = React.useMemo(() => {
    return filteredAsoc.slice((asocPage - 1) * itemsPerPage, asocPage * itemsPerPage);
  }, [filteredAsoc, asocPage]);

  const totalAsocPages = Math.ceil(filteredAsoc.length / itemsPerPage);

  const kpis = [
    {
      label: 'Total Liquidado',
      value: fmtCOP(montoTotal),
      icon: Calculator,
      gradient: 'from-emerald-500 to-emerald-600',
      subColor: 'text-emerald-100',
      hint: 'Suma de montos activos',
    },
    {
      label: 'Pagadas',
      value: cantPagadas,
      icon: CheckCircle2,
      gradient: 'from-blue-500 to-blue-600',
      subColor: 'text-blue-100',
      hint: 'Liquidaciones completadas',
    },
    {
      label: 'En Proceso',
      value: cantPendientes,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-500',
      subColor: 'text-amber-100',
      hint: 'Pendientes de pago',
    },
    {
      label: 'Total Registros',
      value: liquidaciones.length,
      icon: Activity,
      gradient: 'from-slate-600 to-slate-700',
      subColor: 'text-slate-300',
      hint: 'Incluye anuladas',
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 shadow-xl">
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute -bottom-12 -left-6 w-56 h-56 bg-white/5 rounded-full" />
        <div className="absolute top-4 right-32 w-16 h-16 bg-white/5 rounded-full" />

        <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Liquidaciones{esVistaPropia ? ' de mi cuenta' : ''}
              </h1>
              <p className="text-sm text-emerald-200 mt-0.5">
                {loading
                  ? 'Cargando registros...'
                  : `${liquidaciones.length} registro${liquidaciones.length !== 1 ? 's' : ''} encontrado${liquidaciones.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          {!esVistaPropia && can('liquidacion') && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold shadow-lg border-0 gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" /> Nueva Liquidación
            </Button>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {!esVistaPropia && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpis.map(({ label, value, icon: Icon, gradient, subColor, hint }) => (
            <div
              key={label}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} shadow-lg p-5`}
            >
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
              <div className="absolute top-2 right-10 w-8 h-8 bg-white/5 rounded-full" />

              <div className="relative flex items-start justify-between">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${subColor}`}>{label}</p>
                  {loading ? (
                    <div className="h-8 w-24 bg-white/20 animate-pulse rounded-lg mt-2" />
                  ) : (
                    <h3 className="text-2xl font-extrabold mt-1.5 text-white">{value}</h3>
                  )}
                </div>
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-white/20 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-white/60" />
                <span className={`text-[11px] ${subColor}`}>{hint}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs de Filtro para Asociado ── */}
      {esVistaPropia && (
        <div className="flex justify-center sm:justify-start">
          <Tabs defaultValue="activas" value={asocTab} onValueChange={(v) => { setAsocTab(v as 'activas' | 'historial'); setAsocPage(1); setFilterEstado('todas'); }} className="w-full max-w-md">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl shadow-sm border border-slate-200">
              <TabsTrigger value="activas" className="rounded-lg py-2 text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
                Solicitudes Activas
              </TabsTrigger>
              <TabsTrigger value="historial" className="rounded-lg py-2 text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">
                Historial y Finalizadas
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* ── Tabla principal ── */}
      <Card className="border-0 shadow-md bg-white overflow-hidden rounded-2xl">
        <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white pb-4 pt-5">
          <div className="flex items-center gap-2 mb-4">
            <ListFilter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-600">Filtros de búsqueda</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {esVistaPropia ? (
              <>
                {/* CA_62_01: Filtrar por estado actual / histórico */}
                <div className="md:col-span-4">
                  <Select value={filterEstado} onValueChange={setFilterEstado}>
                    <SelectTrigger className="bg-white border-slate-200 rounded-xl w-full">
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">
                        {asocTab === 'activas' ? 'Todos los estados activos' : 'Todos los historiales'}
                      </SelectItem>
                      {asocTab === 'activas' ? (
                        <>
                          <SelectItem value="Pendiente">Pendiente</SelectItem>
                          <SelectItem value="En proceso">En proceso</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="Pagada">Pagada</SelectItem>
                          <SelectItem value="Anulada">Anulada</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* CA_62_02: Filtrar por tipo de liquidación */}
                <div className="md:col-span-4">
                  <Select value={filterTipo} onValueChange={setFilterTipo}>
                    <SelectTrigger className="bg-white border-slate-200 rounded-xl w-full">
                      <SelectValue placeholder="Cualquier tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Cualquier tipo</SelectItem>
                      <SelectItem value="retiro">Retiro Definitivo</SelectItem>
                      <SelectItem value="parcial">Retiro Parcial</SelectItem>
                      <SelectItem value="cruce">Cruce de Cuentas</SelectItem>
                      <SelectItem value="fallecimiento">Fallecimiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Ordenamiento simple */}
                <div className="md:col-span-4">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="bg-white border-slate-200 rounded-xl w-full">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fecha_desc">Más recientes</SelectItem>
                      <SelectItem value="fecha_asc">Más antiguos</SelectItem>
                      <SelectItem value="monto_desc">Mayor monto</SelectItem>
                      <SelectItem value="monto_asc">Menor monto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-3 relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <Input
                    placeholder="Nombre, N° liquidación, cédula..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-white border-slate-200 focus:border-emerald-400 rounded-xl"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-3 w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                <div className="md:col-span-2">
                  <Select value={filterEstado} onValueChange={setFilterEstado}>
                    <SelectTrigger className="bg-white border-slate-200 rounded-xl">
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todos los estados</SelectItem>
                      <SelectItem value="En proceso">En proceso</SelectItem>
                      <SelectItem value="Pagada">Pagada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Select value={filterTipo} onValueChange={setFilterTipo}>
                    <SelectTrigger className="bg-white border-slate-200 rounded-xl">
                      <SelectValue placeholder="Cualquier tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Cualquier tipo</SelectItem>
                      <SelectItem value="retiro">Retiro Definitivo</SelectItem>
                      <SelectItem value="parcial">Retiro Parcial</SelectItem>
                      <SelectItem value="cruce">Cruce de Cuentas</SelectItem>
                      <SelectItem value="fallecimiento">Fallecimiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-3 flex flex-col">
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      title="Creado desde"
                      value={filterRegDesde}
                      onChange={(e) => setFilterRegDesde(e.target.value)}
                      className="bg-white border-slate-200 rounded-xl text-xs"
                    />
                    <Input
                      type="date"
                      title="Creado hasta"
                      value={filterRegHasta}
                      onChange={(e) => setFilterRegHasta(e.target.value)}
                      className="bg-white border-slate-200 rounded-xl text-xs"
                    />
                  </div>
                  {dateRangeError && (
                    <span className="text-[10px] text-red-500 mt-1">{dateRangeError}</span>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="bg-white border-slate-200 rounded-xl">
                      <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fecha_desc">Más recientes</SelectItem>
                      <SelectItem value="fecha_asc">Más antiguos</SelectItem>
                      <SelectItem value="monto_desc">Mayor monto</SelectItem>
                      <SelectItem value="monto_asc">Menor monto</SelectItem>
                      <SelectItem value="estado_az">Estado (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 border-b border-slate-100 hover:bg-slate-50/80">
                  <TableHead className="font-semibold text-slate-500 text-xs uppercase tracking-wide py-3">Liquidación</TableHead>
                  {!esVistaPropia && <TableHead className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Asociado</TableHead>}
                  <TableHead className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Fechas</TableHead>
                  <TableHead className="font-semibold text-slate-500 text-xs uppercase tracking-wide">Tipo</TableHead>
                  <TableHead className="text-right font-semibold text-slate-500 text-xs uppercase tracking-wide">Total a Pagar</TableHead>
                  <TableHead className="text-center font-semibold text-slate-500 text-xs uppercase tracking-wide">Estado</TableHead>
                  <TableHead className="text-right font-semibold text-slate-500 text-xs uppercase tracking-wide">Acciones</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse border-b border-slate-50">
                      <TableCell className="py-4">
                        <div className="h-4 w-24 bg-slate-100 rounded" />
                        <div className="h-3 w-32 bg-slate-100 rounded mt-2" />
                      </TableCell>
                      {!esVistaPropia && (
                        <TableCell><div className="h-4 w-28 bg-slate-100 rounded" /></TableCell>
                      )}
                      <TableCell><div className="h-4 w-20 bg-slate-100 rounded" /></TableCell>
                      <TableCell><div className="h-6 w-16 bg-slate-100 rounded-full" /></TableCell>
                      <TableCell className="text-right"><div className="h-4 w-20 bg-slate-100 rounded ml-auto" /></TableCell>
                      <TableCell className="text-center"><div className="h-6 w-16 bg-slate-100 rounded-full mx-auto" /></TableCell>
                      <TableCell className="text-right"><div className="h-8 w-14 bg-slate-100 rounded ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : esVistaPropia ? (
                  /* Vista Asociado (Filtrado local por tabs) */
                  pagAsoc.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-4 py-10">
                          <div className="relative">
                            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center shadow-inner">
                              <FileX className="w-9 h-9 text-slate-400" />
                            </div>
                            {liquidaciones.length > 0 && (
                              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Search className="w-3.5 h-3.5 text-emerald-600" />
                              </div>
                            )}
                          </div>
                          <div className="space-y-2 max-w-md mx-auto">
                            <p className="text-base font-semibold text-slate-700">
                              {liquidaciones.length === 0
                                ? 'No tienes solicitudes de retiro o liquidación'
                                : 'No se encontraron resultados'}
                            </p>
                            <p className="text-sm text-slate-400 leading-relaxed px-4">
                              {liquidaciones.length === 0
                                ? 'Si deseas desvincularte de la cooperativa o solicitar un retiro parcial de tus ahorros, por favor comunícate con la administración para iniciar el proceso formal.'
                                : 'Ajusta los filtros seleccionados o cambia de pestaña para buscar otros registros.'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagAsoc.map((liq) => (
                      <TableRow
                        key={liq.id}
                        className="hover:bg-emerald-50/30 transition-colors border-b border-slate-50 group cursor-pointer"
                        onClick={() => { setSelectedItem(liq); setIsDetailOpen(true); }}
                      >
                        <TableCell className="py-3.5">
                          <div className="font-semibold text-slate-800 text-sm">{numLiq(liq.id)}</div>
                          <div className="text-xs text-slate-400 mt-0.5 line-clamp-1" title={liq.motivo}>
                            {liq.motivo || 'Sin motivo especificado'}
                          </div>
                        </TableCell>

                        <TableCell className="py-3.5">
                          <div className="text-sm text-slate-700">
                            <span className="text-slate-400 text-xs">Corte: </span>
                            <span className="font-medium">{liq.fechaCorte || '—'}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Reg: {liq.createdAt ? new Date(liq.createdAt).toLocaleDateString('es-CO') : '—'}
                          </div>
                        </TableCell>

                        <TableCell className="py-3.5">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal text-xs border-0">
                            {liq.tipo}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right py-3.5">
                          <span className="text-sm font-bold text-emerald-700">{fmtCOP(liq.montoFinal)}</span>
                        </TableCell>

                        <TableCell className="text-center py-3.5">
                          {getEstadoBadge(liq.estado, liq.anulado)}
                        </TableCell>

                        <TableCell className="text-right py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {!esVistaPropia && !liq.anulado && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg opacity-60 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); setSelectedItem(liq); setIsUploadDocOpen(true); }}
                                title="Subir soporte"
                              >
                                <Upload className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-3 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg opacity-60 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); setSelectedItem(liq); setIsDetailOpen(true); }}
                            >
                              <Eye className="w-4 h-4 mr-1" /> Ver
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )
                ) : (
                  /* Vista Administrador (Filtrado por hook CRUD) */
                  pagActivas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-4 py-10">
                          <div className="relative">
                            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center shadow-inner">
                              <FileX className="w-9 h-9 text-slate-400" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center">
                              <Search className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-base font-semibold text-slate-700">No se encontraron liquidaciones</p>
                            <p className="text-sm text-slate-400 max-w-xs mx-auto">
                              {searchTerm || filterEstado || filterTipo || filterDesde || filterHasta
                                ? 'Intenta ajustar los filtros de búsqueda para ver más resultados.'
                                : 'Aún no hay liquidaciones registradas en el sistema.'}
                            </p>
                          </div>
                          {can('liquidacion') && !searchTerm && !filterEstado && !filterTipo && (
                            <Button
                              size="sm"
                              onClick={() => setIsCreateOpen(true)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl shadow-sm"
                            >
                              <Plus className="w-4 h-4" /> Crear primera liquidación
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagActivas.map((liq) => (
                      <TableRow
                        key={liq.id}
                        className="hover:bg-emerald-50/30 transition-colors border-b border-slate-50 group cursor-pointer"
                        onClick={() => { setSelectedItem(liq); setIsDetailOpen(true); }}
                      >
                        <TableCell className="py-3.5">
                          <div className="font-semibold text-slate-800 text-sm">{numLiq(liq.id)}</div>
                          <div className="text-xs text-slate-400 mt-0.5 line-clamp-1" title={liq.motivo}>
                            {liq.motivo || 'Sin motivo especificado'}
                          </div>
                        </TableCell>

                        <TableCell className="py-3.5">
                          <div className="font-medium text-slate-800 text-sm">{liq.asociado}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{liq.cedula}</div>
                        </TableCell>

                        <TableCell className="py-3.5">
                          <div className="text-sm text-slate-700">
                            <span className="text-slate-400 text-xs">Corte: </span>
                            <span className="font-medium">{liq.fechaCorte || '—'}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Reg: {liq.createdAt ? new Date(liq.createdAt).toLocaleDateString('es-CO') : '—'}
                          </div>
                        </TableCell>

                        <TableCell className="py-3.5">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal text-xs border-0">
                            {liq.tipo}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right py-3.5">
                          <span className="text-sm font-bold text-emerald-700">{fmtCOP(liq.montoFinal)}</span>
                        </TableCell>

                        <TableCell className="text-center py-3.5">
                          {getEstadoBadge(liq.estado, liq.anulado)}
                        </TableCell>

                        <TableCell className="text-right py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {!esVistaPropia && !liq.anulado && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg opacity-60 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => { e.stopPropagation(); setSelectedItem(liq); setIsUploadDocOpen(true); }}
                                title="Subir soporte"
                              >
                                <Upload className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-3 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg opacity-60 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); setSelectedItem(liq); setIsDetailOpen(true); }}
                            >
                              <Eye className="w-4 h-4 mr-1" /> Ver
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación de Asociado */}
          {esVistaPropia && totalAsocPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500 font-medium">
                Página <span className="text-slate-700">{asocPage}</span> de <span className="text-slate-700">{totalAsocPages}</span>
              </span>
              <div className="flex gap-1.5">
                <Button
                  variant="outline" size="sm"
                  className="h-8 w-8 p-0 rounded-lg border-slate-200"
                  onClick={() => setAsocPage(Math.max(1, asocPage - 1))}
                  disabled={asocPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-8 w-8 p-0 rounded-lg border-slate-200"
                  onClick={() => setAsocPage(Math.min(totalAsocPages, asocPage + 1))}
                  disabled={asocPage === totalAsocPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Paginación de Administrador */}
          {!esVistaPropia && totalPagActivas > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
              <span className="text-xs text-slate-500 font-medium">
                Página <span className="text-slate-700">{currentPage}</span> de <span className="text-slate-700">{totalPagActivas}</span>
              </span>
              <div className="flex gap-1.5">
                <Button
                  variant="outline" size="sm"
                  className="h-8 w-8 p-0 rounded-lg border-slate-200"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-8 w-8 p-0 rounded-lg border-slate-200"
                  onClick={() => setCurrentPage(Math.min(totalPagActivas, currentPage + 1))}
                  disabled={currentPage === totalPagActivas}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Anuladas ── */}
      {!esVistaPropia && pagAnuladas.length > 0 && (
        <Card className="border-0 shadow-md bg-white overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-red-100 bg-gradient-to-r from-red-50 to-orange-50/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-red-800">Liquidaciones Anuladas</CardTitle>
                <p className="text-xs text-red-400 mt-0.5">
                  {pagAnuladas.length} registro{pagAnuladas.length !== 1 ? 's' : ''} anulado{pagAnuladas.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-red-50/40 border-b border-red-100 hover:bg-red-50/40">
                    <TableHead className="font-semibold text-red-700 text-xs uppercase tracking-wide py-3">Liquidación</TableHead>
                    {!esVistaPropia && <TableHead className="font-semibold text-red-700 text-xs uppercase tracking-wide">Asociado</TableHead>}
                    <TableHead className="font-semibold text-red-700 text-xs uppercase tracking-wide">Corte</TableHead>
                    <TableHead className="text-right font-semibold text-red-700 text-xs uppercase tracking-wide">Total</TableHead>
                    <TableHead className="text-center font-semibold text-red-700 text-xs uppercase tracking-wide">Estado</TableHead>
                    <TableHead className="text-right font-semibold text-red-700 text-xs uppercase tracking-wide">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagAnuladas.map((liq) => (
                    <TableRow key={liq.id} className="hover:bg-red-50/20 transition-colors border-b border-red-50 opacity-80 group cursor-pointer" onClick={() => { setSelectedItem(liq); setIsDetailOpen(true); }}>
                      <TableCell className="py-3.5">
                        <div className="font-semibold text-slate-700 text-sm">{numLiq(liq.id)}</div>
                      </TableCell>
                      {!esVistaPropia && (
                        <TableCell className="py-3.5">
                          <div className="font-medium text-slate-700 text-sm">{liq.asociado}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{liq.cedula}</div>
                        </TableCell>
                      )}
                      <TableCell className="py-3.5">
                        <div className="text-sm font-medium text-slate-600">{liq.fechaCorte || '—'}</div>
                      </TableCell>
                      <TableCell className="text-right py-3.5">
                        <span className="text-sm font-bold text-slate-400 line-through">{fmtCOP(liq.montoFinal)}</span>
                      </TableCell>
                      <TableCell className="text-center py-3.5">
                        {getEstadoBadge(liq.estado, liq.anulado)}
                      </TableCell>
                      <TableCell className="text-right py-3.5">
                        <Button
                          variant="ghost" size="sm"
                          className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg opacity-60 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); setSelectedItem(liq); setIsDetailOpen(true); }}
                        >
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPagAn > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-red-100 bg-red-50/30">
                <span className="text-xs text-red-400 font-medium">
                  Página <span className="text-red-600">{currentPageAnuladas}</span> de <span className="text-red-600">{totalPagAn}</span>
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline" size="sm"
                    className="h-8 w-8 p-0 rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setCurrentPageAnuladas(Math.max(1, currentPageAnuladas - 1))}
                    disabled={currentPageAnuladas === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="h-8 w-8 p-0 rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => setCurrentPageAnuladas(Math.min(totalPagAn, currentPageAnuladas + 1))}
                    disabled={currentPageAnuladas === totalPagAn}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
