// ── AhorroVoluntario.tsx (orquestador) ───────────────────────────────────────
// Componente principal: encabezado, filtros, pestañas y renderizado de sub-componentes.

import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Search, Plus, Wallet, FileText, ClipboardList, X, Mail } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { formatCurrency } from '../../lib/formatters';
import type { UserRole } from '../../contexts/AuthContext';

import { useAhorroVoluntario } from './useAhorroVoluntario';
import AhorroVoluntarioTabla, { AhorroVoluntarioPaginacion } from './AhorroVoluntarioTabla';
import AhorroVoluntarioSolicitudes from './AhorroVoluntarioSolicitudes';
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

  // ── Pantalla de carga ──────────────────────────────────────────────────────
  if (h.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando ahorros voluntarios...</p>
        </div>
      </div>
    );
  }

  const hasAnyActive = h.ahorros.filter((a: any) => !a.anulado).length > 0;
  const pendientesSolicitudes =
    h.solicitudesVol.filter((s: any) => s.estado === 'pendiente').length +
    h.aportesPendientesVol.filter((a: any) => a.estado === 'pendiente').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
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
                h.setFormFechaInicio('');
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
              <TabsList className={`grid w-full mb-4 ${userRole === 'admin' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="activos" className="gap-2">
                  <Wallet className="size-4" /> Ahorros Activos ({h.sortedAhorros.length})
                </TabsTrigger>
                <TabsTrigger value="anulados" className="gap-2">
                  <FileText className="size-4" /> Ahorros Anulados ({h.filteredAhorrosAnulados.length})
                </TabsTrigger>
                {userRole === 'admin' && (
                  <TabsTrigger value="solicitudes" className="gap-2">
                    <ClipboardList className="size-4" />
                    Solicitudes
                    {pendientesSolicitudes > 0 && (
                      <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {pendientesSolicitudes}
                      </span>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>

              {/* ── Activos ── */}
              <TabsContent value="activos" className="space-y-4">
                <AhorroVoluntarioTabla
                  ahorrosList={h.currentAhorros}
                  isAnulados={false}
                  userRole={userRole}
                  onOpenDetail={h.handleOpenDetail}
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

              {/* ── Solicitudes (solo admin) ── */}
              {userRole === 'admin' && (
                <TabsContent value="solicitudes" className="space-y-6">
                  <AhorroVoluntarioSolicitudes
                    solicitudesVol={h.solicitudesVol}
                    handleAprobarSolicitudVol={h.handleAprobarSolicitudVol}
                    setSolVolSeleccionada={h.setSolVolSeleccionada}
                    setNotaRechazoVol={h.setNotaRechazoVol}
                    setIsRechazarVolOpen={h.setIsRechazarVolOpen}
                    aportesPendientesVol={h.aportesPendientesVol}
                    handleConfirmarAporteVol={h.handleConfirmarAporteVol}
                    setAporteVolSeleccionado={h.setAporteVolSeleccionado}
                    setNotaRechazoAporteVol={h.setNotaRechazoAporteVol}
                    setIsRechazarAporteVolOpen={h.setIsRechazarAporteVolOpen}
                  />
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
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
