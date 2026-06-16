import React, { useState, useEffect, useRef } from 'react';
import { useLiquidacionesCRUD } from './useLiquidacionesCRUD';
import { useLiquidacionesDocs, useLiquidacionesAudit } from './useLiquidacionesDocsAndAudit';
import { useLiquidacionStepper } from './useLiquidacionStepper';
import { useLiquidacionAnular } from './useLiquidacionAnular';

import { LiquidacionTabla } from './LiquidacionTabla';
import { LiquidacionDialogCrear } from './LiquidacionDialogCrear';
import { LiquidacionDialogDetalle } from './LiquidacionDialogDetalle';
import { LiquidacionDialogs } from './LiquidacionDialogs';

interface LiquidacionProps {
  userData?: any;
  esVistaPropia?: boolean;
}

export default function Liquidacion({ userData, esVistaPropia }: LiquidacionProps) {
  // Permisos básicos
  const permisosList = Array.isArray(userData?.permisos) ? userData.permisos : [];
  const can = (perm: string) => permisosList.includes(perm) || permisosList.includes(perm + 'es') || userData?.rol === 'admin' || userData?.rol === 'administrador';

  // Deducir esVistaPropia final
  const esVistaPropiaFinal = esVistaPropia !== undefined ? esVistaPropia : !can('liquidacion');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // ── Hooks ──
  const crud = useLiquidacionesCRUD({ esVistaPropia: esVistaPropiaFinal, userData });
  const docs = useLiquidacionesDocs(userData, crud.setLiquidaciones);
  const audit = useLiquidacionesAudit(userData);
  
  const stepper = useLiquidacionStepper({ 
    userData, 
    setLiquidaciones: crud.setLiquidaciones, 
    setIsCreateOpen, 
    cargarDatos: crud.cargarDatos, 
    registrarAuditLiq: audit.registrarAuditLiq 
  });
  
  const anular = useLiquidacionAnular(
    userData, 
    crud.setLiquidaciones, 
    audit.registrarAuditLiq
  );

  // Shared file ref para UploadDoc (distinto del crear)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar datos iniciales
  useEffect(() => {
    crud.cargarDatos();
  }, []);

  // Computed para la tabla
  const activas = crud.applyFilters(crud.liquidaciones.filter(l => !l.anulado));
  const anuladas = crud.applyFilters(crud.liquidaciones.filter(l => l.anulado));
  const todasActivas = crud.liquidaciones.filter(l => !l.anulado);
  const pagActivas = activas.slice((crud.currentPage - 1) * crud.itemsPerPage, crud.currentPage * crud.itemsPerPage);
  const pagAnuladas = anuladas.slice((crud.currentPageAnuladas - 1) * crud.itemsPerPage, crud.currentPageAnuladas * crud.itemsPerPage);
  const totalPagActivas = Math.ceil(activas.length / crud.itemsPerPage);
  const totalPagAn = Math.ceil(anuladas.length / crud.itemsPerPage);
  const montoTotal = todasActivas.reduce((s, l) => s + (l.montoFinal ?? 0), 0);
  const cantPagadas = todasActivas.filter(l => l.estado === 'Pagada').length;
  const cantPendientes = todasActivas.filter(l => l.estado === 'En proceso' || l.estado === 'Pendiente').length;

  // Selected item management (shared among dialogs)
  const setSelectedItem = (item: any) => {
    docs.setSelectedItem(item);
    anular.setSelectedItem(item);
  };
  
  const handleCambiarEstado = async (liq: any, nuevoEstado: string) => {
     await crud.handleCambiarEstado(liq, nuevoEstado, audit.registrarAuditLiq);
     if (docs.selectedItem?.id === liq.id) {
       docs.setSelectedItem((prev: any) => ({ ...prev, estado: nuevoEstado }));
     }
  };

  return (
    <>
      <LiquidacionTabla
        esVistaPropia={esVistaPropiaFinal}
        can={can}
        liquidaciones={crud.liquidaciones}
        loading={crud.loading}
        isSearching={crud.isSearching}
        searchTerm={crud.searchTerm} setSearchTerm={crud.setSearchTerm}
        filterEstado={crud.filterEstado} setFilterEstado={crud.setFilterEstado}
        filterTipo={crud.filterTipo} setFilterTipo={crud.setFilterTipo}
        filterDesde={crud.filterDesde} setFilterDesde={crud.setFilterDesde}
        filterHasta={crud.filterHasta} setFilterHasta={crud.setFilterHasta}
        filterRegDesde={crud.filterRegDesde} setFilterRegDesde={crud.setFilterRegDesde}
        filterRegHasta={crud.filterRegHasta} setFilterRegHasta={crud.setFilterRegHasta}
        dateRangeError={crud.dateRangeError}
        sortBy={crud.sortBy} setSortBy={crud.setSortBy}
        pagActivas={pagActivas}
        pagAnuladas={pagAnuladas}
        currentPage={crud.currentPage} setCurrentPage={crud.setCurrentPage}
        totalPagActivas={totalPagActivas}
        currentPageAnuladas={crud.currentPageAnuladas} setCurrentPageAnuladas={crud.setCurrentPageAnuladas}
        totalPagAn={totalPagAn}
        montoTotal={montoTotal}
        cantPagadas={cantPagadas}
        cantPendientes={cantPendientes}
        setIsCreateOpen={setIsCreateOpen}
        setSelectedItem={setSelectedItem}
        setIsDetailOpen={(b) => {
          if(b && docs.selectedItem) {
            docs.cargarDocumentos(docs.selectedItem.id);
            audit.cargarAuditoria(docs.selectedItem.id);
          }
          setIsDetailOpen(b);
        }}
        setIsAnularOpen={anular.setIsAnularOpen}
        setIsUploadDocOpen={docs.setIsUploadDocOpen}
      />

      <LiquidacionDialogCrear
        isCreateOpen={isCreateOpen}
        setIsCreateOpen={setIsCreateOpen}
        resetForm={stepper.resetForm}
        formStep={stepper.formStep} setFormStep={stepper.setFormStep}
        formAsocSearch={stepper.formAsocSearch} setFormAsocSearch={stepper.setFormAsocSearch}
        formAsociadoId={stepper.formAsociadoId} setFormAsociadoId={stepper.setFormAsociadoId}
        showAcomplete={stepper.showAcomplete} setShowAcomplete={stepper.setShowAcomplete}
        acSuggestions={crud.asociadosDisponibles.filter(a => a.estado_cuenta !== 'inactivo' && (a.nombre.toLowerCase().includes(stepper.formAsocSearch.toLowerCase()) || a.cedula.includes(stepper.formAsocSearch))).slice(0, 8)}
        handleSelectAsociado={stepper.handleSelectAsociado}
        datosAsocLoading={stepper.datosAsocLoading}
        formTipo={stepper.formTipo} setFormTipo={stepper.setFormTipo}
        formFechaCorte={stepper.formFechaCorte} setFormFechaCorte={stepper.setFormFechaCorte}
        formFechaLiq={stepper.formFechaLiq} setFormFechaLiq={stepper.setFormFechaLiq}
        formMotivo={stepper.formMotivo} setFormMotivo={stepper.setFormMotivo}
        formObservaciones={stepper.formObservaciones} setFormObservaciones={stepper.setFormObservaciones}
        formArchivoFile={stepper.formArchivoFile} setFormArchivoFile={stepper.setFormArchivoFile}
        dragOver={stepper.dragOver} setDragOver={stepper.setDragOver}
        handleFileSelect={stepper.handleFileSelect}
        fileRef={stepper.fileRef} acRef={stepper.acRef}
        irAPaso2={stepper.irAPaso2}
        formAhorroPerm={stepper.formAhorroPerm} setFormAhorroPerm={stepper.setFormAhorroPerm}
        formAhorroVol={stepper.formAhorroVol} setFormAhorroVol={stepper.setFormAhorroVol}
        formAhorros={stepper.formAhorros} setFormAhorros={stepper.setFormAhorros}
        formUtilidades={stepper.formUtilidades} setFormUtilidades={stepper.setFormUtilidades}
        formCreditoPend={stepper.formCreditoPend} setFormCreditoPend={stepper.setFormCreditoPend}
        setConceptosGenerados={() => {}}
        generando={stepper.generando} irAPaso3={stepper.irAPaso3}
        formConceptos={stepper.formConceptos}
        addConcepto={stepper.addConcepto} updateConcepto={stepper.updateConcepto} removeConcepto={stepper.removeConcepto}
        montoCalculado={stepper.montoCalculado}
        saving={stepper.saving} handleSave={stepper.handleSave}
        alertConfig={stepper.alertConfig} setAlertConfig={stepper.setAlertConfig}
      />

      <LiquidacionDialogDetalle
        isDetailOpen={isDetailOpen} setIsDetailOpen={setIsDetailOpen}
        selectedItem={docs.selectedItem} setSelectedItem={setSelectedItem}
        esVistaPropia={esVistaPropiaFinal}
        docsLiquidacion={docs.docsLiquidacion} setDocsLiquidacion={() => {}}
        loadingDocs={docs.loadingDocs}
        auditEntries={audit.auditEntries} setAuditEntries={() => {}}
        loadingAudit={audit.loadingAudit}
        auditOpen={audit.auditOpen} setAuditOpen={audit.setAuditOpen}
        setIsUploadDocOpen={docs.setIsUploadDocOpen}
        setUploadDocNombre={docs.setUploadDocNombre}
        setUploadDocFile={docs.setUploadDocFile}
        handleDeleteDoc={(id) => docs.handleDeleteDoc(id, audit.registrarAuditLiq)}
        handleCambiarEstado={handleCambiarEstado}
        setIsAnularOpen={anular.setIsAnularOpen}
        setJustificacionAnulacion={anular.setJustificacionAnulacion}
      />

      <LiquidacionDialogs
        isPdfPreviewOpen={isPdfPreviewOpen} setIsPdfPreviewOpen={setIsPdfPreviewOpen}
        pdfPreviewUrl={pdfPreviewUrl} selectedItem={docs.selectedItem}
        isAnularOpen={anular.isAnularOpen} setIsAnularOpen={anular.setIsAnularOpen}
        justificacionAnulacion={anular.justificacionAnulacion} setJustificacionAnulacion={anular.setJustificacionAnulacion}
        anulando={anular.anulando} handleAnular={anular.handleAnular}
        isUploadDocOpen={docs.isUploadDocOpen} setIsUploadDocOpen={docs.setIsUploadDocOpen}
        uploadDocFile={docs.uploadDocFile} uploadDocNombre={docs.uploadDocNombre} setUploadDocNombre={docs.setUploadDocNombre}
        uploadingDoc={docs.uploadingDoc}
        handleUploadDoc={() => docs.handleUploadDoc(audit.registrarAuditLiq, handleCambiarEstado)}
        handleFileSelect={(f) => {
          if (f.size > 10 * 1024 * 1024) return;
          docs.setUploadDocFile(f);
        }}
        fileInputRef={fileInputRef}
      />
    </>
  );
}
