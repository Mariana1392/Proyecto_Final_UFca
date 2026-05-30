// ── AhorroPermanente.tsx ──────────────────────────────────────────────────────
// Orquestador del módulo de ahorro permanente.
// Toda la lógica de estado y handlers vive en useAhorroPermanente.
// Los sub-componentes están en src/components/ahorro-permanente/.

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Search, Plus, Edit, Check, PiggyBank, ClipboardList } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

import type { UserRole } from '../../contexts/AuthContext';
import { useAhorroPermanente } from './useAhorroPermanente';
import { formatCurrency } from '../../lib/formatters';

// Sub-componentes
import AhorroTabla              from './AhorroTabla';
import AhorroTabSolicitudes     from './AhorroTabSolicitudes';
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

  // ── Pantalla de carga ──────────────────────────────────────────────────────
  if (h.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando ahorros permanentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
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
              <TabsList className={`grid w-full mb-4 ${userRole === 'admin' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <TabsTrigger value="activos" className="gap-2">
                  <PiggyBank className="size-4" />
                  Ahorros Activos ({h.filteredAhorros.length})
                </TabsTrigger>
                <TabsTrigger value="anulados" className="gap-2">
                  <PiggyBank className="size-4" />
                  Ahorros Anulados ({h.filteredAhorrosAnulados.length})
                </TabsTrigger>
                {userRole === 'admin' && (
                  <TabsTrigger value="solicitudes" className="gap-2">
                    <ClipboardList className="size-4" />
                    Solicitudes
                    {(
                      h.solicitudes.filter(s => s.estado === 'pendiente').length +
                      h.aportesPendientes.filter(a => a.estado === 'pendiente').length
                    ) > 0 && (
                      <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {h.solicitudes.filter(s => s.estado === 'pendiente').length +
                          h.aportesPendientes.filter(a => a.estado === 'pendiente').length}
                      </span>
                    )}
                  </TabsTrigger>
                )}
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

              {/* Tab: solicitudes (solo admin) */}
              {userRole === 'admin' && (
                <TabsContent value="solicitudes">
                  <AhorroTabSolicitudes
                    solicitudes={h.solicitudes}
                    handleAprobarSolicitud={h.handleAprobarSolicitud}
                    setSolicitudSeleccionada={h.setSolicitudSeleccionada}
                    setNotaRechazo={h.setNotaRechazo}
                    setIsRechazarDialogOpen={h.setIsRechazarDialogOpen}
                    aportesPendientes={h.aportesPendientes}
                    handleConfirmarAporte={h.handleConfirmarAporte}
                    setAporteSeleccionado={h.setAporteSeleccionado}
                    setNotaRechazoAporte={h.setNotaRechazoAporte}
                    setIsRechazarAporteOpen={h.setIsRechazarAporteOpen}
                  />
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* ══ Diálogos ══════════════════════════════════════════════════════════ */}

      {/* Crear / Editar */}
      <AhorroDialogCrear
        open={h.isCreateDialogOpen}
        onClose={h.closeCreateDialog}
        selectedItem={h.selectedItem}
        formAsociadoId={h.formAsociadoId}
        setFormAsociadoId={h.setFormAsociadoId}
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
