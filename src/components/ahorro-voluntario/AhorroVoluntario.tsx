// ── AhorroVoluntario.tsx (orquestador) ───────────────────────────────────────
// Componente principal: encabezado, filtros, pestañas y renderizado de sub-componentes.

import React, { useRef, useState } from 'react';
import PiggyBankLoader from '../ui/PiggyBankLoader';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Search, Plus, Wallet, FileText, ClipboardList, X, Mail, History, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock, UserCircle2, Edit, Trash2, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { formatCurrency } from '../../lib/formatters';
import type { UserRole } from '../../contexts/AuthContext';

import { useAhorroVoluntario } from './useAhorroVoluntario';
import AhorroVoluntarioTabla, { AhorroVoluntarioPaginacion } from './AhorroVoluntarioTabla';
import AhorroVoluntarioDialogCrear from './AhorroVoluntarioDialogCrear';
import AhorroVoluntarioDialogDetalle from './AhorroVoluntarioDialogDetalle';
import AhorroVoluntarioDialogMovimiento from './AhorroVoluntarioDialogMovimiento';
import AhorroVoluntarioAlertDialogs from './AhorroVoluntarioAlertDialogs';

interface AhorroVoluntarioProps {
  userRole?: UserRole | null;
  userData?: any;
}

export default function AhorroVoluntario({ userRole, userData }: AhorroVoluntarioProps) {
  const h = useAhorroVoluntario(userRole, userData);
  const [auditPage, setAuditPage] = useState(1);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [auditFiltro, setAuditFiltro] = useState('todos');

  // ── Pantalla de carga ──────────────────────────────────────────────────────
  if (h.loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PiggyBankLoader title="Cargando ahorros voluntarios..." />
      </div>
    );
  }

  const hasAnyActive = h.ahorros.filter((a: any) => !a.anulado).length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-200 dark:bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Ahorro Voluntario</h1>
            <p className="text-slate-600">
              {userRole === 'asociado'
                ? 'Consulta tus ahorros voluntarios'
                : 'Gestiona los ahorros voluntarios de los asociados'}
            </p>
          </div>
          {userRole === 'admin' && (
            <Button
              className="gap-2 bg-purple-600 hover:bg-purple-700"
              onClick={() => {
                h.setSelectedItem(null);
                h.setFormAsociadoId('');
                h.setFormSaldoInicial('0,0');
                h.setFormFechaInicio(new Date().toISOString().split('T')[0]);
                h.setFormFrecuencia('');
                h.setFormMontoObjetivo('');
                h.setAutocompleteSearch('');
                h.setIsCreateDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Registrar ahorro
            </Button>
          )}
        </div>

        {/* ── Tabla principal ── */}
        <Card>
          <CardHeader>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <CardTitle>Gestión de Ahorros Voluntarios</CardTitle>

                {/* Buscador con autocompletado */}
                <div className="relative flex-1 sm:flex-none sm:w-72" ref={h.searchRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10" />
                  {h.searchTerm && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
                      onClick={() => {
                        h.setSearchTerm('');
                        h.setCurrentPage(1);
                        h.setShowSearchSuggestions(false);
                      }}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                  <Input
                    placeholder="Buscar por nombre o cédula..."
                    className="pl-10 pr-8"
                    value={h.searchTerm}
                    autoComplete="off"
                    onChange={(e) => {
                      h.setSearchTerm(e.target.value);
                      h.setCurrentPage(1);
                      h.setShowSearchSuggestions(true);
                    }}
                    onFocus={() => h.setShowSearchSuggestions(true)}
                  />
                  {/* Sugerencias */}
                  {h.showSearchSuggestions && h.searchTerm.trim().length > 0 && (() => {
                    const term = h.searchTerm.toLowerCase();
                    const seen = new Set<string>();
                    const sugerencias = h.ahorros
                      .filter((a: any) => {
                        const coincide =
                          a.asociado.toLowerCase().includes(term) ||
                          a.cedula.includes(h.searchTerm);
                        if (!coincide || seen.has(a.asociado_id)) return false;
                        seen.add(a.asociado_id);
                        return true;
                      })
                      .slice(0, 6);
                    if (sugerencias.length === 0) return null;
                    return (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                        <p className="text-xs text-slate-400 px-3 pt-2 pb-1 border-b border-slate-100">
                          Asociados con ahorro voluntario
                        </p>
                        {sugerencias.map((s: any) => (
                          <button
                            key={s.asociado_id}
                            type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-purple-50 flex items-center justify-between group transition-colors"
                            onMouseDown={() => {
                              h.setSearchTerm(s.asociado);
                              h.setCurrentPage(1);
                              h.setShowSearchSuggestions(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Wallet className="size-3.5 text-purple-400" />
                              <span className="text-sm font-medium text-slate-800 group-hover:text-purple-700">
                                {s.asociado}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400">{s.cedula}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap gap-3 items-center">
                <Select
                  value={h.filterEstado}
                  onValueChange={(v) => { h.setFilterEstado(v === 'todos' ? '' : v); h.setCurrentPage(1); }}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={h.sortBy}
                  onValueChange={(value: any) => { h.setSortBy(value); h.setCurrentPage(1); }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Ordenar por..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Sin ordenar</SelectItem>
                    <SelectItem value="fecha-desc">Fecha (más reciente)</SelectItem>
                    <SelectItem value="fecha-asc">Fecha (más antigua)</SelectItem>
                    <SelectItem value="monto-desc">Monto (mayor a menor)</SelectItem>
                    <SelectItem value="monto-asc">Monto (menor a mayor)</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500 whitespace-nowrap">Desde:</Label>
                  <Input
                    type="date"
                    value={h.filterFechaInicio}
                    onChange={(e) => { h.setFilterFechaInicio(e.target.value); h.setCurrentPage(1); }}
                    className="w-40 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500 whitespace-nowrap">Hasta:</Label>
                  <Input
                    type="date"
                    value={h.filterFechaFin}
                    onChange={(e) => { h.setFilterFechaFin(e.target.value); h.setCurrentPage(1); }}
                    className="w-40 text-sm"
                  />
                </div>

                {h.hayFiltros && (
                  <Button variant="outline" size="sm" onClick={h.limpiarFiltros} className="gap-1 text-slate-500">
                    <X className="size-3" /> Limpiar
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="activos" className="w-full">
              <TabsList className="grid w-full mb-4 grid-cols-2">
                <TabsTrigger value="activos" className="gap-2">
                  <Wallet className="size-4" /> Ahorros Activos ({h.sortedAhorros.length})
                </TabsTrigger>
                <TabsTrigger value="anulados" className="gap-2">
                  <FileText className="size-4" /> Ahorros Anulados ({h.filteredAhorrosAnulados.length})
                </TabsTrigger>
              </TabsList>

              {/* ── Activos ── */}
              <TabsContent value="activos" className="space-y-4">
                <AhorroVoluntarioTabla
                  ahorrosList={h.currentAhorros}
                  isAnulados={false}
                  userRole={userRole}
                  onOpenDetail={h.handleOpenDetail}
                  onDeposito={h.openDeposito}
                  onRetiro={h.openRetiro}
                  onEdit={h.handleOpenEdit}
                  onAnular={h.handleOpenAnularDialog}
                  onToggleEstado={(ahorro) => {
                    h.setSelectedItem(ahorro);
                    h.setJustificacionAnulacion('');
                    h.setIsToggleEstadoDialogOpen(true);
                  }}
                  onOpenPDF={h.handleOpenPDF}
                  hayFiltros={h.hayFiltros}
                  limpiarFiltros={h.limpiarFiltros}
                  hasAnyActive={hasAnyActive}
                />
                {h.sortedAhorros.length > 0 && (
                  <AhorroVoluntarioPaginacion
                    totalPages={h.totalPages}
                    currentPage={h.currentPage}
                    setCurrentPage={h.setCurrentPage}
                    startIndex={h.startIndex}
                    endIndex={h.endIndex}
                    totalCount={h.sortedAhorros.length}
                  />
                )}
              </TabsContent>

              {/* ── Anulados ── */}
              <TabsContent value="anulados" className="space-y-4">
                <AhorroVoluntarioTabla
                  ahorrosList={h.currentAhorrosAnulados}
                  isAnulados={true}
                  userRole={userRole}
                  onOpenDetail={h.handleOpenDetail}
                  onDeposito={h.openDeposito}
                  onRetiro={h.openRetiro}
                  onEdit={h.handleOpenEdit}
                  onAnular={h.handleOpenAnularDialog}
                  onToggleEstado={(ahorro) => {
                    h.setSelectedItem(ahorro);
                    h.setJustificacionAnulacion('');
                    h.setIsToggleEstadoDialogOpen(true);
                  }}
                  onOpenPDF={h.handleOpenPDF}
                  hayFiltros={h.hayFiltros}
                  limpiarFiltros={h.limpiarFiltros}
                  hasAnyActive={hasAnyActive}
                />
                {h.filteredAhorrosAnulados.length > 0 && (
                  <AhorroVoluntarioPaginacion
                    totalPages={h.totalPagesAnulados}
                    currentPage={h.currentPageAnulados}
                    setCurrentPage={h.setCurrentPageAnulados}
                    startIndex={h.startIndexAnulados}
                    endIndex={h.endIndexAnulados}
                    totalCount={h.filteredAhorrosAnulados.length}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Auditoría de Cambios (solo admin) ── */}
        {userRole === 'admin' && (() => {
          const AUDITORIA_PER_PAGE = 5;

          const ACTION_CFG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string; dot: string }> = {
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

          const conteoPorAccion = (h.historialCambiosGeneralVoluntario || []).reduce((acc, e) => {
            const k = normalizeAction(e.accion);
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          const auditFiltrada = auditFiltro === 'todos' 
            ? (h.historialCambiosGeneralVoluntario || []) 
            : (h.historialCambiosGeneralVoluntario || []).filter(e => normalizeAction(e.accion) === auditFiltro);

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
                    <div className="p-2 bg-purple-100 dark:bg-purple-950 rounded-lg shrink-0">
                      <History className="size-5 text-purple-600 dark:text-purple-450" />
                    </div>
                    <div>
                      <CardTitle>Historial de Cambios</CardTitle>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {h.historialCambiosGeneralVoluntario?.length || 0} registro{h.historialCambiosGeneralVoluntario?.length !== 1 ? 's' : ''}
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
                {historialAbierto && (h.historialCambiosGeneralVoluntario?.length || 0) > 0 && (
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
                        {h.historialCambiosGeneralVoluntario?.length || 0}
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
                          <span className={`font-bold ${activo ? '' : 'text-slate-400'}`}>{count as number}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardHeader>

              {historialAbierto && (
                <CardContent>
                  {(h.historialCambiosGeneralVoluntario || []).length === 0 ? (
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
                              className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              «
                            </button>
                            <button
                              onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                              disabled={auditPage === 1}
                              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              ‹ Ant.
                            </button>
                            <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-850 rounded-lg">
                              {auditPage} / {totalAudPaginas}
                            </span>
                            <button
                              onClick={() => setAuditPage(p => Math.min(totalAudPaginas, p + 1))}
                              disabled={auditPage === totalAudPaginas}
                              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Diálogos ─────────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      <AhorroVoluntarioDialogCrear
        isCreateDialogOpen={h.isCreateDialogOpen}
        setIsCreateDialogOpen={h.setIsCreateDialogOpen}
        selectedItem={h.selectedItem}
        setSelectedItem={h.setSelectedItem}
        formAsociadoId={h.formAsociadoId}
        formSaldoInicial={h.formSaldoInicial}
        formFechaInicio={h.formFechaInicio}
        setFormFechaInicio={h.setFormFechaInicio}
        autocompleteSearch={h.autocompleteSearch}
        setAutocompleteSearch={h.setAutocompleteSearch}
        setFormAsociadoId={h.setFormAsociadoId}
        showAutocomplete={h.showAutocomplete}
        setShowAutocomplete={h.setShowAutocomplete}
        autocompleteRef={h.autocompleteRef}
        autocompleteSuggestions={h.autocompleteSuggestions}
        asociadosDisponibles={h.asociadosDisponibles}
        handleSelectAsociado={h.handleSelectAsociado}
        formFrecuencia={h.formFrecuencia}
        setFormFrecuencia={h.setFormFrecuencia}
        formMontoObjetivo={h.formMontoObjetivo}
        setFormMontoObjetivo={h.setFormMontoObjetivo}
        handleSaldoInicialChange={h.handleSaldoInicialChange}
        handleSaldoInicialBlur={h.handleSaldoInicialBlur}
        handleSaveAhorro={h.handleSaveAhorro}
      />

      <AhorroVoluntarioDialogDetalle
        isDetailDialogOpen={h.isDetailDialogOpen}
        setIsDetailDialogOpen={h.setIsDetailDialogOpen}
        selectedItem={h.selectedItem}
        setSelectedItem={h.setSelectedItem}
        movimientosDetalle={h.movimientosDetalle}
        setMovimientosDetalle={h.setMovimientosDetalle}
        historialCambios={h.historialCambios}
        setHistorialCambios={h.setHistorialCambios}
        loadingMovimientos={h.loadingMovimientos}
        totalDepositado={h.totalDepositado}
        saldoRealMov={h.saldoRealMov}
        userRole={userRole}
        onOpenMovimiento={h.handleOpenMovimiento}
      />

      <AhorroVoluntarioDialogMovimiento
        isMovimientoDialogOpen={h.isMovimientoDialogOpen}
        setIsMovimientoDialogOpen={h.setIsMovimientoDialogOpen}
        selectedItem={h.selectedItem}
        formMovTipo={h.formMovTipo}
        formMovMonto={h.formMovMonto}
        setFormMovMonto={h.setFormMovMonto}
        formMovFecha={h.formMovFecha}
        setFormMovFecha={h.setFormMovFecha}
        formMovDesc={h.formMovDesc}
        setFormMovDesc={h.setFormMovDesc}
        formMovMetodo={h.formMovMetodo}
        setFormMovMetodo={h.setFormMovMetodo}
        savingMovimiento={h.savingMovimiento}
        montoMinimo={h.montoMinimo}
        handleRegistrarMovimiento={h.handleRegistrarMovimiento}
      />

      {/* ── Notificación por email tras anulación ────────────────────────── */}
      <Dialog
        open={!!h.anulacionEmailData}
        onOpenChange={(open) => { if (!open) h.setAnulacionEmailData(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5 text-purple-600" />
              Notificar al asociado por email
            </DialogTitle>
            <DialogDescription>
              El ahorro voluntario fue anulado. ¿Deseas enviar un correo al asociado informando la
              cancelación?
            </DialogDescription>
          </DialogHeader>
          {h.anulacionEmailData && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Destinatario:</span>
                  <span className="font-medium text-slate-800">{h.anulacionEmailData.nombre}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-medium text-slate-800">{h.anulacionEmailData.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Saldo anulado:</span>
                  <span className="font-medium text-red-600">
                    {formatCurrency(h.anulacionEmailData.saldo)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Al hacer clic en «Abrir Gmail» se abrirá una nueva ventana con el borrador
                prellenado. Puedes revisar y enviar desde tu cuenta de Gmail.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => h.setAnulacionEmailData(null)}>
              Omitir
            </Button>
            <Button
              className="gap-2 bg-purple-600 hover:bg-purple-700"
              onClick={() => {
                if (!h.anulacionEmailData) return;
                const { email, nombre, saldo, motivo } = h.anulacionEmailData;
                const asunto = encodeURIComponent(
                  'UFCA — Anulación de tu plan de ahorro voluntario'
                );
                const fechaHoy = new Date().toLocaleDateString('es-CO', {
                  day: '2-digit', month: 'long', year: 'numeric',
                });
                const cuerpo = encodeURIComponent(
                  `Estimado(a) ${nombre},\n\n` +
                  `Te informamos que tu plan de ahorro voluntario en la UFCA ha sido anulado el ${fechaHoy}.\n\n` +
                  `Motivo: "${motivo}"\n\n` +
                  `Saldo al momento de la anulación: ${formatCurrency(saldo)}\n\n` +
                  `Si tienes alguna pregunta o deseas más información, comunícate con la administración.\n\n` +
                  `Atentamente,\nAdministración UFCA`
                );
                const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${asunto}&body=${cuerpo}`;
                window.open(gmailUrl, '_blank');
                h.setAnulacionEmailData(null);
              }}
            >
              <Mail className="size-4" />
              Abrir Gmail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AhorroVoluntarioAlertDialogs
        // Anular
        isDeleteDialogOpen={h.isDeleteDialogOpen}
        setIsDeleteDialogOpen={h.setIsDeleteDialogOpen}
        selectedItem={h.selectedItem}
        setSelectedItem={h.setSelectedItem}
        justificacionAnulacion={h.justificacionAnulacion}
        setJustificacionAnulacion={h.setJustificacionAnulacion}
        handleAnular={h.handleAnular}
        // Toggle estado
        isToggleEstadoDialogOpen={h.isToggleEstadoDialogOpen}
        setIsToggleEstadoDialogOpen={h.setIsToggleEstadoDialogOpen}
        handleToggleEstado={h.handleToggleEstado}
        // Saldo bajo
        isConfirmSaldoBajoVolOpen={h.isConfirmSaldoBajoVolOpen}
        setIsConfirmSaldoBajoVolOpen={h.setIsConfirmSaldoBajoVolOpen}
        formSaldoInicial={h.formSaldoInicial}
        montoMinimo={h.montoMinimo}
        handleSaveAhorro={h.handleSaveAhorro}
        // Movimiento bajo
        isConfirmMovBajoVolOpen={h.isConfirmMovBajoVolOpen}
        setIsConfirmMovBajoVolOpen={h.setIsConfirmMovBajoVolOpen}
        formMovMonto={h.formMovMonto}
        ejecutarRegistrarMovimiento={h.ejecutarRegistrarMovimiento}
        // PDF
        isPdfPreviewOpen={h.isPdfPreviewOpen}
        setIsPdfPreviewOpen={h.setIsPdfPreviewOpen}
        pdfPreviewUrl={h.pdfPreviewUrl}
        setPdfPreviewUrl={h.setPdfPreviewUrl}
        pdfPreviewFilename={h.pdfPreviewFilename}
        pdfDownloadFn={h.pdfDownloadFn}
        setPdfDownloadFn={h.setPdfDownloadFn}
        // Rechazar sol vol
        isRechazarVolOpen={h.isRechazarVolOpen}
        setIsRechazarVolOpen={h.setIsRechazarVolOpen}
        solVolSeleccionada={h.solVolSeleccionada}
        setSolVolSeleccionada={h.setSolVolSeleccionada}
        notaRechazoVol={h.notaRechazoVol}
        setNotaRechazoVol={h.setNotaRechazoVol}
        savingSolVol={h.savingSolVol}
        handleRechazarSolicitudVol={h.handleRechazarSolicitudVol}
        // Rechazar aporte vol
        isRechazarAporteVolOpen={h.isRechazarAporteVolOpen}
        setIsRechazarAporteVolOpen={h.setIsRechazarAporteVolOpen}
        aporteVolSeleccionado={h.aporteVolSeleccionado}
        setAporteVolSeleccionado={h.setAporteVolSeleccionado}
        notaRechazoAporteVol={h.notaRechazoAporteVol}
        setNotaRechazoAporteVol={h.setNotaRechazoAporteVol}
        savingAporteVol={h.savingAporteVol}
        handleRechazarAporteVol={h.handleRechazarAporteVol}
      />
    </div>
  );
}
