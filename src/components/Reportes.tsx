import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { FileText, Download, Calendar, Search, PiggyBank, FileSpreadsheet, User, CheckCircle2, TrendingUp, Printer, Loader2 } from 'lucide-react';
import { formatCurrency } from '../lib/formatters';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { dashboardApi } from '../lib/api';
import ExcelJS from 'exceljs';

interface Asociado {
  id: string;
  nombre: string;
  cedula: string;
}

export default function Reportes() {
  const [activeTab, setActiveTab] = useState('extractos');

  // Buscador de asociados
  const [searchTerm, setSearchTerm] = useState('');
  const [asociados, setAsociados] = useState<Asociado[]>([]);
  const [selectedAsociado, setSelectedAsociado] = useState<Asociado | null>(null);
  
  // Datos del asociado
  const [ahorroPermanente, setAhorroPermanente] = useState<any>(null);
  const [ahorroVoluntario, setAhorroVoluntario] = useState<any>(null);
  const [creditos, setCreditos] = useState<any[]>([]);

  // Filtros de fecha
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0]);

  // PDF Preview
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfPreviewFilename, setPdfPreviewFilename] = useState('');
  const [pdfPreviewType, setPdfPreviewType] = useState<'extracto' | 'consolidado'>('extracto');

  // Estados de carga
  const [loadingAsociados, setLoadingAsociados] = useState(false);
  const [loadingDatos, setLoadingDatos] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingPdfConsolidado, setGeneratingPdfConsolidado] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Utilidades
  const [utilidadesData, setUtilidadesData] = useState<any>(null);
  const [loadingUtilidades, setLoadingUtilidades] = useState(false);

  // Buscar asociados
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!showDropdown && searchTerm.length === 0) return;
    
    if (searchTerm.length > 0 && searchTerm.length < 3) {
      if (searchTerm.length === 0) setAsociados([]);
      return;
    }
    const fetchAsociados = async () => {
      setLoadingAsociados(true);
      try {
        const { data: rolAsoc } = await supabase
          .from('roles').select('id').eq('nombre', 'asociado').limit(1).maybeSingle();
        
        let query = supabase
          .from('usuarios')
          .select('id, nombre, cedula')
          .order('nombre', { ascending: true })
          .limit(searchTerm ? 10 : 50);
          
        if (searchTerm) {
          query = query.or(`nombre.ilike.%${searchTerm}%,cedula.ilike.%${searchTerm}%`);
        }

        if (rolAsoc?.id) {
          query = query.eq('rol_id', rolAsoc.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        setAsociados(data || []);
      } catch (err) {
        console.error('Error buscando asociados:', err);
      } finally {
        setLoadingAsociados(false);
      }
    };
    const timer = setTimeout(fetchAsociados, searchTerm ? 400 : 0);
    return () => clearTimeout(timer);
  }, [searchTerm, showDropdown]);

  // Cargar utilidades
  useEffect(() => {
    async function loadUtilidades() {
      setLoadingUtilidades(true);
      try {
        const data = await dashboardApi.getUtilidadesMora();
        setUtilidadesData(data);
      } catch (err) {
        console.error('Error cargando utilidades:', err);
      } finally {
        setLoadingUtilidades(false);
      }
    }
    loadUtilidades();
  }, []);

  // Cargar datos al seleccionar asociado
  useEffect(() => {
    if (!selectedAsociado) {
      setAhorroPermanente(null);
      setAhorroVoluntario(null);
      setCreditos([]);
      return;
    }
    const cargarDatos = async () => {
      setLoadingDatos(true);
      try {
        // Ahorros
        const { data: ahorros, error: errAhorros } = await supabase
          .from('cuentas_ahorro')
          .select('*')
          .eq('asociado_id', selectedAsociado.id);
        
        if (errAhorros) throw errAhorros;

        const perm = ahorros?.find(a => a.tipo === 'permanente');
        const vol = ahorros?.find(a => a.tipo === 'voluntario');
        setAhorroPermanente(perm || null);
        setAhorroVoluntario(vol || null);

        // Créditos
        const { data: creds, error: errCreds } = await supabase
          .from('creditos')
          .select('*')
          .eq('asociado_id', selectedAsociado.id);
        
        if (errCreds) throw errCreds;
        setCreditos(creds || []);

      } catch (err) {
        console.error('Error cargando datos del asociado:', err);
        toast.error('No se pudieron cargar los datos del asociado');
      } finally {
        setLoadingDatos(false);
      }
    };
    cargarDatos();
  }, [selectedAsociado]);

  const generarExtractoPdf = async () => {
    if (!selectedAsociado) return toast.error('Selecciona un asociado');
    if (!fechaInicio || !fechaFin) return toast.error('Selecciona un rango de fechas');

    setGeneratingPdf(true);
    try {
      // 1. Obtener transacciones en el rango
      const { data: transacciones, error } = await supabase
        .from('transacciones')
        .select('*')
        .eq('asociado_id', selectedAsociado.id)
        .gte('fecha_pago', fechaInicio)
        .lte('fecha_pago', fechaFin)
        .order('fecha_pago', { ascending: true });

      if (error) throw error;

      // 2. Generar PDF
      const doc = new jsPDF();
      
      // Header Bar - Slate/Navy Corporate design
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 42, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      doc.text('UFCA', 20, 20);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('Unión Familiar de Crédito y Ahorro', 20, 29);
      
      // Right side document type details
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('EXTRACTO DE CUENTA', 190, 20, { align: 'right' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('DOCUMENTO OFICIAL DIGITAL', 190, 29, { align: 'right' });

      // Divider Line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(20, 52, 190, 52);

      // Metadata section (two columns)
      // Left Column: Asociado
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('INFORMACIÓN DEL ASOCIADO', 20, 60);
      
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont('helvetica', 'bold');
      doc.text(selectedAsociado.nombre, 20, 67);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text(`Identificación: C.C. ${selectedAsociado.cedula}`, 20, 73);
      doc.text('Estado: ASOCIADO ACTIVO', 20, 79);

      // Right Column: Periodo & Fecha de Emision
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('PERIODO DE CONSULTA', 115, 60);
      
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.text(`Desde:  ${fechaInicio}`, 115, 67);
      doc.text(`Hasta:   ${fechaFin}`, 115, 73);
      doc.text(`Generado: ${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'})}`, 115, 79);

      let yPos = 88;

      // Resumen Ahorros y Créditos (Card container)
      const totalCreditos = creditos.reduce((sum, c) => sum + (c.saldo || 0), 0);

      // Background Box
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(20, yPos, 170, 36, 4, 4, 'F');
      
      doc.setDrawColor(241, 245, 249); // slate-100
      doc.setLineWidth(0.5);
      doc.roundedRect(20, yPos, 170, 36, 4, 4, 'S');

      // Column 1: Ahorro Permanente
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('AHORRO PERMANENTE', 25, yPos + 10);
      doc.setFontSize(11);
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text(formatCurrency(ahorroPermanente?.monto_ahorrado || 0), 25, yPos + 18);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Estado: ${ahorroPermanente?.estado ? ahorroPermanente.estado.toUpperCase() : 'SIN CUENTA'}`, 25, yPos + 26);

      // Column 2: Ahorro Voluntario
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('AHORRO VOLUNTARIO', 80, yPos + 10);
      doc.setFontSize(11);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text(formatCurrency(ahorroVoluntario?.monto_ahorrado || 0), 80, yPos + 18);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Estado: ${ahorroVoluntario?.estado ? ahorroVoluntario.estado.toUpperCase() : 'SIN CUENTA'}`, 80, yPos + 26);

      // Column 3: Saldo Créditos
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('SALDO DEUDOR CRÉDITOS', 135, yPos + 10);
      doc.setFontSize(11);
      doc.setTextColor(217, 119, 6); // amber-650
      doc.text(formatCurrency(totalCreditos), 135, yPos + 18);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const credsActivosCount = creditos.filter(c => c.estado === 'activo' || c.estado === 'desembolsado').length;
      doc.text(`${credsActivosCount} crédito(s) activo(s)`, 135, yPos + 26);

      yPos += 48;

      // Tabla de Movimientos
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('DETALLE DE MOVIMIENTOS EN EL PERIODO', 20, yPos);
      yPos += 4;

      const tableData = (transacciones || []).map(t => [
        t.fecha_pago,
        t.tipo.replace(/_/g, ' ').toUpperCase(),
        t.metodo_pago ? t.metodo_pago.toUpperCase() : '—',
        t.monto > 0 ? formatCurrency(t.monto) : '—',
        t.monto < 0 ? formatCurrency(Math.abs(t.monto)) : '—'
      ]);

      if (tableData.length === 0) {
        tableData.push(['—', 'SIN MOVIMIENTOS EN ESTE PERIODO', '—', '—', '—']);
      }

      autoTable(doc, {
        startY: yPos,
        margin: { left: 20, right: 20 },
        head: [['Fecha', 'Concepto', 'Método Pago', 'Ingresos (+)', 'Egresos (-)']],
        body: tableData,
        theme: 'striped',
        styles: {
          fontSize: 8.5,
          font: 'helvetica',
          cellPadding: 4,
          textColor: [51, 65, 85], // slate-700
          lineColor: [241, 245, 249],
          lineWidth: 0.5,
        },
        headStyles: { 
          fillColor: [15, 23, 42], // slate-900 header
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          3: { halign: 'right', fontStyle: 'bold' },
          4: { halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250]
        }
      });

      // Signature/Official Stamp and Footer Section
      let finalY = (doc as any).lastAutoTable.finalY || yPos;
      
      // Check if signature section needs a new page
      if (finalY + 45 > 280) {
        doc.addPage();
        finalY = 25;
      }

      // Draw signature lines
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.setLineWidth(0.5);
      doc.line(30, finalY + 20, 85, finalY + 20);
      doc.line(125, finalY + 20, 180, finalY + 20);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Firma del Asociado', 57.5, finalY + 25, { align: 'center' });
      doc.text('Control Administrativo UFCA', 152.5, finalY + 25, { align: 'center' });
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('Este documento es un reporte digital certificado de movimientos financieros. Se genera exclusivamente para la consulta del asociado.', 105, finalY + 36, { align: 'center' });

      // Footer numbering (executed for all pages)
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generado automáticamente vía plataforma UFCA el ${new Date().toLocaleString('es-CO')}`, 20, 288);
        doc.text(`Página ${i} de ${pageCount}`, 190, 288, { align: 'right' });
      }

      const pdfOutput = doc.output('blob');
      setPdfBlob(pdfOutput);
      setPdfPreviewFilename(selectedAsociado ? `Extracto_${selectedAsociado.cedula}_${fechaInicio}_al_${fechaFin}.pdf` : 'Extracto.pdf');
      const url = URL.createObjectURL(pdfOutput);
      setPdfPreviewUrl(url);
      setPdfPreviewType('extracto');
      setIsPdfPreviewOpen(true);

    } catch (err) {
      console.error('Error generando extracto:', err);
      toast.error('Hubo un error al generar el extracto');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const descargarPdf = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = pdfPreviewFilename || (selectedAsociado ? `Extracto_${selectedAsociado.cedula}_${fechaInicio}_al_${fechaFin}.pdf` : 'Reporte.pdf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Documento descargado correctamente');
  };

  const imprimirPdf = () => {
    if (!pdfPreviewUrl) return;
    const iframe = document.getElementById('pdf-iframe-preview') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        toast.success('Abriendo diálogo de impresión...');
      } catch (err) {
        console.error('Error al imprimir desde iframe:', err);
        window.open(pdfPreviewUrl, '_blank');
      }
    } else {
      window.open(pdfPreviewUrl, '_blank');
    }
  };

  const exportarUtilidadesCsv = async () => {
    if (!utilidadesData || utilidadesData.historial.length === 0) {
      return toast.info('No hay datos de utilidades para exportar');
    }
    
    const wb = new ExcelJS.Workbook();
    wb.creator = 'UFCA - Sistema de Gestión';
    wb.created = new Date();
    const ws = wb.addWorksheet('Utilidades por Mora', { views: [{ showGridLines: false }] });

    // --- Título ---
    ws.mergeCells('A1:E1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'REPORTE DE UTILIDADES POR MORA';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 40;

    ws.mergeCells('A2:E2');
    const subtitleCell = ws.getCell('A2');
    subtitleCell.value = `UFCA — Unión Familiar de Crédito y Ahorro  •  Generado: ${new Date().toLocaleDateString('es-CO')}`;
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 25;

    // Fila vacía
    ws.addRow([]);

    // --- Resumen ---
    ws.mergeCells('A4:B4');
    const resumenTitle = ws.getCell('A4');
    resumenTitle.value = '📊 RESUMEN';
    resumenTitle.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    
    const resumenData = [
      ['Utilidades Totales:', formatCurrency(utilidadesData.utilidadTotal)],
      ['Mora en Créditos:', formatCurrency(utilidadesData.utilidadCreditos)],
      ['Mora en Ahorros:', formatCurrency(utilidadesData.utilidadAhorros)],
    ];
    resumenData.forEach((r, i) => {
      const row = ws.getRow(5 + i);
      row.getCell(1).value = r[0];
      row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
      row.getCell(2).value = r[1];
      row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF059669' } };
    });

    ws.addRow([]);
    const startRow = 9;

    // --- Headers de tabla ---
    const headers = ['#', 'Fecha', 'Asociado', 'Cédula', 'Concepto', 'Utilidad Generada'];
    const headerRow = ws.getRow(startRow);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
      cell.alignment = { horizontal: i === 5 ? 'right' : 'left', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF047857' } },
      };
    });
    headerRow.height = 28;

    // --- Datos ---
    utilidadesData.historial.forEach((r: any, idx: number) => {
      const dataRow = ws.getRow(startRow + 1 + idx);
      dataRow.getCell(1).value = idx + 1;
      dataRow.getCell(2).value = new Date(r.fecha_pago).toLocaleDateString('es-CO');
      dataRow.getCell(3).value = r.asociado?.nombre ?? 'Desconocido';
      dataRow.getCell(4).value = r.asociado?.cedula ?? 'N/A';
      dataRow.getCell(5).value = r.tipo.replace(/_/g, ' ').toUpperCase();
      dataRow.getCell(6).value = r.monto_mora;
      dataRow.getCell(6).numFmt = '$#,##0';
      dataRow.getCell(6).alignment = { horizontal: 'right' };

      const bgColor = idx % 2 === 0 ? 'FFF0FDF4' : 'FFFFFFFF';
      for (let c = 1; c <= 6; c++) {
        dataRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        dataRow.getCell(c).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
        dataRow.getCell(c).border = {
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
        };
      }
    });

    // Ancho de columnas
    ws.getColumn(1).width = 6;
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 30;
    ws.getColumn(4).width = 18;
    ws.getColumn(5).width = 28;
    ws.getColumn(6).width = 22;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Utilidades_Mora_UFCA_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Reporte de utilidades exportado a Excel');
  };

  const exportarCreditosCsv = async () => {
    setExportingCsv(true);
    try {
      const { data: creditosList, error } = await supabase
        .from('creditos')
        .select(`
          id, monto, saldo, cuota_mensual, tasa_interes, plazo_meses, estado, 
          fecha_desembolso, asociado_id
        `);

      if (error) throw error;

      if (!creditosList || creditosList.length === 0) {
        toast.info('No hay créditos registrados para exportar');
        return false;
      }

      const asocIds = [...new Set(creditosList.map((c: any) => c.asociado_id).filter(Boolean))];
      const usuariosMap: Record<string, any> = {};
      if (asocIds.length > 0) {
        const { data: usrsData } = await supabase
          .from('usuarios').select('id, nombre, cedula').in('id', asocIds);
        (usrsData || []).forEach((u: any) => { usuariosMap[u.id] = u; });
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = 'UFCA - Sistema de Gestión';
      const ws = wb.addWorksheet('Monto Créditos', { views: [{ showGridLines: false }] });

      // Título
      ws.mergeCells('A1:J1');
      const titleCell = ws.getCell('A1');
      titleCell.value = 'MONTOS DE CRÉDITOS';
      titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 40;

      ws.mergeCells('A2:J2');
      const sub = ws.getCell('A2');
      sub.value = `UFCA — Unión Familiar de Crédito y Ahorro  •  Generado: ${new Date().toLocaleDateString('es-CO')}`;
      sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
      sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      sub.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 25;

      ws.addRow([]);

      const headers = ['#', 'ID Crédito', 'Cédula', 'Nombre Asociado', 'Monto Otorgado', 'Saldo Pendiente', 'Cuota Mensual', 'Tasa (%)', 'Plazo (Meses)', 'Estado'];
      const headerRow = ws.getRow(4);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
        cell.alignment = { horizontal: [4, 5, 6, 7].includes(i) ? 'right' : 'left', vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF1D4ED8' } } };
      });
      headerRow.height = 28;

      creditosList.forEach((c: any, idx: number) => {
        const usr = usuariosMap[c.asociado_id] || {};
        const row = ws.getRow(5 + idx);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = c.id?.substring(0, 8) + '...';
        row.getCell(3).value = usr.cedula || '—';
        row.getCell(4).value = usr.nombre || '—';
        row.getCell(5).value = c.monto || 0;
        row.getCell(5).numFmt = '$#,##0';
        row.getCell(6).value = c.saldo ?? c.monto;
        row.getCell(6).numFmt = '$#,##0';
        row.getCell(7).value = c.cuota_mensual || 0;
        row.getCell(7).numFmt = '$#,##0';
        row.getCell(8).value = c.tasa_interes || 0;
        row.getCell(8).numFmt = '0.0%';
        row.getCell(9).value = c.plazo_meses || 0;
        row.getCell(10).value = (c.estado || '—').toUpperCase();

        const bgColor = idx % 2 === 0 ? 'FFEFF6FF' : 'FFFFFFFF';
        for (let col = 1; col <= 10; col++) {
          row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          row.getCell(col).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
          row.getCell(col).border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        }
      });

      ws.getColumn(1).width = 5;
      ws.getColumn(2).width = 16;
      ws.getColumn(3).width = 16;
      ws.getColumn(4).width = 30;
      ws.getColumn(5).width = 18;
      ws.getColumn(6).width = 18;
      ws.getColumn(7).width = 18;
      ws.getColumn(8).width = 12;
      ws.getColumn(9).width = 14;
      ws.getColumn(10).width = 14;

      const buffer = await wb.xlsx.writeBuffer();
      descargarExcel(buffer, `Monto_Creditos_${new Date().toISOString().split('T')[0]}.xlsx`);
      return true;
    } catch (err) {
      console.error('Error exportando créditos:', err);
      toast.error('Hubo un error exportando los créditos');
      return false;
    } finally {
      setExportingCsv(false);
    }
  };

  const exportarPagosCsv = async (forceGlobal: boolean = false) => {
    setExportingCsv(true);
    try {
      let query = supabase
        .from('transacciones')
        .select('*')
        .order('fecha_pago', { ascending: false });

      const filterAsociado = forceGlobal === true ? null : selectedAsociado;

      if (filterAsociado) {
        query = query.eq('asociado_id', filterAsociado.id);
      }

      const { data: pagos, error } = await query;
      if (error) throw error;

      if (!pagos || pagos.length === 0) {
        toast.info('No hay transacciones registradas para exportar');
        return false;
      }

      const asocIds = [...new Set(pagos.map((p: any) => p.asociado_id).filter(Boolean))];
      const usuariosMap: Record<string, any> = {};
      if (asocIds.length > 0) {
        const { data: usrsData } = await supabase
          .from('usuarios').select('id, nombre, cedula').in('id', asocIds);
        (usrsData || []).forEach((u: any) => { usuariosMap[u.id] = u; });
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = 'UFCA - Sistema de Gestión';
      const ws = wb.addWorksheet('Historial de Transacciones', { views: [{ showGridLines: false }] });

      ws.mergeCells('A1:I1');
      const titleCell = ws.getCell('A1');
      titleCell.value = filterAsociado ? `TRANSACCIONES — ${filterAsociado.nombre}` : 'HISTORIAL DE TRANSACCIONES';
      titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 40;

      ws.mergeCells('A2:I2');
      const sub = ws.getCell('A2');
      sub.value = `UFCA — Unión Familiar de Crédito y Ahorro  •  Generado: ${new Date().toLocaleDateString('es-CO')}`;
      sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
      sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      sub.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 25;

      ws.addRow([]);

      const headers = ['#', 'Fecha Pago', 'Cédula', 'Nombre', 'Tipo', 'Monto', 'Método', 'Estado', 'Observación'];
      const headerRow = ws.getRow(4);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
        cell.alignment = { horizontal: i === 5 ? 'right' : 'left', vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF6D28D9' } } };
      });
      headerRow.height = 28;

      pagos.forEach((p: any, idx: number) => {
        const usr = usuariosMap[p.asociado_id] || {};
        const row = ws.getRow(5 + idx);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = p.fecha_pago || '—';
        row.getCell(3).value = usr.cedula || '—';
        row.getCell(4).value = usr.nombre || '—';
        row.getCell(5).value = (p.tipo || '—').replace(/_/g, ' ').toUpperCase();
        row.getCell(6).value = p.monto || 0;
        row.getCell(6).numFmt = '$#,##0';
        row.getCell(6).alignment = { horizontal: 'right' };
        row.getCell(7).value = (p.metodo_pago || '—').toUpperCase();
        row.getCell(8).value = (p.estado || '—').toUpperCase();
        row.getCell(9).value = p.observacion || '—';

        const bgColor = idx % 2 === 0 ? 'FFF5F3FF' : 'FFFFFFFF';
        for (let col = 1; col <= 9; col++) {
          row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          row.getCell(col).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
          row.getCell(col).border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        }
      });

      ws.getColumn(1).width = 5;
      ws.getColumn(2).width = 16;
      ws.getColumn(3).width = 16;
      ws.getColumn(4).width = 28;
      ws.getColumn(5).width = 24;
      ws.getColumn(6).width = 18;
      ws.getColumn(7).width = 14;
      ws.getColumn(8).width = 14;
      ws.getColumn(9).width = 35;

      const buffer = await wb.xlsx.writeBuffer();
      const nombreArchivo = (selectedAsociado && forceGlobal !== true)
        ? `Historial_Pagos_${selectedAsociado.cedula}.xlsx` 
        : `Historial_Pagos_Global_${new Date().toISOString().split('T')[0]}.xlsx`;
      descargarExcel(buffer, nombreArchivo);
      return true;
    } catch (err) {
      console.error('Error exportando pagos:', err);
      toast.error('Hubo un error exportando las transacciones');
      return false;
    } finally {
      setExportingCsv(false);
    }
  };

  const exportarAhorrosCsv = async () => {
    setExportingCsv(true);
    try {
      const { data: ahorrosList, error } = await supabase
        .from('cuentas_ahorro')
        .select(`
          id, asociado_id, tipo, monto_ahorrado, estado, created_at, multa_mora_vigente
        `);

      if (error) throw error;

      if (!ahorrosList || ahorrosList.length === 0) {
        toast.info('No hay cuentas de ahorro registradas para exportar');
        return false;
      }

      const asocIds = [...new Set(ahorrosList.map((a: any) => a.asociado_id).filter(Boolean))];
      const usuariosMap: Record<string, any> = {};
      if (asocIds.length > 0) {
        const { data: usrsData } = await supabase
          .from('usuarios').select('id, nombre, cedula').in('id', asocIds);
        (usrsData || []).forEach((u: any) => { usuariosMap[u.id] = u; });
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = 'UFCA - Sistema de Gestión';
      const ws = wb.addWorksheet('Cuentas de Ahorro', { views: [{ showGridLines: false }] });

      ws.mergeCells('A1:H1');
      const titleCell = ws.getCell('A1');
      titleCell.value = 'CUENTAS DE AHORRO';
      titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 40;

      ws.mergeCells('A2:H2');
      const sub = ws.getCell('A2');
      sub.value = `UFCA — Unión Familiar de Crédito y Ahorro  •  Generado: ${new Date().toLocaleDateString('es-CO')}`;
      sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
      sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      sub.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 25;

      ws.addRow([]);

      const headers = ['#', 'Cédula', 'Nombre Asociado', 'Tipo Cuenta', 'Monto Ahorrado', 'Estado', 'Mora Vigente', 'Fecha Creación'];
      const headerRow = ws.getRow(4);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
        cell.alignment = { horizontal: [4, 6].includes(i) ? 'right' : 'left', vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF047857' } } };
      });
      headerRow.height = 28;

      ahorrosList.forEach((a: any, idx: number) => {
        const usr = usuariosMap[a.asociado_id] || {};
        const row = ws.getRow(5 + idx);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = usr.cedula || '—';
        row.getCell(3).value = usr.nombre || '—';
        row.getCell(4).value = a.tipo ? a.tipo.toUpperCase() : '—';
        row.getCell(5).value = a.monto_ahorrado || 0;
        row.getCell(5).numFmt = '$#,##0';
        row.getCell(5).alignment = { horizontal: 'right' };
        row.getCell(6).value = (a.estado || '—').toUpperCase();
        row.getCell(7).value = a.multa_mora_vigente || 0;
        row.getCell(7).numFmt = '$#,##0';
        row.getCell(7).alignment = { horizontal: 'right' };
        row.getCell(8).value = a.created_at ? new Date(a.created_at).toLocaleDateString('es-CO') : '—';

        const bgColor = idx % 2 === 0 ? 'FFF0FDF4' : 'FFFFFFFF';
        for (let col = 1; col <= 8; col++) {
          row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          row.getCell(col).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
          row.getCell(col).border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        }
      });

      ws.getColumn(1).width = 5;
      ws.getColumn(2).width = 16;
      ws.getColumn(3).width = 30;
      ws.getColumn(4).width = 18;
      ws.getColumn(5).width = 20;
      ws.getColumn(6).width = 14;
      ws.getColumn(7).width = 18;
      ws.getColumn(8).width = 18;

      const buffer = await wb.xlsx.writeBuffer();
      descargarExcel(buffer, `Cuentas_Ahorro_Global_${new Date().toISOString().split('T')[0]}.xlsx`);
      return true;
    } catch (err) {
      console.error('Error exportando ahorros:', err);
      toast.error('Hubo un error exportando las cuentas de ahorro');
      return false;
    } finally {
      setExportingCsv(false);
    }
  };

  const exportarLiquidacionesCsv = async () => {
    setExportingCsv(true);
    try {
      const { data: liquidacionesList, error } = await supabase
        .from('liquidaciones')
        .select(`
          id, asociado_id, tipo, monto_total, fecha, detalle
        `)
        .order('fecha', { ascending: false });

      if (error) throw error;

      if (!liquidacionesList || liquidacionesList.length === 0) {
        toast.info('No hay liquidaciones registradas para exportar');
        return false;
      }

      const asocIds = [...new Set(liquidacionesList.map((l: any) => l.asociado_id).filter(Boolean))];
      const usuariosMap: Record<string, any> = {};
      if (asocIds.length > 0) {
        const { data: usrsData } = await supabase
          .from('usuarios').select('id, nombre, cedula').in('id', asocIds);
        (usrsData || []).forEach((u: any) => { usuariosMap[u.id] = u; });
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = 'UFCA - Sistema de Gestión';
      const ws = wb.addWorksheet('Liquidaciones', { views: [{ showGridLines: false }] });

      ws.mergeCells('A1:G1');
      const titleCell = ws.getCell('A1');
      titleCell.value = 'LIQUIDACIONES DE ASOCIADOS';
      titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(1).height = 40;

      ws.mergeCells('A2:G2');
      const sub = ws.getCell('A2');
      sub.value = `UFCA — Unión Familiar de Crédito y Ahorro  •  Generado: ${new Date().toLocaleDateString('es-CO')}`;
      sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
      sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      sub.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(2).height = 25;

      ws.addRow([]);

      const headers = ['#', 'Cédula', 'Nombre Asociado', 'Tipo Liquidación', 'Monto Total', 'Fecha', 'Detalle'];
      const headerRow = ws.getRow(4);
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
        cell.alignment = { horizontal: i === 4 ? 'right' : 'left', vertical: 'middle' };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FFB45309' } } };
      });
      headerRow.height = 28;

      liquidacionesList.forEach((l: any, idx: number) => {
        const usr = usuariosMap[l.asociado_id] || {};
        const row = ws.getRow(5 + idx);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = usr.cedula || '—';
        row.getCell(3).value = usr.nombre || '—';
        row.getCell(4).value = l.tipo ? l.tipo.toUpperCase() : '—';
        row.getCell(5).value = l.monto_total || 0;
        row.getCell(5).numFmt = '$#,##0';
        row.getCell(5).alignment = { horizontal: 'right' };
        row.getCell(6).value = l.fecha || '—';
        row.getCell(7).value = l.detalle ? JSON.stringify(l.detalle) : '—';

        const bgColor = idx % 2 === 0 ? 'FFFFFBEB' : 'FFFFFFFF';
        for (let col = 1; col <= 7; col++) {
          row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
          row.getCell(col).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
          row.getCell(col).border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        }
      });

      ws.getColumn(1).width = 5;
      ws.getColumn(2).width = 16;
      ws.getColumn(3).width = 30;
      ws.getColumn(4).width = 22;
      ws.getColumn(5).width = 20;
      ws.getColumn(6).width = 16;
      ws.getColumn(7).width = 40;

      const buffer = await wb.xlsx.writeBuffer();
      descargarExcel(buffer, `Liquidaciones_Asociados_${new Date().toISOString().split('T')[0]}.xlsx`);
      return true;
    } catch (err) {
      console.error('Error exportando liquidaciones:', err);
      toast.error('Hubo un error exportando las liquidaciones');
      return false;
    } finally {
      setExportingCsv(false);
    }
  };

  // ── Helper: crear hoja con estilo corporativo ──
  const crearHojaConEstilo = (
    wb: ExcelJS.Workbook,
    sheetName: string,
    title: string,
    headers: string[],
    headerColor: string,
    headerBorderColor: string,
    zebraColor: string,
    data: any[][],
    colWidths: number[],
    currencyCols: number[] = [],
    percentCols: number[] = [],
  ) => {
    const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] });
    const colCount = headers.length;
    const lastCol = String.fromCharCode(64 + colCount); // A=65

    // Título
    ws.mergeCells(`A1:${lastCol}1`);
    const titleCell = ws.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 40;

    ws.mergeCells(`A2:${lastCol}2`);
    const sub = ws.getCell('A2');
    sub.value = `UFCA — Unión Familiar de Crédito y Ahorro  •  Generado: ${new Date().toLocaleDateString('es-CO')}`;
    sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
    sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    sub.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 25;

    ws.addRow([]);

    // Headers
    const headerRow = ws.getRow(4);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
      cell.alignment = { horizontal: currencyCols.includes(i + 1) || percentCols.includes(i + 1) ? 'right' : 'left', vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: headerBorderColor } } };
    });
    headerRow.height = 28;

    // Datos
    data.forEach((rowData, idx) => {
      const row = ws.getRow(5 + idx);
      rowData.forEach((val: any, ci: number) => {
        const cell = row.getCell(ci + 1);
        cell.value = val;
        if (currencyCols.includes(ci + 1)) cell.numFmt = '$#,##0';
        if (percentCols.includes(ci + 1)) cell.numFmt = '0.0%';
      });

      const bgColor = idx % 2 === 0 ? zebraColor : 'FFFFFFFF';
      for (let col = 1; col <= colCount; col++) {
        row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        row.getCell(col).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
        row.getCell(col).border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
      }
    });

    // Anchos
    colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    return ws;
  };

  const exportarTodoSistema = async () => {
    toast.info('Generando reporte consolidado de todo el sistema...');
    setExportingCsv(true);
    try {
      const { data: usuariosData, error: errUsrs } = await supabase
        .from('usuarios')
        .select('id, nombre, cedula');
      if (errUsrs) throw errUsrs;

      const usuariosMap: Record<string, any> = {};
      (usuariosData || []).forEach((u: any) => { usuariosMap[u.id] = u; });

      const { data: creditosList, error: errCreds } = await supabase.from('creditos').select('*');
      if (errCreds) throw errCreds;

      const { data: ahorrosList, error: errAhorros } = await supabase.from('cuentas_ahorro').select('*');
      if (errAhorros) throw errAhorros;

      const { data: liquidacionesList, error: errLiqs } = await supabase.from('liquidaciones').select('*');
      if (errLiqs) throw errLiqs;

      const { data: pagosList, error: errPagos } = await supabase
        .from('transacciones').select('*').order('fecha_pago', { ascending: false });
      if (errPagos) throw errPagos;

      const wb = new ExcelJS.Workbook();
      wb.creator = 'UFCA - Sistema de Gestión';
      wb.created = new Date();

      // ── Hoja 0: Portada / Resumen General ──
      const wsPortada = wb.addWorksheet('Resumen General', { views: [{ showGridLines: false }] });
      
      // Título
      wsPortada.mergeCells('A1:D1');
      const portTitle = wsPortada.getCell('A1');
      portTitle.value = 'REPORTE CONSOLIDADO DE ACTIVIDADES';
      portTitle.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      portTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
      portTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      wsPortada.getRow(1).height = 40;

      wsPortada.mergeCells('A2:D2');
      const portSub = wsPortada.getCell('A2');
      portSub.value = `UFCA — Unión Familiar de Crédito y Ahorro  •  Generado: ${new Date().toLocaleDateString('es-CO')}`;
      portSub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
      portSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      portSub.alignment = { horizontal: 'center', vertical: 'middle' };
      wsPortada.getRow(2).height = 25;

      wsPortada.addRow([]);
      
      // Mensaje explicativo
      wsPortada.mergeCells('A4:D4');
      const noteCell = wsPortada.getCell('A4');
      noteCell.value = '📌 Este archivo contiene la información consolidada de la cooperativa. Navegue por las pestañas inferiores de Excel para ver el detalle de cada módulo.';
      noteCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      noteCell.alignment = { vertical: 'middle', wrapText: true };
      wsPortada.getRow(4).height = 30;

      wsPortada.addRow([]);

      // Headers de la tabla de contenidos
      const portHeaders = ['Módulo', 'Descripción del Reporte', 'N° Registros', 'Color Pestaña'];
      const portHeaderRow = wsPortada.getRow(6);
      portHeaders.forEach((h, i) => {
        const cell = portHeaderRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      });
      portHeaderRow.height = 25;

      // Filas de contenidos
      const portRows = [
        ['🔵 Monto Créditos', 'Detalle de créditos otorgados, saldos pendientes y plazos', `${creditosList.length} registros`, 'Azul'],
        ['🟢 Cuentas Ahorro', 'Saldos de cuentas de ahorro permanente y voluntario', `${ahorrosList.length} cuentas`, 'Verde'],
        ['🟡 Liquidaciones', 'Historial de cierres de cuenta y retiros definitivos', `${liquidacionesList.length} liquidaciones`, 'Naranja'],
        ['🟣 Transacciones', 'Historial de aportes, cuotas pagadas y penalidades de mora', `${pagosList.length} transacciones`, 'Púrpura']
      ];

      portRows.forEach((r, idx) => {
        const row = wsPortada.getRow(7 + idx);
        r.forEach((val, ci) => {
          const cell = row.getCell(ci + 1);
          cell.value = val;
          cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
          cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        });
        row.height = 22;
      });

      wsPortada.getColumn(1).width = 25;
      wsPortada.getColumn(2).width = 50;
      wsPortada.getColumn(3).width = 18;
      wsPortada.getColumn(4).width = 18;

      // ── Hoja 1: Créditos (azul) ──
      const creditData = (creditosList || []).map((c: any, i: number) => {
        const usr = usuariosMap[c.asociado_id] || {};
        return [i + 1, usr.cedula || '—', usr.nombre || '—', c.monto || 0, c.saldo ?? c.monto, c.cuota_mensual || 0, c.tasa_interes || 0, c.plazo_meses || 0, c.fecha_desembolso || '—', (c.estado || '—').toUpperCase()];
      });
      crearHojaConEstilo(wb, 'Monto Créditos', 'MONTOS DE CRÉDITOS',
        ['#', 'Cédula', 'Nombre', 'Monto Otorgado', 'Saldo Pendiente', 'Cuota Mensual', 'Tasa (%)', 'Plazo', 'Fecha Desembolso', 'Estado'],
        'FF2563EB', 'FF1D4ED8', 'FFEFF6FF',
        creditData,
        [5, 14, 28, 18, 18, 16, 12, 10, 18, 14],
        [4, 5, 6], [7],
      );

      // ── Hoja 2: Ahorros (verde) ──
      const ahorroData = (ahorrosList || []).map((a: any, i: number) => {
        const usr = usuariosMap[a.asociado_id] || {};
        return [i + 1, usr.cedula || '—', usr.nombre || '—', a.tipo?.toUpperCase() || '—', a.monto_ahorrado || 0, (a.estado || '—').toUpperCase(), a.multa_mora_vigente || 0, a.created_at ? new Date(a.created_at).toLocaleDateString('es-CO') : '—'];
      });
      crearHojaConEstilo(wb, 'Cuentas Ahorro', 'CUENTAS DE AHORRO',
        ['#', 'Cédula', 'Nombre', 'Tipo', 'Monto Ahorrado', 'Estado', 'Mora Vigente', 'Fecha Creación'],
        'FF059669', 'FF047857', 'FFF0FDF4',
        ahorroData,
        [5, 14, 28, 16, 18, 14, 18, 16],
        [5, 7], [],
      );

      // ── Hoja 3: Liquidaciones (naranja) ──
      const liqData = (liquidacionesList || []).map((l: any, i: number) => {
        const usr = usuariosMap[l.asociado_id] || {};
        return [i + 1, usr.cedula || '—', usr.nombre || '—', l.tipo?.toUpperCase() || '—', l.monto_total || 0, l.fecha || '—', l.detalle ? JSON.stringify(l.detalle) : '—'];
      });
      crearHojaConEstilo(wb, 'Liquidaciones', 'LIQUIDACIONES DE ASOCIADOS',
        ['#', 'Cédula', 'Nombre', 'Tipo', 'Monto Total', 'Fecha', 'Detalle'],
        'FFD97706', 'FFB45309', 'FFFFFBEB',
        liqData,
        [5, 14, 28, 20, 18, 16, 40],
        [5], [],
      );

      // ── Hoja 4: Transacciones (púrpura) ──
      const transData = (pagosList || []).map((p: any, i: number) => {
        const usr = usuariosMap[p.asociado_id] || {};
        return [i + 1, p.fecha_pago || '—', usr.cedula || '—', usr.nombre || '—', (p.tipo || '—').replace(/_/g, ' ').toUpperCase(), p.monto || 0, (p.metodo_pago || '—').toUpperCase(), (p.estado || '—').toUpperCase(), p.observacion || '—'];
      });
      crearHojaConEstilo(wb, 'Transacciones', 'HISTORIAL DE TRANSACCIONES',
        ['#', 'Fecha Pago', 'Cédula', 'Nombre', 'Tipo', 'Monto', 'Método', 'Estado', 'Observación'],
        'FF7C3AED', 'FF6D28D9', 'FFF5F3FF',
        transData,
        [5, 16, 14, 28, 24, 18, 14, 14, 35],
        [6], [],
      );

      const buffer = await wb.xlsx.writeBuffer();
      descargarExcel(buffer, `Reporte_Consolidado_Sistema_UFCA_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast.success('Se descargó el reporte consolidado de todo el sistema correctamente.');
    } catch (err) {
      console.error('Error al exportar todo:', err);
      toast.error('Hubo un problema al intentar descargar el reporte consolidado');
    } finally {
      setExportingCsv(false);
    }
  };

  const generarConsolidadoSistemaPdf = async () => {
    toast.info('Generando vista previa del reporte consolidado de todo el sistema...');
    setGeneratingPdfConsolidado(true);
    try {
      const { data: usuariosData, error: errUsrs } = await supabase
        .from('usuarios')
        .select('id, nombre, cedula');
      if (errUsrs) throw errUsrs;

      const usuariosMap: Record<string, any> = {};
      (usuariosData || []).forEach((u: any) => { usuariosMap[u.id] = u; });

      const { data: creditosList, error: errCreds } = await supabase.from('creditos').select('*');
      if (errCreds) throw errCreds;

      const { data: ahorrosList, error: errAhorros } = await supabase.from('cuentas_ahorro').select('*');
      if (errAhorros) throw errAhorros;

      const { data: liquidacionesList, error: errLiqs } = await supabase.from('liquidaciones').select('*');
      if (errLiqs) throw errLiqs;

      const { data: pagosList, error: errPagos } = await supabase
        .from('transacciones').select('*').order('fecha_pago', { ascending: false });
      if (errPagos) throw errPagos;

      // 2. Generar PDF
      const doc = new jsPDF();

      // --- PÁGINA 1: PORTADA / RESUMEN GENERAL ---
      // Header Bar - Slate/Navy Corporate design
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 42, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('UFCA — REPORTE CONSOLIDADO', 20, 20);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text('Unión Familiar de Crédito y Ahorro', 20, 29);
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMEN GENERAL DEL SISTEMA', 190, 20, { align: 'right' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('DOCUMENTO OFICIAL DIGITAL', 190, 29, { align: 'right' });

      // Divider Line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(0.5);
      doc.line(20, 52, 190, 52);

      // Metadata section (two columns)
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('INFORMACIÓN DE LA COOPERATIVA', 20, 60);
      
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFont('helvetica', 'bold');
      doc.text('UFCA - MÓDULO DE EXPORTACIÓN CONSOLIDADA', 20, 67);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text('Estado del reporte: CONSOLIDADO ACTUALIZADO', 20, 73);
      doc.text('Área: ADMINISTRACIÓN Y FINANZAS', 20, 79);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('FECHA Y DETALLES DE GENERACIÓN', 115, 60);
      
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha:  ${new Date().toLocaleDateString('es-CO')}`, 115, 67);
      doc.text(`Hora:   ${new Date().toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'})}`, 115, 73);
      doc.text(`Registros totales: ${(creditosList?.length || 0) + (ahorrosList?.length || 0) + (liquidacionesList?.length || 0) + (pagosList?.length || 0)} ítems`, 115, 79);

      let yPos = 88;

      // Resumen Ahorros y Créditos (Card container)
      const totalCreditos = (creditosList || []).reduce((sum, c) => sum + (c.saldo ?? c.monto ?? 0), 0);
      const totalAhorros = (ahorrosList || []).reduce((sum, a) => sum + (a.monto_ahorrado || 0), 0);

      // Background Box
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(20, yPos, 170, 36, 4, 4, 'F');
      
      doc.setDrawColor(241, 245, 249); // slate-100
      doc.setLineWidth(0.5);
      doc.roundedRect(20, yPos, 170, 36, 4, 4, 'S');

      // Column 1: Total Ahorrado
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL AHORRADO EN CUENTAS', 25, yPos + 10);
      doc.setFontSize(11);
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text(formatCurrency(totalAhorros), 25, yPos + 18);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`${ahorrosList?.length || 0} cuenta(s) registrada(s)`, 25, yPos + 26);

      // Column 2: Saldo Deudor Créditos
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('SALDO DEUDOR CRÉDITOS', 85, yPos + 10);
      doc.setFontSize(11);
      doc.setTextColor(37, 99, 235); // blue-600
      doc.text(formatCurrency(totalCreditos), 85, yPos + 18);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const credsActivosCount = (creditosList || []).filter(c => c.estado === 'activo' || c.estado === 'desembolsado').length;
      doc.text(`${credsActivosCount} crédito(s) activo(s)`, 85, yPos + 26);

      // Column 3: Transacciones y Liq
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('MOVIMIENTOS Y RETIROS', 140, yPos + 10);
      doc.setFontSize(11);
      doc.setTextColor(217, 119, 6); // amber-650
      doc.text(`${pagosList?.length || 0} transacciones`, 140, yPos + 18);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`${liquidacionesList?.length || 0} liquidación(es)`, 140, yPos + 26);

      yPos += 48;

      // Tabla de Secciones del Reporte
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('ESTRUCTURA DEL REPORTE CONSOLIDADO', 20, yPos);
      yPos += 4;

      const summaryTableData = [
        ['1. Créditos de Asociados', 'Detalle de montos, saldos, cuotas, tasas, plazos y estados.', `${creditosList?.length || 0} registros`, 'Sección 2'],
        ['2. Cuentas de Ahorro', 'Saldos de cuentas de ahorro permanente y voluntario con moras.', `${ahorrosList?.length || 0} cuentas`, 'Sección 3'],
        ['3. Liquidaciones de Retiros', 'Historial de cierres de cuenta y retiros definitivos ejecutados.', `${liquidacionesList?.length || 0} registros`, 'Sección 4'],
        ['4. Historial de Transacciones', 'Detalle cronológico de aportes, cuotas y penalizaciones.', `${pagosList?.length || 0} registros`, 'Sección 5']
      ];

      autoTable(doc, {
        startY: yPos,
        margin: { left: 20, right: 20 },
        head: [['Sección / Módulo', 'Descripción', 'Cantidad', 'Ubicación']],
        body: summaryTableData,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], textColor: 255 }, // slate-700
        styles: { fontSize: 8 },
      });

      // --- SECCIÓN 2: CRÉDITOS ---
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('1. REPORTE GENERAL DE CRÉDITOS', 20, 20);
      
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Listado detallado de todos los créditos otorgados a asociados de la cooperativa, incluyendo saldos y estados.', 20, 26);
      
      const creditRows = (creditosList || []).map((c, i) => {
        const usr = usuariosMap[c.asociado_id] || {};
        return [
          i + 1,
          usr.cedula || '—',
          usr.nombre || '—',
          formatCurrency(c.monto || 0),
          formatCurrency(c.saldo ?? c.monto),
          formatCurrency(c.cuota_mensual || 0),
          `${c.tasa_interes || 0}%`,
          `${c.plazo_meses || 0}m`,
          c.fecha_desembolso || '—',
          (c.estado || '—').toUpperCase()
        ];
      });

      autoTable(doc, {
        startY: 32,
        margin: { left: 20, right: 20 },
        head: [['#', 'Cédula', 'Nombre', 'Monto', 'Saldo', 'Cuota', 'Tasa', 'Plazo', 'Fecha', 'Estado']],
        body: creditRows.length > 0 ? creditRows : [['—', '—', 'Sin registros de créditos', '—', '—', '—', '—', '—', '—', '—']],
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], textColor: 255 }, // blue-600
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 18 },
          2: { cellWidth: 32 },
          3: { cellWidth: 18 },
          4: { cellWidth: 18 },
          5: { cellWidth: 16 },
          6: { cellWidth: 10 },
          7: { cellWidth: 10 },
          8: { cellWidth: 18 },
          9: { cellWidth: 15 }
        }
      });

      // --- SECCIÓN 3: CUENTAS DE AHORRO ---
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('2. CUENTAS DE AHORRO DE ASOCIADOS', 20, 20);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Estado de las cuentas de ahorro permanente y voluntario, montos acumulados y moras vigentes por asociado.', 20, 26);

      const ahorroRows = (ahorrosList || []).map((a, i) => {
        const usr = usuariosMap[a.asociado_id] || {};
        return [
          i + 1,
          usr.cedula || '—',
          usr.nombre || '—',
          (a.tipo || '—').toUpperCase(),
          formatCurrency(a.monto_ahorrado || 0),
          (a.estado || '—').toUpperCase(),
          formatCurrency(a.multa_mora_vigente || 0),
          a.created_at ? new Date(a.created_at).toLocaleDateString('es-CO') : '—'
        ];
      });

      autoTable(doc, {
        startY: 32,
        margin: { left: 20, right: 20 },
        head: [['#', 'Cédula', 'Nombre', 'Tipo', 'Monto Ahorrado', 'Estado', 'Mora Vigente', 'Fecha Creación']],
        body: ahorroRows.length > 0 ? ahorroRows : [['—', '—', 'Sin registros de ahorros', '—', '—', '—', '—', '—']],
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], textColor: 255 }, // emerald-500
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 20 },
          2: { cellWidth: 35 },
          3: { cellWidth: 25 },
          4: { cellWidth: 22 },
          5: { cellWidth: 20 },
          6: { cellWidth: 20 },
          7: { cellWidth: 20 }
        }
      });

      // --- SECCIÓN 4: LIQUIDACIONES ---
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('3. REPORTE DE LIQUIDACIONES', 20, 20);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Historial de liquidaciones realizadas a asociados al retirarse o cancelar cuentas de la cooperativa.', 20, 26);

      const liqRows = (liquidacionesList || []).map((l, i) => {
        const usr = usuariosMap[l.asociado_id] || {};
        let detalleText = '—';
        if (l.detalle) {
          try {
            const det = typeof l.detalle === 'string' ? JSON.parse(l.detalle) : l.detalle;
            detalleText = `Estado: ${det.estado || '—'} | Motivo: ${det.motivo || '—'}`;
          } catch {
            detalleText = 'Detalle inválido';
          }
        }
        return [
          i + 1,
          usr.cedula || '—',
          usr.nombre || '—',
          (l.tipo || '—').toUpperCase(),
          formatCurrency(l.monto_total || 0),
          l.fecha || '—',
          detalleText
        ];
      });

      autoTable(doc, {
        startY: 32,
        margin: { left: 20, right: 20 },
        head: [['#', 'Cédula', 'Nombre', 'Tipo', 'Monto Total', 'Fecha', 'Detalle']],
        body: liqRows.length > 0 ? liqRows : [['—', '—', 'Sin registros de liquidaciones', '—', '—', '—', '—']],
        theme: 'striped',
        headStyles: { fillColor: [217, 119, 6], textColor: 255 }, // amber-600
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 20 },
          2: { cellWidth: 35 },
          3: { cellWidth: 20 },
          4: { cellWidth: 22 },
          5: { cellWidth: 20 },
          6: { cellWidth: 'auto' }
        }
      });

      // --- SECCIÓN 5: TRANSACCIONES ---
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('4. HISTORIAL DE TRANSACCIONES', 20, 20);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Listado cronológico de transacciones registradas (aportes, pagos de cuotas y penalizaciones).', 20, 26);

      const transRows = (pagosList || []).map((p, i) => {
        const usr = usuariosMap[p.asociado_id] || {};
        return [
          i + 1,
          p.fecha_pago || '—',
          usr.cedula || '—',
          usr.nombre || '—',
          (p.tipo || '—').replace(/_/g, ' ').toUpperCase(),
          formatCurrency(p.monto || 0),
          (p.metodo_pago || '—').toUpperCase(),
          (p.estado || '—').toUpperCase(),
          p.observacion || '—'
        ];
      });

      autoTable(doc, {
        startY: 32,
        margin: { left: 20, right: 20 },
        head: [['#', 'Fecha', 'Cédula', 'Nombre', 'Tipo', 'Monto', 'Método', 'Estado', 'Observación']],
        body: transRows.length > 0 ? transRows : [['—', '—', 'Sin registros de transacciones', '—', '—', '—', '—', '—', '—']],
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237], textColor: 255 }, // purple-600
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 18 },
          2: { cellWidth: 18 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 },
          5: { cellWidth: 18 },
          6: { cellWidth: 18 },
          7: { cellWidth: 15 },
          8: { cellWidth: 'auto' }
        }
      });

      // --- FOOTER PARA TODAS LAS PÁGINAS ---
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generado automáticamente vía plataforma UFCA el ${new Date().toLocaleString('es-CO')}`, 20, 288);
        doc.text(`Página ${i} de ${pageCount}`, 190, 288, { align: 'right' });
      }

      const pdfOutput = doc.output('blob');
      setPdfBlob(pdfOutput);
      const filename = `Reporte_Consolidado_Sistema_UFCA_${new Date().toISOString().split('T')[0]}.pdf`;
      setPdfPreviewFilename(filename);
      const url = URL.createObjectURL(pdfOutput);
      setPdfPreviewUrl(url);
      setPdfPreviewType('consolidado');
      setIsPdfPreviewOpen(true);
      toast.success('Vista previa del reporte consolidado cargada correctamente.');
    } catch (err) {
      console.error('Error al generar el PDF consolidado:', err);
      toast.error('Hubo un error al intentar generar la vista previa del reporte consolidado');
    } finally {
      setGeneratingPdfConsolidado(false);
    }
  };

  const descargarExcel = (buffer: ExcelJS.Buffer, filename: string) => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Archivo Excel descargado correctamente');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1">Módulo de Reportes</h1>
            <p className="text-slate-500 text-sm font-medium">Genera extractos interactivos de asociados y exporta reportes de la cooperativa.</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-[600px] grid-cols-3 mb-8 bg-slate-100 p-1 h-auto rounded-xl border border-slate-200/50 backdrop-blur-sm">
            <TabsTrigger value="extractos" className="flex items-center justify-center gap-2 py-1.5 px-3 h-auto rounded-lg font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm transition-all">
              <FileText className="size-4" /> Extractos
            </TabsTrigger>
            <TabsTrigger value="exportacion" className="flex items-center justify-center gap-2 py-1.5 px-3 h-auto rounded-lg font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm transition-all">
              <Download className="size-4" /> Exportación
            </TabsTrigger>
            <TabsTrigger value="utilidades" className="flex items-center justify-center gap-2 py-1.5 px-3 h-auto rounded-lg font-medium text-slate-600 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm transition-all">
              <TrendingUp className="size-4" /> Utilidades
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extractos" className="space-y-6 focus-visible:outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              <Card className="lg:col-span-1 shadow-sm border border-slate-200/60 rounded-2xl bg-white transition-all duration-300 hover:shadow-md">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-100 py-4 px-5 rounded-t-2xl">
                  <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2.5">
                    <User className="size-5 text-emerald-600 stroke-[2]" />
                    Seleccionar Asociado
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 z-10" />
                    <Input
                      placeholder="Buscar por cédula o nombre..."
                      className="pl-10 rounded-xl border border-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 h-10 text-slate-700 font-medium"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setShowDropdown(false)}
                    />
                    
                    {showDropdown && !selectedAsociado && (
                      loadingAsociados ? (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-md border border-slate-100 rounded-xl p-4 text-center text-sm text-slate-500 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="flex items-center justify-center gap-2">
                            <div className="size-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                            <span>Buscando asociados...</span>
                          </div>
                        </div>
                      ) : asociados.length > 0 ? (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl divide-y divide-slate-50 overflow-hidden max-h-[300px] overflow-y-auto shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                          {asociados.map(a => {
                            const iniciales = a.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                            return (
                              <div 
                                key={a.id}
                                className={`p-3.5 text-sm cursor-pointer hover:bg-slate-50/80 transition-all flex items-center gap-3 ${selectedAsociado?.id === a.id ? 'bg-emerald-50/60' : ''}`}
                                onMouseDown={(e) => { 
                                  e.preventDefault(); 
                                  setSelectedAsociado(a); 
                                  setSearchTerm(''); 
                                  setAsociados([]); 
                                  setShowDropdown(false);
                                }}
                              >
                                <div className="size-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-semibold shadow-sm shrink-0">
                                  {iniciales}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-slate-800 truncate">{a.nombre}</p>
                                  <p className="text-slate-400 text-xs mt-0.5 font-medium">C.C. {a.cedula}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : searchTerm.length >= 3 ? (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl p-5 text-center text-sm text-slate-500 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                          <p className="font-medium text-slate-600">No se encontraron resultados</p>
                          <p className="text-xs text-slate-400 mt-1">Verifica la cédula o nombre</p>
                        </div>
                      ) : null
                    )}
                  </div>

                  {selectedAsociado && (
                    <div className="p-4 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 rounded-xl border border-emerald-100/80 flex items-center gap-3.5 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                      <div className="size-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow shrink-0">
                        {selectedAsociado.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-emerald-950 truncate leading-tight">{selectedAsociado.nombre}</p>
                        <p className="text-xs font-semibold text-emerald-700 mt-0.5">C.C. {selectedAsociado.cedula}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedAsociado(null)} 
                        className="h-8 w-8 p-0 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/50 rounded-full shrink-0"
                        title="Limpiar selección"
                      >
                        ✕
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="lg:col-span-2 space-y-6">
                {selectedAsociado ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Ahorro Permanente */}
                      <Card className="overflow-hidden border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md bg-white rounded-2xl relative group">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500" />
                        <CardContent className="p-5 flex flex-col justify-between h-full">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ahorro Permanente</p>
                              {loadingDatos ? (
                                <div className="h-9 w-32 bg-slate-100 animate-pulse rounded-md mt-2" />
                              ) : (
                                <p className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1.5">
                                  {formatCurrency(ahorroPermanente?.monto_ahorrado || 0)}
                                </p>
                              )}
                            </div>
                            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100/80">
                              <PiggyBank className="size-5 stroke-[1.8]" />
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                            <span className="text-[11px] text-slate-400 font-semibold uppercase">Estado Cuenta</span>
                            {loadingDatos ? (
                              <div className="h-4 w-12 bg-slate-100 animate-pulse rounded mt-0.5" />
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                                ahorroPermanente?.estado === 'activo' 
                                  ? 'bg-emerald-100/70 text-emerald-800' 
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                <span className={`size-1.5 rounded-full ${ahorroPermanente?.estado === 'activo' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                {ahorroPermanente?.estado || 'Sin cuenta'}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Ahorro Voluntario */}
                      <Card className="overflow-hidden border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md bg-white rounded-2xl relative group">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 to-indigo-500" />
                        <CardContent className="p-5 flex flex-col justify-between h-full">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ahorro Voluntario</p>
                              {loadingDatos ? (
                                <div className="h-9 w-32 bg-slate-100 animate-pulse rounded-md mt-2" />
                              ) : (
                                <p className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1.5">
                                  {formatCurrency(ahorroVoluntario?.monto_ahorrado || 0)}
                                </p>
                              )}
                            </div>
                            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100/80">
                              <FileText className="size-5 stroke-[1.8]" />
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                            <span className="text-[11px] text-slate-400 font-semibold uppercase">Estado Cuenta</span>
                            {loadingDatos ? (
                              <div className="h-4 w-12 bg-slate-100 animate-pulse rounded mt-0.5" />
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                                ahorroVoluntario?.estado === 'activo' 
                                  ? 'bg-blue-100/70 text-blue-800' 
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                <span className={`size-1.5 rounded-full ${ahorroVoluntario?.estado === 'activo' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                                {ahorroVoluntario?.estado || 'Sin cuenta'}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Saldo en Créditos */}
                      <Card className="overflow-hidden border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md bg-white rounded-2xl relative group">
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 to-orange-500" />
                        <CardContent className="p-5 flex flex-col justify-between h-full">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo en Créditos</p>
                              {loadingDatos ? (
                                <div className="h-9 w-32 bg-slate-100 animate-pulse rounded-md mt-2" />
                              ) : (
                                <p className="text-2xl font-extrabold text-slate-800 tracking-tight mt-1.5">
                                  {formatCurrency(creditos.reduce((s, c) => s + (c.saldo || 0), 0))}
                                </p>
                              )}
                            </div>
                            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100/80">
                              <TrendingUp className="size-5 stroke-[1.8]" />
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                            <span className="text-[11px] text-slate-400 font-semibold uppercase">Créditos Activos</span>
                            {loadingDatos ? (
                              <div className="h-4 w-12 bg-slate-100 animate-pulse rounded mt-0.5" />
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100/70 text-amber-800">
                                {creditos.filter(c => c.estado === 'activo' || c.estado === 'desembolsado').length} Activos
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white overflow-hidden">
                      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b border-slate-100 py-4 px-6">
                        <CardTitle className="text-base font-bold text-slate-800">Parámetros del Extracto</CardTitle>
                        <CardDescription className="text-xs text-slate-500 font-medium">Selecciona el periodo para visualizar y exportar los movimientos consolidados.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-2.5">
                            <Label htmlFor="fechaInicio" className="flex items-center gap-2 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                              <Calendar className="size-4 text-emerald-600 stroke-[2]" /> Fecha Inicial del Periodo
                            </Label>
                            <Input
                              id="fechaInicio"
                              type="date"
                              className="w-full rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 h-11 px-4 text-slate-700 font-medium"
                              value={fechaInicio}
                              onChange={(e) => setFechaInicio(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2.5">
                            <Label htmlFor="fechaFin" className="flex items-center gap-2 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                              <Calendar className="size-4 text-emerald-600 stroke-[2]" /> Fecha Final del Periodo
                            </Label>
                            <Input
                              id="fechaFin"
                              type="date"
                              className="w-full rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 h-11 px-4 text-slate-700 font-medium"
                              value={fechaFin}
                              onChange={(e) => setFechaFin(e.target.value)}
                            />
                          </div>
                        </div>
                        
                        <div className="flex justify-end pt-4 border-t border-slate-50">
                          <Button 
                            className="w-full sm:w-auto gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-6 py-5 rounded-xl shadow-md shadow-emerald-500/10 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5" 
                            onClick={generarExtractoPdf}
                            disabled={generatingPdf || loadingDatos}
                          >
                            {generatingPdf ? (
                              <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                            ) : (
                              <FileText className="size-4 stroke-[2]" />
                            )}
                            Generar Vista Previa del Extracto
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/60 backdrop-blur-sm p-8 text-center transition-all duration-300 hover:border-emerald-200">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-400 to-teal-400 rounded-full blur-xl opacity-20 animate-pulse" />
                      <div className="relative p-5 bg-gradient-to-tr from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100/50 inline-block text-emerald-600 shadow-inner">
                        <User className="size-10 stroke-[1.5]" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Ningún asociado seleccionado</h3>
                    <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
                      Busca y selecciona un asociado en el panel lateral de búsqueda para consultar sus saldos de ahorro, estado de créditos y generar el extracto de cuenta consolidado del periodo.
                    </p>
                    <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-xs text-slate-400 font-medium animate-bounce">
                      <Search className="size-3" />
                      <span>Escribe el nombre o cédula a la izquierda</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="exportacion" className="space-y-6 focus-visible:outline-none">
            {/* Master Export Banner */}
            <Card className="overflow-hidden border border-slate-100 shadow-md bg-gradient-to-r from-slate-900 via-slate-850 to-slate-800 text-white rounded-2xl relative group">
              <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-4 -translate-y-4 text-white pointer-events-none group-hover:scale-110 transition-transform duration-500">
                <Download className="size-48" />
              </div>
              <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2 max-w-2xl">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Exportador Consolidado
                  </span>
                  <h2 className="text-2xl font-extrabold tracking-tight text-white mt-1">Exportar Todo el Sistema</h2>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Descarga en un solo paso todos los registros de la cooperativa. Se generará un archivo Excel con hojas separadas para: Créditos, Cuentas de Ahorro, Liquidaciones e Historial completo de Transacciones.
                  </p>
                </div>
                <div className="shrink-0 flex flex-col sm:flex-row gap-3">
                  <Button 
                    className="w-full sm:w-auto gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold px-6 py-5 rounded-xl shadow-lg shadow-blue-500/10 transition-all duration-300 hover:shadow-blue-500/20 hover:-translate-y-0.5"
                    onClick={generarConsolidadoSistemaPdf}
                    disabled={generatingPdfConsolidado || exportingCsv}
                  >
                    {generatingPdfConsolidado ? (
                      <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FileText className="size-5 stroke-[2.2]" />
                    )}
                    Vista Previa PDF Consolidado
                  </Button>
                  <Button 
                    className="w-full sm:w-auto gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-extrabold px-6 py-5 rounded-xl shadow-lg shadow-emerald-500/10 transition-all duration-300 hover:shadow-emerald-500/20 hover:-translate-y-0.5"
                    onClick={exportarTodoSistema}
                    disabled={generatingPdfConsolidado || exportingCsv}
                  >
                    {exportingCsv ? <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="size-5 stroke-[2.2]" />}
                    Exportar Todo (Excel Consolidado)
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Grid of 4 Specific Exports */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Card 1: Montos de Créditos */}
              <Card className="overflow-hidden border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md bg-white rounded-2xl relative group flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 to-indigo-500" />
                <CardHeader className="p-5 pb-3">
                  <div className="size-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5 transition-colors group-hover:bg-blue-100/80">
                    <FileSpreadsheet className="size-5.5 stroke-[1.8]" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-800">Montos de Créditos</CardTitle>
                  <CardDescription className="text-slate-500 text-xs leading-relaxed mt-1.5">
                    Reporte global de créditos activos e inactivos, montos desembolsados, saldos deudores y cuotas vigentes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <Button 
                    className="w-full gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold py-4 rounded-xl shadow-sm text-xs transition-colors"
                    onClick={exportarCreditosCsv}
                    disabled={exportingCsv}
                  >
                    {exportingCsv ? <div className="size-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" /> : <Download className="size-3.5 stroke-[2]" />}
                    Exportar Créditos (Excel)
                  </Button>
                </CardContent>
              </Card>

              {/* Card 2: Cuentas de Ahorro */}
              <Card className="overflow-hidden border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md bg-white rounded-2xl relative group flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 to-teal-500" />
                <CardHeader className="p-5 pb-3">
                  <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3.5 transition-colors group-hover:bg-emerald-100/80">
                    <PiggyBank className="size-5.5 stroke-[1.8]" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-800">Cuentas de Ahorro</CardTitle>
                  <CardDescription className="text-slate-500 text-xs leading-relaxed mt-1.5">
                    Saldos detallados de cuentas de ahorro permanente y ahorro voluntario de todos los asociados registrados.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <Button 
                    className="w-full gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold py-4 rounded-xl shadow-sm text-xs transition-colors"
                    onClick={exportarAhorrosCsv}
                    disabled={exportingCsv}
                  >
                    {exportingCsv ? <div className="size-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" /> : <Download className="size-3.5 stroke-[2]" />}
                    Exportar Ahorros (Excel)
                  </Button>
                </CardContent>
              </Card>

              {/* Card 3: Liquidaciones */}
              <Card className="overflow-hidden border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md bg-white rounded-2xl relative group flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 to-orange-500" />
                <CardHeader className="p-5 pb-3">
                  <div className="size-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3.5 transition-colors group-hover:bg-amber-100/80">
                    <FileText className="size-5.5 stroke-[1.8]" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-800">Liquidaciones</CardTitle>
                  <CardDescription className="text-slate-500 text-xs leading-relaxed mt-1.5">
                    Historial de cierres de cuenta procesados por retiros voluntarios, expulsiones, fallecimientos o anuales.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                  <Button 
                    className="w-full gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold py-4 rounded-xl shadow-sm text-xs transition-colors"
                    onClick={exportarLiquidacionesCsv}
                    disabled={exportingCsv}
                  >
                    {exportingCsv ? <div className="size-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" /> : <Download className="size-3.5 stroke-[2]" />}
                    Exportar Liquidaciones (Excel)
                  </Button>
                </CardContent>
              </Card>

              {/* Card 4: Transacciones */}
              <Card className="overflow-hidden border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md bg-white rounded-2xl relative group flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 to-indigo-500" />
                <CardHeader className="p-5 pb-3">
                  <div className="size-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3.5 transition-colors group-hover:bg-purple-100/80">
                    <TrendingUp className="size-5.5 stroke-[1.8]" />
                  </div>
                  <CardTitle className="text-base font-bold text-slate-800">Transacciones</CardTitle>
                  <CardDescription className="text-slate-500 text-xs leading-relaxed mt-1.5">
                    Historial completo de pagos de aportes, cuotas de créditos, recargos de mora, depósitos y retiros.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-3">
                  {selectedAsociado && (
                    <div className="px-3 py-2 bg-emerald-50/50 rounded-xl border border-emerald-100/50 text-[10px] font-semibold text-emerald-800 flex justify-between items-center animate-in fade-in zoom-in-95">
                      <span className="truncate">Filtrado: <strong className="text-emerald-955 font-bold">{selectedAsociado.nombre.split(' ')[0]}</strong></span>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedAsociado(null)} className="h-5 px-1.5 text-[9px] uppercase font-bold text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100">
                        Quitar
                      </Button>
                    </div>
                  )}
                  <Button 
                    className="w-full gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold py-4 rounded-xl shadow-sm text-xs transition-colors"
                    onClick={exportarPagosCsv}
                    disabled={exportingCsv}
                  >
                    {exportingCsv ? <div className="size-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" /> : <Download className="size-3.5 stroke-[2]" />}
                    {selectedAsociado ? 'Exportar Filtrado (Excel)' : 'Exportar Pagos (Excel)'}
                  </Button>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="utilidades" className="space-y-6 focus-visible:outline-none">
            {loadingUtilidades ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            ) : !utilidadesData ? (
              <div className="text-center p-12 text-slate-500">Error al cargar las utilidades</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {/* Card 1: Utilidades Totales */}
                  <Card className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-800 text-white shadow-lg border-0 rounded-2xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 translate-x-4 -translate-y-4 text-white pointer-events-none group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="size-32" />
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                        Utilidades Totales
                        <TrendingUp className="size-4 text-emerald-400" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="text-3xl font-extrabold tracking-tight text-white">{formatCurrency(utilidadesData.utilidadTotal)}</div>
                      <p className="text-[11px] text-slate-400 font-medium mt-2">Acumulado neto recaudado por concepto de mora</p>
                    </CardContent>
                  </Card>

                  {/* Card 2: Mora en Créditos */}
                  <Card className="bg-gradient-to-br from-amber-600 to-orange-600 text-white shadow-lg border-0 rounded-2xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 translate-x-4 -translate-y-4 text-white pointer-events-none group-hover:scale-110 transition-transform duration-300">
                      <FileSpreadsheet className="size-32" />
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-amber-100 uppercase tracking-widest flex items-center justify-between">
                        Mora en Créditos
                        <FileSpreadsheet className="size-4 text-amber-200" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="text-3xl font-extrabold tracking-tight text-white">{formatCurrency(utilidadesData.utilidadCreditos)}</div>
                      <p className="text-[11px] text-amber-100/80 font-medium mt-2">Intereses de mora cobrados sobre cuotas vencidas</p>
                    </CardContent>
                  </Card>

                  {/* Card 3: Mora en Ahorros */}
                  <Card className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg border-0 rounded-2xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 translate-x-4 -translate-y-4 text-white pointer-events-none group-hover:scale-110 transition-transform duration-300">
                      <PiggyBank className="size-32" />
                    </div>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold text-emerald-100 uppercase tracking-widest flex items-center justify-between">
                        Mora en Ahorros
                        <PiggyBank className="size-4 text-emerald-200" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="text-3xl font-extrabold tracking-tight text-white">{formatCurrency(utilidadesData.utilidadAhorros)}</div>
                      <p className="text-[11px] text-emerald-100/80 font-medium mt-2">Penalidades por retraso en aportes permanentes</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="border border-slate-100 shadow-sm rounded-2xl bg-white overflow-hidden">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 p-6 bg-slate-50/50">
                    <div>
                      <CardTitle className="text-base font-bold text-slate-800">Historial de Utilidades (Mora)</CardTitle>
                      <CardDescription className="text-xs text-slate-500 font-medium mt-1">Registro detallado de transacciones que generaron recargo por mora para el fondo.</CardDescription>
                    </div>
                    <Button onClick={exportarUtilidadesCsv} className="gap-2 bg-slate-900 hover:bg-slate-850 text-white font-bold rounded-xl px-4 py-2.5 text-xs shadow-sm transition-all duration-300 hover:shadow">
                      <Download className="size-4 stroke-[2]" /> Exportar a Excel
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    {utilidadesData.historial.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-white p-6">
                        No hay registros de utilidades generadas por mora todavía.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                          <thead>
                            <tr className="text-[11px] text-slate-400 uppercase tracking-wider font-bold bg-slate-50 border-b border-slate-100">
                              <th className="px-6 py-4 font-bold">Fecha</th>
                              <th className="px-6 py-4 font-bold">Asociado</th>
                              <th className="px-6 py-4 font-bold">Concepto</th>
                              <th className="px-6 py-4 font-bold text-right">Utilidad Generada</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {utilidadesData.historial.map((r: any) => (
                              <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-semibold">
                                  {new Date(r.fecha_pago).toLocaleDateString('es-CO')}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-bold text-slate-800 text-xs sm:text-sm">{r.asociado?.nombre ?? 'Asociado Eliminado'}</div>
                                  <div className="text-[11px] text-slate-400 font-medium mt-0.5">C.C. {r.asociado?.cedula ?? 'N/A'}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                    r.tipo.includes('ahorro') 
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' 
                                      : 'bg-amber-50 text-amber-700 border border-amber-100/50'
                                  }`}>
                                    {r.tipo.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right font-extrabold text-emerald-600 text-sm">
                                  +{formatCurrency(r.monto_mora)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>

      </div>

      {/* Modal Vista Previa PDF */}
      <Dialog open={isPdfPreviewOpen} onOpenChange={(open) => { if (!open) { setIsPdfPreviewOpen(false); setPdfPreviewUrl(''); }}}>
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0 border-slate-100 shadow-2xl rounded-2xl overflow-hidden bg-white">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 shrink-0 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2.5 font-bold text-slate-800 text-lg">
                  <FileText className="size-5 text-emerald-600 stroke-[2]" />
                  {pdfPreviewType === 'consolidado' ? 'Vista Previa — Reporte Consolidado del Sistema' : 'Vista Previa — Extracto Consolidado'}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-slate-400 font-medium">
                  {pdfPreviewType === 'consolidado' 
                    ? 'Revisa detalladamente la información del sistema completo antes de exportarlo.' 
                    : 'Revisa detalladamente los movimientos y saldos del extracto digital antes de exportarlo.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden bg-slate-100 relative">
            {pdfPreviewUrl ? (
              <iframe
                id="pdf-iframe-preview"
                src={pdfPreviewUrl}
                className="w-full h-full border-0 absolute inset-0"
                title={pdfPreviewType === 'consolidado' ? 'Vista previa del reporte consolidado PDF' : 'Vista previa del extracto PDF'}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-200 shrink-0 flex items-center justify-between bg-slate-50">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Documento Oficial Generado</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsPdfPreviewOpen(false)} className="rounded-xl font-bold h-10 px-4">
                Cerrar
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold h-10 px-4 transition-colors"
                onClick={imprimirPdf}
              >
                <Printer className="size-4 stroke-[2]" />
                Imprimir
              </Button>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold h-10 px-4 transition-all shadow-sm shadow-emerald-500/10 hover:shadow"
                onClick={descargarPdf}
              >
                <Download className="size-4 stroke-[2]" />
                Descargar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
