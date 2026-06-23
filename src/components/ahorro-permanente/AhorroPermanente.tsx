// ── AhorroPermanente.tsx ──────────────────────────────────────────────────────
// Orquestador del módulo de ahorro permanente.
// Toda la lógica de estado y handlers vive en useAhorroPermanente.
// Los sub-componentes están en src/components/ahorro-permanente/.

import { useState } from 'react';
import PiggyBankLoader from '../ui/PiggyBankLoader';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Search, Plus, Edit, Check, PiggyBank, ClipboardList, History, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock, UserCircle2, Trash2, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';

import type { UserRole } from '../../contexts/AuthContext';
import { useAhorroPermanente } from './useAhorroPermanente';
import { formatCurrency } from '../../lib/formatters';

// Sub-componentes
import AhorroTabla              from './AhorroTabla';
import AhorroDialogCrear        from './AhorroDialogCrear';
import AhorroDialogDetalle      from './AhorroDialogDetalle';
import AhorroDialogAporte       from './AhorroDialogAporte';
import AhorroDialogsConfirmacion from './AhorroDialogsConfirmacion';
import AhorroDialogPDF          from './AhorroDialogPDF';

interface AhorroPermanenteProps {
  userRole?: UserRole | null;
  userData?: any;
}

export default function AhorroPermanente({ userRole, userData }: AhorroPermanenteProps) {
  const h = useAhorroPermanente(userRole, userData);
  const [auditPage, setAuditPage] = useState(1);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [auditFiltro, setAuditFiltro] = useState('todos');

  // ── Pantalla de carga ──────────────────────────────────────────────────────
  if (h.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PiggyBankLoader title="Cargando ahorros permanentes..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-200 dark:bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Encabezado ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Ahorro Permanente</h1>
            <p className="text-slate-600">
              {userRole === 'asociado'
                ? 'Consulta tus ahorros permanentes'
                : 'Gestiona los ahorros permanentes de los asociados'}
            </p>
          </div>
          {userRole === 'admin' && (
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => h.handleOpenCreateDialog()}
            >
              <Plus className="size-4" />
              Nuevo ahorro
            </Button>
          )}
        </div>

        {/* ── Configuración monto obligatorio (solo admin) ────────────────── */}
        {userRole === 'admin' && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 rounded-xl">
                    <PiggyBank className="size-6 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-emerald-900">
                      Configuración del Plan de Ahorro Permanente
                    </CardTitle>
                    <p className="text-sm text-emerald-700 mt-1">
                      Monto obligatorio mensual que deben aportar todos los asociados
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="montoObligatorio" className="text-emerald-900 font-semibold">
                    Monto Obligatorio Mensual
                  </Label>
                  {!h.isEditingMonto ? (
                    <div className="flex items-center gap-3 mt-2">
                      <p className="text-3xl font-bold text-emerald-600">
                        {formatCurrency(h.montoObligatorio)}
                      </p>
                      <Button
                        variant="outline" size="sm"
                        className="gap-2"
                        onClick={() => {
                          h.setIsEditingMonto(true);
                          h.setTempMontoObligatorio(h.montoObligatorio.toString());
                        }}
                      >
                        <Edit className="size-4" />
                        Modificar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 mt-2">
                      <Input
                        id="montoObligatorio"
                        type="number"
                        value={h.tempMontoObligatorio}
                        onChange={(e) => h.setTempMontoObligatorio(e.target.value)}
                        placeholder="Ej: 50000"
                        className="max-w-xs"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={h.handleSaveMontoObligatorio}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="size-4" />
                        Guardar
                      </Button>
                      <Button variant="outline" size="sm" onClick={h.handleCancelEditMonto}>
                        Cancelar
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-emerald-600 mt-2">
                    Este monto se aplicará como aporte obligatorio para todos los nuevos asociados
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tarjeta principal: tabla + tabs ────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Gestión de Ahorros Permanentes</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                {/* Búsqueda */}
                <div className="relative flex-1 sm:flex-none sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nombre o cédula..."
                    className="pl-10"
                    value={h.searchTerm}
                    onChange={(e) => {
                      h.setSearchTerm(e.target.value);
                      h.setCurrentPage(1);
                      h.setCurrentPageAnulados(1);
                    }}
                  />
                </div>
                {/* Ordenar (solo admin) */}
                {userRole === 'admin' && (
                  <Select
                    value={h.sortBy}
                    onValueChange={(value: any) => { h.setSortBy(value); h.setCurrentPage(1); }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Ordenar por..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Sin ordenar</SelectItem>
                      <SelectItem value="saldo-desc">Saldo (mayor a menor)</SelectItem>
                      <SelectItem value="saldo-asc">Saldo (menor a mayor)</SelectItem>
                      <SelectItem value="antiguedad-desc">Más antiguos primero</SelectItem>
                      <SelectItem value="antiguedad-asc">Más recientes primero</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="activos" className="w-full">
              <TabsList className="grid w-full mb-4 grid-cols-2">
                <TabsTrigger value="activos" className="gap-2">
                  <PiggyBank className="size-4" />
                  Ahorros Activos ({h.filteredAhorros.length})
                </TabsTrigger>
                <TabsTrigger value="anulados" className="gap-2">
                  <PiggyBank className="size-4" />
                  Ahorros Anulados ({h.filteredAhorrosAnulados.length})
                </TabsTrigger>
              </TabsList>

              {/* Tab: activos */}
              <TabsContent value="activos">
                <AhorroTabla
                  ahorrosList={h.currentAhorros}
                  isAnulados={false}
                  userRole={userRole}
                  searchTerm={h.searchTerm}
                  setSearchTerm={h.setSearchTerm}
                  handleOpenDetail={h.handleOpenDetail}
                  handleOpenCreateDialog={h.handleOpenCreateDialog}
                  handleOpenPdfDialog={h.handleOpenPdfDialog}
                  openAporteDialog={h.openAporteDialog}
                  openAnularDialog={h.openAnularDialog}
                  openToggleEstadoDialog={h.openToggleEstadoDialog}
                  cargarAuditoria={h.cargarAuditoria}
                  expandedAhorroId={h.expandedAhorroId}
                  auditoriaPorAhorro={h.auditoriaPorAhorro}
                  loadingAuditoria={h.loadingAuditoria}
                  totalPages={h.totalPages}
                  currentPage={h.currentPage}
                  setCurrentPage={h.setCurrentPage}
                  startIndex={h.startIndex}
                  endIndex={h.endIndex}
                  totalCount={h.sortedAhorros.length}
                />
              </TabsContent>

              {/* Tab: anulados */}
              <TabsContent value="anulados">
                <AhorroTabla
                  ahorrosList={h.currentAhorrosAnulados}
                  isAnulados={true}
                  userRole={userRole}
                  searchTerm={h.searchTerm}
                  setSearchTerm={h.setSearchTerm}
                  handleOpenDetail={h.handleOpenDetail}
                  handleOpenCreateDialog={h.handleOpenCreateDialog}
                  handleOpenPdfDialog={h.handleOpenPdfDialog}
                  openAporteDialog={h.openAporteDialog}
                  openAnularDialog={h.openAnularDialog}
                  openToggleEstadoDialog={h.openToggleEstadoDialog}
                  cargarAuditoria={h.cargarAuditoria}
                  expandedAhorroId={h.expandedAhorroId}
                  auditoriaPorAhorro={h.auditoriaPorAhorro}
                  loadingAuditoria={h.loadingAuditoria}
                  totalPages={h.totalPagesAnulados}
                  currentPage={h.currentPageAnulados}
                  setCurrentPage={h.setCurrentPageAnulados}
                  startIndex={h.startIndexAnulados}
                  endIndex={h.endIndexAnulados}
                  totalCount={h.filteredAhorrosAnulados.length}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Auditoría de Cambios (solo admin) ─────────────────────────── */}
        {userRole === 'admin' && (() => {
          const AUDITORIA_PER_PAGE = 5;

          const ACTION_CFG: Record<string, { label: string; icon: JSX.Element; color: string; bg: string; border: string; dot: string }> = {
            'CREACIÓN': { label: 'CREACIÓN', icon: <Plus className="size-3.5" />, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-900', dot: 'bg-emerald-500' },
            'EDICIÓN':  { label: 'EDICIÓN',  icon: <Edit className="size-3.5" />, color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-900', dot: 'bg-blue-500' },
            'ANULACIÓN': { label: 'ANULACIÓN', icon: <Trash2 className="size-3.5" />, color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-900', dot: 'bg-red-500' },
          };

          const normalizeAction = (accion: string) => {
            const a = (accion || '').toUpperCase();
            if (a === 'INSERT' || a === 'CREAR') return 'CREACIÓN';
            if (a === 'UPDATE' || a === 'EDITAR') return 'EDICIÓN';
            if (a === 'DELETE' || a === 'ELIMINAR' || a === 'ANULAR') return 'ANULACIÓN';
            return 'EDICIÓN'; // fallback
          };

          const getCfg = (accion: string) => {
            const norm = normalizeAction(accion);
            return ACTION_CFG[norm] ?? { label: norm, icon: <History className="size-3.5" />, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-900', border: 'border-slate-200 dark:border-slate-800', dot: 'bg-slate-400' };
          };

          const conteoPorAccion = (h.historialCambiosGeneral || []).reduce((acc, e) => {
            const k = normalizeAction(e.accion);
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const auditFiltrada = auditFiltro === 'todos' 
            ? (h.historialCambiosGeneral || []) 
            : (h.historialCambiosGeneral || []).filter(e => normalizeAction(e.accion) === auditFiltro);

          const totalAudPaginas = Math.ceil(auditFiltrada.length / AUDITORIA_PER_PAGE);
          const audPagina = auditFiltrada.slice((auditPage - 1) * AUDITORIA_PER_PAGE, auditPage * AUDITORIA_PER_PAGE);

          return (
            <Card>
              <CardHeader className="pb-3">
                <button
                  className="w-full flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-left focus:outline-none"
                  onClick={() => setHistorialAbierto(v => !v)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-950 rounded-lg shrink-0">
                      <History className="size-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle>Historial de Cambios</CardTitle>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {h.historialCambiosGeneral?.length || 0} registro{h.historialCambiosGeneral?.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {historialAbierto ? (
                    <ChevronUp className="size-5 text-slate-400 shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="size-5 text-slate-400 shrink-0 mt-1" />
                  )}
                </button>

                {/* Chips de filtro */}
                {historialAbierto && (h.historialCambiosGeneral?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={() => { setAuditFiltro('todos'); setAuditPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                        auditFiltro === 'todos'
                          ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-750'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                      }`}
                    >
                      Todos
                      <span className={`font-bold ${auditFiltro === 'todos' ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'}`}>
                        {h.historialCambiosGeneral?.length || 0}
                      </span>
                    </button>
                    {Object.entries(conteoPorAccion).map(([accion, count]) => {
                      const cfg = ACTION_CFG[accion] || { dot: 'bg-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', color: 'text-slate-600' };
                      const activo = auditFiltro === accion;
                      return (
                        <button
                          key={accion}
                          onClick={() => { setAuditFiltro(activo ? 'todos' : accion); setAuditPage(1); }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                            activo
                              ? `${cfg.bg} ${cfg.border} ${cfg.color} ring-2 ring-offset-1 ring-current/40`
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <span className={`size-2 rounded-full shrink-0 ${cfg.dot}`} />
                          {accion}
                          <span className={`font-bold ${activo ? '' : 'text-slate-400'}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardHeader>

              {historialAbierto && (
                <CardContent>
                  {(h.historialCambiosGeneral || []).length === 0 ? (
                    <div className="text-center py-14">
                      <div className="inline-flex items-center justify-center size-14 rounded-full bg-slate-100 dark:bg-slate-850 mb-4">
                        <History className="size-7 text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="font-medium text-slate-500">Sin registros aún</p>
                      <p className="text-sm text-slate-400 mt-1">Los cambios aparecerán aquí automáticamente</p>
                    </div>
                  ) : auditFiltrada.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-sm text-slate-400">Sin registros para esta acción.</p>
                      <button
                        onClick={() => { setAuditFiltro('todos'); setAuditPage(1); }}
                        className="mt-2 text-xs text-blue-600 hover:underline"
                      >
                        Ver todos los registros
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Timeline */}
                      <div className="relative pl-1">
                        <div className="absolute left-[19px] top-5 bottom-5 w-px bg-slate-200 dark:bg-slate-700" />
                        <div className="space-y-3">
                          {audPagina.map((entry) => {
                            const cfg = getCfg(entry.accion);
                            return (
                              <div key={entry.id} className="relative flex gap-3 items-start group">
                                {/* Icono */}
                                <div className={`relative z-10 flex items-center justify-center size-10 rounded-full border-2 border-white dark:border-slate-950 shadow-sm shrink-0 ${cfg.bg}`}>
                                  <span className={cfg.color}>{cfg.icon}</span>
                                </div>

                                {/* Tarjeta */}
                                <div className={`flex-1 p-3.5 rounded-xl border transition-shadow group-hover:shadow-sm ${cfg.bg} ${cfg.border}`}>
                                  <div className="flex items-start justify-between gap-2 flex-wrap mb-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[11px] font-bold uppercase tracking-wider ${cfg.color}`}>
                                        {cfg.label}
                                      </span>
                                      <span className="text-[11px] text-slate-500 font-medium">
                                        · {entry.asociado}
                                      </span>
                                    </div>
                                    <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                                      <Clock className="size-3" />
                                      {new Date(entry.fecha_cambio).toLocaleString('es-CO')}
                                    </span>
                                  </div>

                                  {/* Detalle */}
                                  <p className="text-sm text-slate-700 dark:text-slate-350 leading-relaxed font-normal">
                                    {entry.detalle}
                                  </p>

                                  {/* Realizado por */}
                                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                                    <UserCircle2 className={`size-3.5 ${cfg.color} opacity-70`} />
                                    <span className="text-xs text-slate-500">
                                      Realizado por: <span className="font-semibold text-slate-600 dark:text-slate-400">{entry.usuario_nombre}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Paginación */}
                      {totalAudPaginas > 1 && (
                        <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-slate-850">
                          <p className="text-xs text-slate-500">
                            {(auditPage - 1) * AUDITORIA_PER_PAGE + 1}–{Math.min(auditPage * AUDITORIA_PER_PAGE, auditFiltrada.length)} de {auditFiltrada.length} registro{auditFiltrada.length !== 1 ? 's' : ''}
                            {auditFiltro !== 'todos' && (
                              <button onClick={() => { setAuditFiltro('todos'); setAuditPage(1); }} className="ml-2 text-blue-600 hover:underline">
                                Ver todos
                              </button>
                            )}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setAuditPage(1)}
                              disabled={auditPage === 1}
                              className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              «
                            </button>
                            <button
                              onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                              disabled={auditPage === 1}
                              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              ‹ Ant.
                            </button>
                            <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-850 rounded-lg">
                              {auditPage} / {totalAudPaginas}
                            </span>
                            <button
                              onClick={() => setAuditPage(p => Math.min(totalAudPaginas, p + 1))}
                              disabled={auditPage === totalAudPaginas}
                              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              Sig. ›
                            </button>
                            <button
                              onClick={() => setAuditPage(totalAudPaginas)}
                              disabled={auditPage === totalAudPaginas}
                              className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-850 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              »
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })()}
      </div>

      {/* ══ Diálogos ══════════════════════════════════════════════════════════ */}

      {/* Crear / Editar */}
      <AhorroDialogCrear
        open={h.isCreateDialogOpen}
        onClose={h.closeCreateDialog}
        selectedItem={h.selectedItem}
        formAsociadoId={h.formAsociadoId}
        setFormAsociadoId={h.setFormAsociadoId}
        autocompleteSearch={h.autocompleteSearch}
        setAutocompleteSearch={h.setAutocompleteSearch}
        showAutocomplete={h.showAutocomplete}
        setShowAutocomplete={h.setShowAutocomplete}
        autocompleteRef={h.autocompleteRef}
        acSuggestions={h.acSuggestions}
        handleSelectAsociado={h.handleSelectAsociado}
        asociadosDisponibles={h.asociadosDisponibles}
        formCuotaMensual={h.formCuotaMensual}
        handleCuotaMensualChange={h.handleCuotaMensualChange}
        handleCuotaMensualBlur={h.handleCuotaMensualBlur}
        montoObligatorio={h.montoObligatorio}
        formSaldoInicial={h.formSaldoInicial}
        handleSaldoInicialChange={h.handleSaldoInicialChange}
        handleSaldoInicialBlur={h.handleSaldoInicialBlur}
        saldoInicialError={h.saldoInicialError}
        formFechaInicio={h.formFechaInicio}
        setFormFechaInicio={h.setFormFechaInicio}
        editHasMovimientos={h.editHasMovimientos}
        loadingEditMovs={h.loadingEditMovs}
        formObservaciones={h.formObservaciones}
        setFormObservaciones={h.setFormObservaciones}
        handleSaveAhorro={h.handleSaveAhorro}
        setIsConfirmEditDialogOpen={h.setIsConfirmEditDialogOpen}
      />

      {/* Detalle + historial */}
      <AhorroDialogDetalle
        open={h.isDetailDialogOpen}
        onClose={h.closeDetailDialog}
        selectedItem={h.selectedItem}
        movimientosDetalle={h.movimientosDetalle}
        historialCambios={h.historialCambios}
        loadingMovimientos={h.loadingMovimientos}
      />

      {/* Registrar aporte */}
      <AhorroDialogAporte
        open={h.isAporteDialogOpen}
        onOpenChange={h.setIsAporteDialogOpen}
        selectedItem={h.selectedItem}
        movimientosDetalle={h.movimientosDetalle}
        formAporteMonto={h.formAporteMonto}
        setFormAporteMonto={h.setFormAporteMonto}
        formAporteFecha={h.formAporteFecha}
        setFormAporteFecha={h.setFormAporteFecha}
        formAporteDesc={h.formAporteDesc}
        setFormAporteDesc={h.setFormAporteDesc}
        formAportePeriodoId={h.formAportePeriodoId}
        setFormAportePeriodoId={h.setFormAportePeriodoId}
        formComprobante={h.formComprobante}
        setFormComprobante={h.setFormComprobante}
        formPagaMora={h.formPagaMora}
        setFormPagaMora={h.setFormPagaMora}
        formMoraMonto={h.formMoraMonto}
        handleFormMoraMontoChange={h.handleFormMoraMontoChange}
        periodos={h.periodos}
        handleRegistrarAporte={h.handleRegistrarAporte}
        savingAporte={h.savingAporte}
      />

      {/* Todos los AlertDialogs de confirmación */}
      <AhorroDialogsConfirmacion
        // 1. Aporte bajo mínimo
        isConfirmAporteBajoOpen={h.isConfirmAporteBajoOpen}
        setIsConfirmAporteBajoOpen={h.setIsConfirmAporteBajoOpen}
        formAporteMonto={h.formAporteMonto}
        montoObligatorio={h.montoObligatorio}
        ejecutarRegistrarAporte={h.ejecutarRegistrarAporte}
        // 2. Saldo inicial bajo mínimo
        isConfirmSaldoBajoOpen={h.isConfirmSaldoBajoOpen}
        setIsConfirmSaldoBajoOpen={h.setIsConfirmSaldoBajoOpen}
        formSaldoInicial={h.formSaldoInicial}
        handleSaveAhorro={h.handleSaveAhorro}
        // 3. Anulación
        isDeleteDialogOpen={h.isDeleteDialogOpen}
        setIsDeleteDialogOpen={h.setIsDeleteDialogOpen}
        selectedItem={h.selectedItem}
        justificacionAnulacion={h.justificacionAnulacion}
        setJustificacionAnulacion={h.setJustificacionAnulacion}
        handleAnular={h.handleAnular}
        setSelectedItem={h.setSelectedItem}
        // 4. Cambio de estado
        isToggleEstadoDialogOpen={h.isToggleEstadoDialogOpen}
        setIsToggleEstadoDialogOpen={h.setIsToggleEstadoDialogOpen}
        nuevoEstadoSeleccionado={h.nuevoEstadoSeleccionado}
        setNuevoEstadoSeleccionado={h.setNuevoEstadoSeleccionado}
        handleToggleEstado={h.handleToggleEstado}
        // 5. Confirmación edición cuota
        isConfirmEditDialogOpen={h.isConfirmEditDialogOpen}
        setIsConfirmEditDialogOpen={h.setIsConfirmEditDialogOpen}
        formCuotaMensual={h.formCuotaMensual}
        formFechaInicio={h.formFechaInicio}
        editHasMovimientos={h.editHasMovimientos}
        // 6. Rechazar solicitud
        isRechazarDialogOpen={h.isRechazarDialogOpen}
        setIsRechazarDialogOpen={h.setIsRechazarDialogOpen}
        solicitudSeleccionada={h.solicitudSeleccionada}
        setSolicitudSeleccionada={h.setSolicitudSeleccionada}
        notaRechazo={h.notaRechazo}
        setNotaRechazo={h.setNotaRechazo}
        savingSolicitud={h.savingSolicitud}
        handleRechazarSolicitud={h.handleRechazarSolicitud}
        // 7. Rechazar aporte reportado
        isRechazarAporteOpen={h.isRechazarAporteOpen}
        setIsRechazarAporteOpen={h.setIsRechazarAporteOpen}
        aporteSeleccionado={h.aporteSeleccionado}
        setAporteSeleccionado={h.setAporteSeleccionado}
        notaRechazoAporte={h.notaRechazoAporte}
        setNotaRechazoAporte={h.setNotaRechazoAporte}
        savingAporte={h.savingAporte}
        handleRechazarAporte={h.handleRechazarAporte}
      />

      {/* PDF — selector de rango + vista previa */}
      <AhorroDialogPDF
        open={h.isPdfRangeDialogOpen}
        onClose={() => { h.setIsPdfRangeDialogOpen(false); h.setAhorroPdfSelected(null); }}
        ahorroPdfSelected={h.ahorroPdfSelected}
        pdfRangeInicio={h.pdfRangeInicio}
        setPdfRangeInicio={h.setPdfRangeInicio}
        pdfRangeFin={h.pdfRangeFin}
        setPdfRangeFin={h.setPdfRangeFin}
        handleGenerarPDF={h.handleGenerarPDF}
        isPdfPreviewOpen={h.isPdfPreviewOpen}
        pdfPreviewUrl={h.pdfPreviewUrl}
        pdfPreviewFilename={h.pdfPreviewFilename}
        pdfDownloadFn={h.pdfDownloadFn}
        handleClosePdfPreview={h.handleClosePdfPreview}
      />
    </div>
  );
}
