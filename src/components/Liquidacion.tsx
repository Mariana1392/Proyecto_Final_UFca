import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import {
  Search, Plus, Eye, ChevronLeft, ChevronRight,
  FileCog, FileText, Calendar, Upload, ExternalLink,
  AlertTriangle, Check, X, Users, Banknote,
  ShieldAlert, BarChart2, Clock, Activity,
  Download, Trash2, DollarSign, TrendingUp,
  Calculator, Info, CheckCircle2, Paperclip,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { asociadosApi } from '../lib/api';

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════
interface LiquidacionProps {
  userRole?: 'admin' | 'asociado' | null;
  userData?: any;
}

interface Concepto {
  id: number;
  nombre: string;
  monto: string;
  tipo: 'credito' | 'debito';
}

interface LiqDoc {
  id: string;
  liquidacion_id: string;
  nombre: string;
  url: string;
  tipo_archivo: string;
  subido_por: string;
  created_at: string;
}

interface AuditEntry {
  id: string;
  accion: string;
  detalle: string | null;
  usuario_id: string | null;
  created_at: string;
}

interface DatosCalculo {
  salarioMensual: number;
  fechaIngreso: string;
  fechaCorte: string;
  diasVacPendientes: number;
  tipo: 'retiro' | 'cesantias';
  ahorroPermanente: number;
  ahorroVoluntario: number;
  creditoPendiente: number;
}

// ══════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════
const TIPOS_LIQ = [
  { value: 'retiro',        label: 'Retiro voluntario' },
  { value: 'cesantias',     label: 'Cesantías' },
  { value: 'expulsion',     label: 'Expulsión' },
  { value: 'fallecimiento', label: 'Fallecimiento' },
  { value: 'otro',          label: 'Otro' },
];

const ESTADOS_LIQ = [
  { value: 'Borrador',   color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'Pendiente',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'En proceso', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'Aprobada',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'Pagada',     color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'Rechazada',  color: 'bg-red-100 text-red-700 border-red-200' },
];

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

const getEstadoBadge = (estado: string, anulado?: boolean) => {
  if (anulado) return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">Inválida</Badge>;
  const e = ESTADOS_LIQ.find(s => s.value === estado);
  return <Badge variant="outline" className={`${e?.color ?? 'bg-slate-100 text-slate-600'} text-xs`}>{estado}</Badge>;
};

const numLiq = (id: string) => `LIQ-${String(id).substring(0, 8).toUpperCase()}`;

/** Calcula días en notación colombiana (año=360, mes=30) */
function diasColombinos(inicio: Date, fin: Date): number {
  const y1 = inicio.getFullYear(), m1 = inicio.getMonth() + 1, d1 = Math.min(inicio.getDate(), 30);
  const y2 = fin.getFullYear(),   m2 = fin.getMonth() + 1,   d2 = Math.min(fin.getDate(), 30);
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

/** Días transcurridos en el semestre actual hasta la fecha de corte */
function diasSemestreActual(ingreso: Date, corte: Date): number {
  const mes = corte.getMonth(); // 0-indexed
  const inicioSemestre = new Date(corte.getFullYear(), mes < 6 ? 0 : 6, 1);
  const desde = ingreso > inicioSemestre ? ingreso : inicioSemestre;
  return Math.max(0, diasColombinos(desde, corte));
}

// ══════════════════════════════════════════════════════════════
// CALCULADORA COLOMBIANA (CST)
// ══════════════════════════════════════════════════════════════
/**
 * Reglas aplicadas:
 * - Cesantías:           (salario × días) / 360           [Art. 249 CST]
 * - Intereses cesantías: cesantías × 12% × (días/360)     [Ley 52/1975]
 * - Prima servicios:     (salario × días semestre) / 360  [Art. 306 CST]
 * - Vacaciones prop.:    (salario / 720) × días           [Art. 186 CST]
 * - Salario pendiente:   (salario / 30) × día del mes
 * - Días = notación colombiana (año=360, mes=30)
 */
function calcularLiquidacionCO(datos: DatosCalculo): { conceptos: Concepto[]; resumen: Record<string, number> } {
  const ingreso = new Date(datos.fechaIngreso + 'T00:00:00');
  const corte   = new Date(datos.fechaCorte   + 'T00:00:00');

  if (isNaN(ingreso.getTime()) || isNaN(corte.getTime()) || corte <= ingreso) {
    return { conceptos: [], resumen: {} };
  }

  const dias     = diasColombinos(ingreso, corte);
  const salDiario = datos.salarioMensual / 30;

  const conceptos: Concepto[] = [];
  const resumen: Record<string, number> = {};
  let nextId = 1;

  const add = (nombre: string, monto: number, tipo: 'credito' | 'debito') => {
    const rounded = Math.round(monto);
    if (rounded === 0) return;
    conceptos.push({ id: nextId++, nombre, monto: String(rounded), tipo });
    resumen[nombre] = rounded;
  };

  if (datos.tipo === 'retiro') {
    // ── 1. Salario pendiente del mes ─────────────────────────────────────
    const diaCorte = Math.min(corte.getDate(), 30);
    add('Salario pendiente del mes', salDiario * diaCorte, 'credito');

    // ── 2. Cesantías (Art. 249 CST) ──────────────────────────────────────
    const cesantias = (datos.salarioMensual * dias) / 360;
    add('Cesantías (Art. 249 CST)', cesantias, 'credito');

    // ── 3. Intereses de cesantías (Ley 52/1975 — 12% anual) ─────────────
    const intCesantias = cesantias * 0.12 * (Math.min(dias, 360) / 360);
    add('Intereses de cesantías 12% (Ley 52/1975)', intCesantias, 'credito');

    // ── 4. Prima de servicios (Art. 306 CST) ─────────────────────────────
    const diasSem = diasSemestreActual(ingreso, corte);
    const prima   = (datos.salarioMensual * diasSem) / 360;
    add('Prima de servicios (Art. 306 CST)', prima, 'credito');

    // ── 5. Vacaciones proporcionales (Art. 186 CST) ───────────────────────
    const vacProp = (datos.salarioMensual / 720) * dias;
    add('Vacaciones proporcionales (Art. 186 CST)', vacProp, 'credito');

    // ── 6. Días de vacaciones pendientes (si aplica) ──────────────────────
    if (datos.diasVacPendientes > 0) {
      add(`Vacaciones pendientes no disfrutadas (${datos.diasVacPendientes} días)`, salDiario * datos.diasVacPendientes, 'credito');
    }

    // ── 7. Ahorros del fondo ──────────────────────────────────────────────
    if (datos.ahorroPermanente > 0) add('Ahorro permanente acumulado', datos.ahorroPermanente, 'credito');
    if (datos.ahorroVoluntario  > 0) add('Ahorro voluntario acumulado',  datos.ahorroVoluntario,  'credito');

    // ── 8. Deducciones ────────────────────────────────────────────────────
    if (datos.creditoPendiente > 0) add('Saldo de crédito pendiente', datos.creditoPendiente, 'debito');

  } else if (datos.tipo === 'cesantias') {
    // Retiro parcial de cesantías (para vivienda o educación, Art. 256 CST)
    const cesantias = (datos.salarioMensual * dias) / 360;
    add('Cesantías acumuladas (Art. 249 CST)', cesantias, 'credito');

    const intCesantias = cesantias * 0.12 * (Math.min(dias, 360) / 360);
    add('Intereses de cesantías 12% (Ley 52/1975)', intCesantias, 'credito');

    if (datos.ahorroPermanente > 0) add('Ahorro permanente acumulado', datos.ahorroPermanente, 'credito');
    if (datos.ahorroVoluntario  > 0) add('Ahorro voluntario acumulado',  datos.ahorroVoluntario,  'credito');
    if (datos.creditoPendiente  > 0) add('Saldo de crédito pendiente',   datos.creditoPendiente,  'debito');
  }

  return { conceptos, resumen };
}

// ══════════════════════════════════════════════════════════════
// PDF GENERATOR
// ══════════════════════════════════════════════════════════════
function generateLiquidacionPDF(liq: any): boolean {
  try {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const tipoLabel = TIPOS_LIQ.find(t => t.value === liq.tipo)?.label ?? liq.tipo;
    const nLiq = numLiq(liq.id);

    // Header
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('UFCA', 14, 18);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Unión Familiar de Crédito y Ahorro', 14, 26);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('DOCUMENTO OFICIAL DE LIQUIDACIÓN', 14, 36);
    const fechaGen = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${fechaGen}`, pageW - 14, 36, { align: 'right' });

    let y = 52;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`N° Liquidación: ${nLiq}`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Tipo: ${tipoLabel}`, 110, y); y += 7;
    doc.text(`Fecha de corte: ${liq.fechaCorte ?? '—'}`, 14, y);
    doc.text(`Fecha liquidación: ${liq.fechaLiquidacion || '—'}`, 110, y); y += 7;
    const estadoText = liq.anulado ? 'INVÁLIDA' : (liq.estado ?? '—');
    doc.setFont('helvetica', 'bold');
    doc.text(`Estado: ${estadoText}`, 14, y); doc.setFont('helvetica', 'normal'); y += 4;
    doc.setDrawColor(200, 200, 200); doc.line(14, y, pageW - 14, y); y += 8;

    // Asociado
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(16, 185, 129);
    doc.text('DATOS DEL ASOCIADO', 14, y); y += 6;
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
    doc.text(`Nombre: ${liq.asociado}`, 14, y);
    doc.text(`Cédula: ${liq.cedula}`, 110, y); y += 6;
    if (liq.motivo) { doc.text(`Motivo: ${liq.motivo}`, 14, y); y += 6; }
    doc.setDrawColor(200, 200, 200); doc.line(14, y, pageW - 14, y); y += 8;

    // Datos laborales (si aplica)
    if (liq.calculo?.salarioMensual) {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(16, 185, 129);
      doc.text('DATOS LABORALES', 14, y); y += 6;
      doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
      doc.text(`Salario mensual: ${fmtCOP(liq.calculo.salarioMensual)}`, 14, y);
      doc.text(`Fecha de ingreso: ${liq.calculo.fechaIngreso}`, 110, y); y += 6;
      if (liq.calculo.diasVacPendientes > 0)
        doc.text(`Días vacaciones pendientes: ${liq.calculo.diasVacPendientes}`, 14, y);
      doc.setDrawColor(200, 200, 200); doc.line(14, y + 2, pageW - 14, y + 2); y += 10;
    }

    // Conceptos
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(16, 185, 129);
    doc.text('DESGLOSE DE CONCEPTOS', 14, y); y += 4;
    doc.setTextColor(0, 0, 0);

    const conceptos: Concepto[] = liq.conceptos ?? [];
    const tableRows = conceptos.map(c => {
      const monto = parseFloat(String(c.monto).replace(/[^\d.-]/g, '')) || 0;
      return [c.nombre, c.tipo === 'credito' ? 'Crédito (+)' : 'Débito (−)', c.tipo === 'credito' ? fmtCOP(monto) : `(${fmtCOP(Math.abs(monto))})`];
    });

    autoTable(doc, {
      startY: y,
      head: [['Concepto', 'Tipo', 'Monto']],
      body: tableRows.length > 0 ? tableRows : [['Sin conceptos registrados', '', '—']],
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 105 }, 1: { cellWidth: 35 }, 2: { cellWidth: 42, halign: 'right' } },
      margin: { left: 14, right: 14 },
    });

    y = ((doc as any).lastAutoTable?.finalY ?? y + 40) + 6;

    // Total
    doc.setFillColor(235, 255, 245); doc.setDrawColor(16, 185, 129); doc.setLineWidth(0.5);
    doc.rect(14, y - 4, pageW - 28, 14, 'FD');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 100, 60);
    doc.text('MONTO TOTAL DE LIQUIDACIÓN:', 18, y + 5);
    doc.text(fmtCOP(liq.montoFinal ?? 0), pageW - 18, y + 5, { align: 'right' });
    y += 22;

    if (liq.observaciones) {
      doc.setTextColor(0, 0, 0); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text('Observaciones:', 14, y); y += 5;
      const obsLines = doc.splitTextToSize(liq.observaciones, pageW - 28);
      doc.text(obsLines, 14, y); y += obsLines.length * 5 + 6;
    }

    if (liq.anulado && liq.justificacionAnulacion) {
      doc.setFillColor(255, 235, 235); doc.setDrawColor(220, 0, 0); doc.setLineWidth(0.5);
      doc.rect(14, y - 4, pageW - 28, 16, 'FD');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 0, 0);
      doc.text('DOCUMENTO INVÁLIDO — Motivo de anulación:', 18, y + 4);
      doc.setFont('helvetica', 'normal');
      const motLines = doc.splitTextToSize(liq.justificacionAnulacion, pageW - 36);
      doc.text(motLines, 18, y + 10); y += 22 + motLines.length * 4;
    }

    const selloY = Math.max(y + 8, 228);
    doc.setFillColor(230, 248, 255); doc.setDrawColor(16, 185, 129); doc.setLineWidth(0.6);
    doc.rect(14, selloY, pageW - 28, 44, 'FD');
    doc.setFillColor(16, 185, 129); doc.circle(30, selloY + 22, 13, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
    doc.text('UFCA', 30, selloY + 19, { align: 'center' });
    doc.text('VÁLIDO', 30, selloY + 25, { align: 'center' });
    doc.setTextColor(0, 60, 100); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('DOCUMENTO OFICIALMENTE VALIDADO', 50, selloY + 11);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
    doc.text('Este documento constituye constancia oficial de liquidación emitida por UFCA.', 50, selloY + 18);
    doc.text('Válido como soporte para trámites ante entidades financieras y estatales.', 50, selloY + 24);
    doc.setDrawColor(80, 80, 80); doc.line(50, selloY + 39, 150, selloY + 39);
    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 80, 80);
    doc.text('Firma y sello del Administrador UFCA', 100, selloY + 43, { align: 'center' });
    doc.setFontSize(7); doc.setTextColor(130, 130, 130);
    doc.text(nLiq, pageW - 16, selloY + 43, { align: 'right' });

    doc.save(`Liquidacion_${nLiq}_${(liq.asociado ?? 'asociado').replace(/\s+/g, '_')}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generando PDF:', err);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════
export default function Liquidacion({ userRole, userData }: LiquidacionProps) {

  // ── Data ─────────────────────────────────────────────────────
  const [liquidaciones, setLiquidaciones]               = useState<any[]>([]);
  const [asociadosDisponibles, setAsociadosDisponibles] = useState<any[]>([]);
  const [loading, setLoading]                           = useState(true);

  // ── Search / Filter ───────────────────────────────────────────
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterTipo, setFilterTipo]     = useState('');
  const [filterDesde, setFilterDesde]   = useState('');
  const [filterHasta, setFilterHasta]   = useState('');
  const [sortBy, setSortBy]             = useState<'fecha_desc'|'fecha_asc'|'monto_desc'|'monto_asc'>('fecha_desc');

  // ── Pagination ────────────────────────────────────────────────
  const [currentPage, setCurrentPage]               = useState(1);
  const [currentPageAnuladas, setCurrentPageAnuladas] = useState(1);
  const itemsPerPage = 10;

  // ── Dialogs ───────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAnularOpen, setIsAnularOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // ── Anular ────────────────────────────────────────────────────
  const [justificacionAnulacion, setJustificacionAnulacion] = useState('');
  const [anulando, setAnulando]                             = useState(false);

  // ── Documents (detail view) ───────────────────────────────────
  const [docsLiquidacion, setDocsLiquidacion]   = useState<LiqDoc[]>([]);
  const [loadingDocs, setLoadingDocs]           = useState(false);
  const [isUploadDocOpen, setIsUploadDocOpen]   = useState(false);
  const [uploadDocFile, setUploadDocFile]       = useState<File | null>(null);
  const [uploadDocNombre, setUploadDocNombre]   = useState('');
  const [uploadingDoc, setUploadingDoc]         = useState(false);

  // ── Auditoría de liquidación ──────────────────────────────────
  const [auditEntries, setAuditEntries]   = useState<AuditEntry[]>([]);
  const [loadingAudit, setLoadingAudit]   = useState(false);
  const [auditOpen, setAuditOpen]         = useState(false);
  const uploadDocRef                            = useRef<HTMLInputElement>(null);

  // ── Create form: basico ───────────────────────────────────────
  const [formAsociadoId, setFormAsociadoId]       = useState('');
  const [formAsocSearch, setFormAsocSearch]       = useState('');
  const [showAcomplete, setShowAcomplete]         = useState(false);
  const [formTipo, setFormTipo]                   = useState('retiro');
  const [formFechaCorte, setFormFechaCorte]       = useState('');
  const [formFechaLiq, setFormFechaLiq]           = useState('');
  const [formEstado, setFormEstado]               = useState('Borrador');
  const [formMotivo, setFormMotivo]               = useState('');
  const [formObservaciones, setFormObservaciones] = useState('');
  const acRef                                     = useRef<HTMLDivElement>(null);

  // ── Create form: calculadora ──────────────────────────────────
  const [formSalario, setFormSalario]               = useState('');
  const [formFechaIngreso, setFormFechaIngreso]     = useState('');
  const [formDiasVac, setFormDiasVac]               = useState('0');
  const [formAhorroPerm, setFormAhorroPerm]         = useState('');
  const [formAhorroVol, setFormAhorroVol]           = useState('');
  const [formCreditoPend, setFormCreditoPend]       = useState('');
  const [calculando, setCalculando]                 = useState(false);
  const [calculoHecho, setCalculoHecho]             = useState(false);
  const [datosAsocLoading, setDatosAsocLoading]     = useState(false);

  // ── Create form: conceptos ────────────────────────────────────
  const [formConceptos, setFormConceptos] = useState<Concepto[]>([
    { id: 1, nombre: 'Ahorro permanente',       monto: '', tipo: 'credito' },
    { id: 2, nombre: 'Saldo crédito pendiente', monto: '', tipo: 'debito'  },
  ]);

  // ── Create form: archivo ──────────────────────────────────────
  const [formArchivoFile, setFormArchivoFile] = useState<File | null>(null);
  const [dragOver, setDragOver]               = useState(false);
  const [saving, setSaving]                   = useState(false);
  const fileRef                               = useRef<HTMLInputElement>(null);

  // ── Associate view ────────────────────────────────────────────
  const [asocSearchTerm, setAsocSearchTerm]         = useState('');
  const [asocFilterEstado, setAsocFilterEstado]     = useState('');
  const [asocFilterDesde, setAsocFilterDesde]       = useState('');
  const [asocFilterHasta, setAsocFilterHasta]       = useState('');
  const [asocFilterRegDesde, setAsocFilterRegDesde] = useState('');
  const [asocFilterRegHasta, setAsocFilterRegHasta] = useState('');

  // ── Fecha de registro (admin) ─────────────────────────────────
  const [filterRegDesde, setFilterRegDesde] = useState('');
  const [filterRegHasta, setFilterRegHasta] = useState('');
  const [dateRangeError, setDateRangeError] = useState('');
  const [isSearching, setIsSearching]       = useState(false);

  // ── Debounce ref ──────────────────────────────────────────────
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Effects ───────────────────────────────────────────────────

  // Carga inicial: datos + asociados
  useEffect(() => { cargarDatos(); }, []);

  // Búsqueda con debounce al escribir en el campo nombre
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const term = searchTerm;
    // No ejecutar en montaje inicial (ya se cargó todo con cargarDatos)
    if (term === '' && !filterTipo && !filterRegDesde && !filterRegHasta) return;
    searchTimerRef.current = setTimeout(() => {
      setCurrentPage(1);
      buscarLiquidaciones({ term });
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchTerm]);

  // Re-búsqueda inmediata al cambiar filtros de selector/fecha
  useEffect(() => {
    // Evitar llamada en montaje
    if (!filterTipo && !filterRegDesde && !filterRegHasta) return;
    setCurrentPage(1);
    buscarLiquidaciones({ term: searchTerm });
  }, [filterTipo, filterRegDesde, filterRegHasta]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (acRef.current && !acRef.current.contains(e.target as Node)) setShowAcomplete(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Validación de rango de fechas ─────────────────────────────
  function validateDateRange(desde: string, hasta: string): string {
    if (!desde && !hasta) return '';
    if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) return 'Formato de fecha inicio inválido (YYYY-MM-DD)';
    if (hasta && !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return 'Formato de fecha fin inválido (YYYY-MM-DD)';
    if (desde && hasta && desde > hasta) return 'La fecha inicio no puede ser posterior a la fecha fin';
    if (hasta && hasta > new Date().toISOString().slice(0, 10)) return 'La fecha fin no puede ser futura';
    return '';
  }

  // ── Búsqueda server-side ──────────────────────────────────────
  async function buscarLiquidaciones(opts: { term?: string } = {}) {
    const nombre = (opts.term ?? searchTerm).trim();

    // Validar rango antes de enviar
    const err = validateDateRange(filterRegDesde, filterRegHasta);
    setDateRangeError(err);
    if (err) return;

    setIsSearching(true);
    try {
      // ── Determinar si el término es búsqueda por NOMBRE o por otro criterio ──
      // N° liquidación (LIQ-...), cédula (solo dígitos) y UUID parciales
      // se resuelven client-side en applyFilters, no server-side por nombre.
      const esNombre = nombre.length >= 2
        && !nombre.toUpperCase().startsWith('LIQ-')
        && !/^\d+$/.test(nombre)          // no es una cédula (solo números)
        && !/^[0-9a-f-]{6,}$/i.test(nombre); // no parece un UUID parcial

      // ── Paso 1: búsqueda server-side por nombre del asociado (solo si aplica) ──
      let asociadoIds: string[] | null = null;
      if (esNombre) {
        const { data: asocMatch, error: asocErr } = await supabase
          .from('asociados')
          .select('id')
          .ilike('nombre', `%${nombre}%`)
          .limit(200);
        if (asocErr) throw asocErr;
        asociadoIds = (asocMatch || []).map((a: any) => a.id);
        // Sin coincidencias de nombre → resultado vacío inmediato
        if (asociadoIds.length === 0) {
          setLiquidaciones([]);
          return;
        }
      }
      // Si NO es búsqueda por nombre (es LIQ-, cédula, etc.) →
      // asociadoIds queda null = carga todo y applyFilters filtra client-side

      // ── Paso 2: RPC de búsqueda (evita schema cache de PostgREST) ──
      const { data, error } = await supabase.rpc('buscar_liquidaciones', {
        p_asociado_ids: asociadoIds,                                                   // null = todos
        p_tipo:         filterTipo        || null,
        p_reg_desde:    filterRegDesde    ? filterRegDesde + 'T00:00:00' : null,
        p_reg_hasta:    filterRegHasta    ? filterRegHasta + 'T23:59:59' : null,
        p_limite:       500,
      });
      if (error) throw error;

      // Resolver nombres desde el mapa local (ya cargado en estado)
      const asocMap = buildAsocMap(asociadosDisponibles);
      setLiquidaciones(mapearFilas(data || [], asocMap));
    } catch (err: any) {
      toast.error('Error en búsqueda: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  }

  // ── Mapeador reutilizable ─────────────────────────────────────
  // asocMap: Record<asociado_id, { nombre, cedula }> — construido fuera del join
  function mapearFilas(rows: any[], asocMap: Record<string, { nombre: string; cedula: string }> = {}) {
    return rows.map((l: any) => {
      const det  = (l.detalle as any) ?? {};
      const asoc = asocMap[l.asociado_id] ?? { nombre: 'Sin nombre', cedula: '' };
      return {
        id:                     l.id,
        asociado:               asoc.nombre,
        cedula:                 asoc.cedula,
        asociado_id:            l.asociado_id,
        tipo:                   l.tipo                 ?? 'retiro',
        fechaCorte:             det.fechaCorte         ?? l.fecha ?? '',
        fechaLiquidacion:       det.fechaLiquidacion   ?? '',
        estado:                 det.estado             ?? 'Pendiente',
        motivo:                 det.motivo             ?? '',
        observaciones:          det.observaciones      ?? '',
        conceptos:              (det.conceptos as Concepto[]) ?? [],
        calculo:                det.calculo            ?? null,
        montoFinal:             l.monto_total          ?? 0,
        anulado:                det.anulado            ?? false,
        justificacionAnulacion: det.justificacionAnulacion ?? '',
        anuladoPor:             det.anuladoPor         ?? '',
        anuladoEn:              det.anuladoEn          ?? '',
        createdAt:              l.created_at           ?? l.fecha ?? '',
      };
    });
  }

  // ── Construye mapa id→{nombre,cedula} desde el array de asociados ──
  function buildAsocMap(lista: any[]): Record<string, { nombre: string; cedula: string }> {
    return Object.fromEntries(lista.map((a: any) => [a.id, { nombre: a.nombre ?? '', cedula: a.cedula ?? '' }]));
  }

  // ── Load data — bifurcado por rol ────────────────────────────
  async function cargarDatos() {
    setLoading(true);
    try {
      if (userRole === 'asociado') {
        // ── ASOCIADO: solo carga SUS liquidaciones desde el servidor ──
        // userData.asociado_id  → UUID en tabla asociados (el que está en liquidaciones.asociado_id)
        // userData.id           → UUID de auth.users (distinto al anterior)
        const asociadoId = userData?.asociado_id ?? null;
        if (!asociadoId) {
          // Usuario no vinculado a un asociado todavía
          setLiquidaciones([]);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.rpc('buscar_liquidaciones', {
          p_asociado_ids: [asociadoId],
          p_tipo:         null,
          p_reg_desde:    null,
          p_reg_hasta:    null,
          p_limite:       200,
        });
        if (error) throw error;
        // Construir asocMap con el ID correcto del asociado
        const asocMap: Record<string, { nombre: string; cedula: string }> = {
          [asociadoId]: {
            nombre: userData?.name ?? userData?.nombre ?? '',
            cedula: userData?.cedula ?? '',
          },
        };
        setLiquidaciones(mapearFilas(data || [], asocMap));
      } else {
        // ── ADMIN: carga todas las liquidaciones ──
        const [liqResult, asocData] = await Promise.all([
          supabase.rpc('listar_liquidaciones', { p_limite: 500 }),
          asociadosApi.getAll(),
        ]);
        if (liqResult.error) throw liqResult.error;
        const asocMap  = buildAsocMap(asocData || []);
        setLiquidaciones(mapearFilas(liqResult.data || [], asocMap));
        setAsociadosDisponibles(asocData || []);
      }
    } catch (err: any) {
      const msg = err.message ?? JSON.stringify(err);
      toast.error('Error al cargar: ' + msg, { duration: 15000 });
      console.error('[cargarDatos]', err);
    } finally {
      setLoading(false);
    }
  }

  async function cargarDocumentos(liqId: string) {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from('liquidacion_documentos')
        .select('*')
        .eq('liquidacion_id', liqId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocsLiquidacion(data || []);
    } catch {
      setDocsLiquidacion([]); // Tabla puede no existir aún — fallo silencioso
    } finally {
      setLoadingDocs(false);
    }
  }

  // ── Carga historial de auditoría de una liquidación ──────────
  async function cargarAuditoria(liqId: string) {
    setLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from('auditoria')
        .select('id, accion, detalle, usuario_id, created_at')
        .eq('registro_id', liqId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAuditEntries(data || []);
    } catch {
      setAuditEntries([]); // Fallo silencioso
    } finally {
      setLoadingAudit(false);
    }
  }

  // ── Registra un evento de auditoría para una liquidación ──────
  async function registrarAuditLiq(
    liqId: string,
    asociadoId: string,
    accion: string,
    detalle: Record<string, any>,
  ) {
    try {
      await supabase.from('auditoria').insert({
        tabla:       'liquidaciones',
        registro_id: liqId,
        asociado_id: asociadoId,
        usuario_id:  userData?.id ?? null,
        accion,
        detalle: JSON.stringify(detalle),
      });
    } catch {
      // No interrumpir el flujo principal si la auditoría falla
    }
  }

  // ── Load datos financieros del asociado para la calculadora ───
  async function cargarDatosAsociado(id: string) {
    setDatosAsocLoading(true);
    try {
      const [apRes, avRes, crRes] = await Promise.all([
        supabase.from('ahorro_permanente').select('monto_ahorrado').eq('asociado_id', id).eq('anulado', false),
        supabase.from('ahorro_voluntario').select('monto_ahorrado').eq('asociado_id', id).eq('anulado', false),
        supabase.from('creditos').select('saldo').eq('asociado_id', id).in('estado', ['activo', 'pendiente', 'aprobado', 'desembolsado', 'en_mora']).eq('anulado', false),
      ]);
      const totAP = (apRes.data || []).reduce((s: number, r: any) => s + (r.monto_ahorrado || 0), 0);
      const totAV = (avRes.data || []).reduce((s: number, r: any) => s + (r.monto_ahorrado || 0), 0);
      const totCr = (crRes.data || []).reduce((s: number, r: any) => s + (r.saldo || 0), 0);
      setFormAhorroPerm(totAP > 0 ? String(Math.round(totAP)) : '');
      setFormAhorroVol(totAV  > 0 ? String(Math.round(totAV))  : '');
      setFormCreditoPend(totCr > 0 ? String(Math.round(totCr)) : '');
    } catch {
      // Fallo silencioso — el admin puede ingresar los valores manualmente
    } finally {
      setDatosAsocLoading(false);
    }
  }

  // ── Calculadora ───────────────────────────────────────────────
  const handleCalcular = () => {
    const salario = parseFloat(formSalario.replace(/[^\d.]/g, ''));
    if (!salario || salario <= 0) {
      toast.error('Ingresa el salario mensual base');
      return;
    }
    if (!formFechaIngreso) {
      toast.error('Ingresa la fecha de ingreso del asociado');
      return;
    }
    if (!formFechaCorte) {
      toast.error('Ingresa la fecha de corte (campo habilitado en esta pestaña)');
      return;
    }
    if (formFechaIngreso >= formFechaCorte) {
      toast.error('La fecha de ingreso debe ser anterior a la fecha de corte');
      return;
    }
    if (!['retiro','cesantias'].includes(formTipo)) {
      toast.info('La calculadora aplica solo para Retiro voluntario y Cesantías. Ingresa los conceptos manualmente en la pestaña Conceptos.');
      return;
    }

    setCalculando(true);
    setTimeout(() => {
      const datos: DatosCalculo = {
        salarioMensual:   salario,
        fechaIngreso:     formFechaIngreso,
        fechaCorte:       formFechaCorte,
        diasVacPendientes: parseInt(formDiasVac) || 0,
        tipo:             formTipo as 'retiro' | 'cesantias',
        ahorroPermanente: parseFloat(formAhorroPerm.replace(/[^\d.]/g, '')) || 0,
        ahorroVoluntario:  parseFloat(formAhorroVol.replace(/[^\d.]/g,''))  || 0,
        creditoPendiente:  parseFloat(formCreditoPend.replace(/[^\d.]/g,'')) || 0,
      };
      const { conceptos } = calcularLiquidacionCO(datos);
      if (conceptos.length === 0) {
        toast.error('No se pudo calcular. Verifica que la fecha de corte sea posterior a la de ingreso.');
        setCalculando(false); return;
      }
      setFormConceptos(conceptos);
      setCalculoHecho(true);
      setCalculando(false);
      toast.success(`${conceptos.length} conceptos calculados según legislación colombiana`);
    }, 400);
  };

  // ── Computed ──────────────────────────────────────────────────
  const montoCalculado = formConceptos.reduce((s, c) => {
    const v = parseFloat(String(c.monto).replace(/[^\d.-]/g, '')) || 0;
    return s + (c.tipo === 'credito' ? v : -Math.abs(v));
  }, 0);

  /**
   * applyFilters — sólo filtros CLIENT-SIDE que no puede hacer el servidor:
   *   • estado          → guardado en JSONB detalle->>'estado'
   *   • fechaCorte range → guardado en JSONB detalle->>'fechaCorte'
   *   • búsqueda por cédula / N° liquidación (bonus, además del nombre server-side)
   * El servidor ya filtró por: nombre, tipo, rango created_at
   */
  const applyFilters = (list: any[]) =>
    list
      .filter(l => {
        // Búsqueda residual client-side: cédula y N° liquidación
        const term = searchTerm.toLowerCase().trim();
        const nL   = numLiq(l.id).toLowerCase();
        const matchSearch = !term || term.length < 2
          || l.asociado.toLowerCase().includes(term)
          || l.cedula.includes(term)
          || nL.includes(term)
          || (l.motivo || '').toLowerCase().includes(term);

        // Estado (client-side — JSONB)
        const matchEstado = !filterEstado || l.estado === filterEstado;

        // Rango de fecha de corte (client-side — JSONB)
        const matchDesde  = !filterDesde || (l.fechaCorte >= filterDesde);
        const matchHasta  = !filterHasta || (l.fechaCorte <= filterHasta);

        return matchSearch && matchEstado && matchDesde && matchHasta;
      })
      .sort((a, b) => {
        if (sortBy === 'fecha_desc')  return new Date(b.fechaCorte||b.createdAt).getTime() - new Date(a.fechaCorte||a.createdAt).getTime();
        if (sortBy === 'fecha_asc')   return new Date(a.fechaCorte||a.createdAt).getTime() - new Date(b.fechaCorte||b.createdAt).getTime();
        if (sortBy === 'monto_desc')  return (b.montoFinal??0) - (a.montoFinal??0);
        if (sortBy === 'monto_asc')   return (a.montoFinal??0) - (b.montoFinal??0);
        return 0;
      });

  const activas         = applyFilters(liquidaciones.filter(l => !l.anulado));
  const anuladas        = applyFilters(liquidaciones.filter(l => l.anulado));
  const todasActivas    = liquidaciones.filter(l => !l.anulado);
  const pagActivas      = activas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pagAnuladas     = anuladas.slice((currentPageAnuladas-1) * itemsPerPage, currentPageAnuladas * itemsPerPage);
  const totalPagActivas = Math.ceil(activas.length / itemsPerPage);
  const totalPagAn      = Math.ceil(anuladas.length / itemsPerPage);
  const montoTotal      = todasActivas.reduce((s, l) => s + (l.montoFinal??0), 0);
  const cantPagadas     = todasActivas.filter(l => l.estado === 'Pagada').length;
  const cantPendientes  = todasActivas.filter(l => l.estado === 'Pendiente' || l.estado === 'En proceso').length;

  // ── Autocomplete asociados ────────────────────────────────────
  const acSuggestions = asociadosDisponibles
    .filter(a => a.estado && (a.nombre.toLowerCase().includes(formAsocSearch.toLowerCase()) || a.cedula.includes(formAsocSearch)))
    .slice(0, 8);

  const handleSelectAsociado = (a: any) => {
    setFormAsociadoId(a.id);
    setFormAsocSearch(`${a.nombre}  ·  ${a.cedula}`);
    setShowAcomplete(false);
    // Precargar datos financieros
    cargarDatosAsociado(a.id);
    // Si la fecha de ingreso existe en el registro del asociado, precargarla
    if (a.fecha_ingreso) setFormFechaIngreso(a.fecha_ingreso);
  };

  const addConcepto    = () => setFormConceptos(p => [...p, { id: Date.now(), nombre: '', monto: '', tipo: 'credito' }]);
  const removeConcepto = (id: number) => setFormConceptos(p => p.filter(c => c.id !== id));
  const updateConcepto = (id: number, field: keyof Concepto, value: string) =>
    setFormConceptos(p => p.map(c => c.id === id ? { ...c, [field]: value } : c));

  const handleFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error('El archivo supera los 10 MB'); return; }
    const allowed = ['application/pdf','image/jpeg','image/png','image/webp',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) { toast.error('Formato no permitido (PDF, JPG, PNG, Word)'); return; }
    setFormArchivoFile(file);
  };

  const resetForm = () => {
    setFormAsociadoId(''); setFormAsocSearch('');
    setFormTipo('retiro'); setFormFechaCorte(''); setFormFechaLiq('');
    setFormEstado('Pendiente'); setFormMotivo(''); setFormObservaciones('');
    setFormSalario(''); setFormFechaIngreso(''); setFormDiasVac('0');
    setFormAhorroPerm(''); setFormAhorroVol(''); setFormCreditoPend('');
    setCalculoHecho(false);
    setFormConceptos([
      { id: 1, nombre: 'Ahorro permanente',       monto: '', tipo: 'credito' },
      { id: 2, nombre: 'Saldo crédito pendiente', monto: '', tipo: 'debito'  },
    ]);
    setFormArchivoFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Save liquidación ──────────────────────────────────────────
  const handleSave = async () => {
    if (!formAsociadoId)    { toast.error('Selecciona un asociado'); return; }
    if (!formFechaCorte)    { toast.error('Ingresa la fecha de corte'); return; }
    if (formConceptos.some(c => !c.nombre.trim())) { toast.error('Todos los conceptos deben tener nombre'); return; }
    if (montoCalculado <= 0) { toast.error('El monto total debe ser mayor a cero'); return; }

    let urlFinal: string | null = null;
    if (formArchivoFile) {
      try {
        const ext  = formArchivoFile.name.split('.').pop() ?? 'bin';
        const path = `${formAsociadoId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('liquidaciones-documentos').upload(path, formArchivoFile, { upsert: true });
        if (upErr) throw new Error('Error al subir archivo: ' + upErr.message);
        const { data: urlData } = supabase.storage.from('liquidaciones-documentos').getPublicUrl(path);
        urlFinal = urlData.publicUrl;
      } catch (err: any) { toast.error(err.message); return; }
    }

    setSaving(true);
    try {
      // Datos del cálculo si se usó la calculadora
      const calculoGuardado = calculoHecho ? {
        salarioMensual:   parseFloat(formSalario.replace(/[^\d.]/g,'')),
        fechaIngreso:     formFechaIngreso,
        diasVacPendientes: parseInt(formDiasVac) || 0,
      } : null;

      const detalle = {
        fechaCorte:      formFechaCorte,
        fechaLiquidacion: formFechaLiq || null,
        estado:          formEstado,
        motivo:          formMotivo.trim()        || null,
        observaciones:   formObservaciones.trim() || null,
        conceptos:       formConceptos,
        calculo:         calculoGuardado,
        anulado:         false,
      };

      // Usamos RPC para evitar problemas con el schema cache de PostgREST
      const { data: nuevaId, error } = await supabase.rpc('insertar_liquidacion', {
        p_asociado_id: formAsociadoId,
        p_fecha:       formFechaCorte,
        p_monto_total: montoCalculado,
        p_tipo:        formTipo,
        p_detalle:     detalle,
      });
      if (error) throw error;
      const nueva = { id: nuevaId as string };

      // Si hay archivo inicial, registrarlo en liquidacion_documentos
      if (urlFinal && nueva?.id) {
        const ext = formArchivoFile!.name.split('.').pop()?.toLowerCase() ?? 'pdf';
        await supabase.from('liquidacion_documentos').insert({
          liquidacion_id: nueva.id,
          nombre: formArchivoFile!.name,
          url: urlFinal,
          tipo_archivo: ext,
          subido_por: userData?.nombre ?? userData?.email ?? 'Administrador',
        });
      }

      const asociado = asociadosDisponibles.find(a => a.id === formAsociadoId);
      setLiquidaciones(prev => [{
        id: nueva.id,
        asociado:       asociado?.nombre ?? '',
        cedula:         asociado?.cedula ?? '',
        asociado_id:    formAsociadoId,
        tipo:           formTipo,
        fechaCorte:     formFechaCorte,
        fechaLiquidacion: formFechaLiq,
        estado:         formEstado,
        motivo:         formMotivo.trim(),
        observaciones:  formObservaciones.trim(),
        conceptos:      formConceptos,
        calculo:        calculoGuardado,
        montoFinal:     montoCalculado,
        anulado:        false,
        justificacionAnulacion: '', anuladoPor: '', anuladoEn: '',
        createdAt: new Date().toISOString(),
      }, ...prev]);

      toast.success('✅ Liquidación registrada exitosamente', {
        description: `${asociado?.nombre} · ${fmtCOP(montoCalculado)}`,
      });
      setIsCreateOpen(false);
      resetForm();
    } catch (err: any) {
      const msg = err.message ?? JSON.stringify(err);
      toast.error('Error al guardar: ' + msg, { duration: 15000 });
      console.error('[handleSave]', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Subir documento a liquidación existente ───────────────────
  const handleUploadDoc = async () => {
    if (!uploadDocFile)   { toast.error('Selecciona un archivo'); return; }
    if (!uploadDocNombre.trim()) { toast.error('Ingresa un nombre para el documento'); return; }
    if (!selectedItem?.id) return;

    setUploadingDoc(true);
    try {
      const ext  = uploadDocFile.name.split('.').pop() ?? 'bin';
      const path = `${selectedItem.asociado_id}/${selectedItem.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('liquidaciones-documentos').upload(path, uploadDocFile, { upsert: true });
      if (upErr) throw new Error('Error al subir: ' + upErr.message);
      const { data: urlData } = supabase.storage.from('liquidaciones-documentos').getPublicUrl(path);

      const { data: docData, error: docErr } = await supabase.from('liquidacion_documentos').insert({
        liquidacion_id: selectedItem.id,
        nombre:         uploadDocNombre.trim(),
        url:            urlData.publicUrl,
        tipo_archivo:   ext.toLowerCase(),
        subido_por:     userData?.nombre ?? userData?.email ?? 'Administrador',
      }).select().single();
      if (docErr) throw docErr;

      setDocsLiquidacion(prev => [docData, ...prev]);
      toast.success('Documento subido exitosamente');
      setIsUploadDocOpen(false);
      setUploadDocFile(null);
      setUploadDocNombre('');
      if (uploadDocRef.current) uploadDocRef.current.value = '';
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      const { error } = await supabase.from('liquidacion_documentos').delete().eq('id', docId);
      if (error) throw error;
      setDocsLiquidacion(prev => prev.filter(d => d.id !== docId));
      toast.success('Documento eliminado');
    } catch (err: any) {
      toast.error('Error al eliminar documento: ' + err.message);
    }
  };

  // ── Actualizar estado rápido ──────────────────────────────────
  const handleCambiarEstado = async (liq: any, nuevoEstado: string) => {
    try {
      const detActualizado = { ...liq, estado: nuevoEstado, fechaCorte: liq.fechaCorte, conceptos: liq.conceptos };
      const detalle = {
        fechaCorte:             liq.fechaCorte,
        fechaLiquidacion:       liq.fechaLiquidacion,
        estado:                 nuevoEstado,
        motivo:                 liq.motivo,
        observaciones:          liq.observaciones,
        conceptos:              liq.conceptos,
        calculo:                liq.calculo,
        anulado:                liq.anulado,
        justificacionAnulacion: liq.justificacionAnulacion,
        anuladoPor:             liq.anuladoPor,
        anuladoEn:              liq.anuladoEn,
      };
      const { error } = await supabase.rpc('actualizar_detalle_liquidacion', {
        p_id:      liq.id,
        p_detalle: detalle,
      });
      if (error) throw error;
      setLiquidaciones(prev => prev.map(l => l.id === liq.id ? { ...l, estado: nuevoEstado } : l));
      if (selectedItem?.id === liq.id) setSelectedItem((prev: any) => ({ ...prev, estado: nuevoEstado }));

      // ── Acciones automáticas por transición de estado ──────────
      if (nuevoEstado === 'Aprobada' && liq.asociado_id) {
        try {
          await supabase.from('notificaciones').insert({
            asociado_id: liq.asociado_id,
            titulo: '✅ Liquidación aprobada',
            mensaje: `Tu liquidación ${numLiq(liq.id)} ha sido aprobada por un monto de ${fmtCOP(liq.montoFinal ?? 0)}.`,
            tipo: 'liquidacion_aprobada',
            leida: false,
          });
        } catch { /* notificación no crítica */ }
      }

      if (nuevoEstado === 'Pagada' && liq.asociado_id) {
        try {
          await Promise.all([
            // Marcar asociado como liquidado
            supabase.from('asociados').update({
              estado: 'inactivo',
              fecha_cambio_estado: new Date().toISOString(),
              modificado_por: userData?.nombre ?? 'Administrador',
            }).eq('id', liq.asociado_id),
            // Cerrar cuentas de ahorro permanente
            supabase.from('ahorro_permanente').update({ estado: false })
              .eq('asociado_id', liq.asociado_id).eq('anulado', false),
            // Cerrar cuentas de ahorro voluntario
            supabase.from('ahorro_voluntario').update({ estado: false })
              .eq('asociado_id', liq.asociado_id).eq('anulado', false),
          ]);
        } catch { /* cierre de productos no crítico */ }

        try {
          await supabase.from('notificaciones').insert({
            asociado_id: liq.asociado_id,
            titulo: '💰 Liquidación pagada',
            mensaje: `Tu liquidación ${numLiq(liq.id)} ha sido procesada y pagada por ${fmtCOP(liq.montoFinal ?? 0)}. Tus productos han sido cerrados.`,
            tipo: 'liquidacion_pagada',
            leida: false,
          });
        } catch { /* notificación no crítica */ }

        await registrarAuditLiq(liq.id, liq.asociado_id, 'PAGO REALIZADO', {
          numLiquidacion: numLiq(liq.id),
          asociado:       liq.asociado,
          monto:          liq.montoFinal ?? 0,
          realizadoPor:   userData?.nombre ?? 'Administrador',
          fecha:          new Date().toISOString(),
        });
      }

      toast.success(`Estado actualizado a "${nuevoEstado}"`);
    } catch (err: any) {
      toast.error('Error al actualizar estado: ' + err.message);
    }
  };

  // ── Anular ────────────────────────────────────────────────────
  const handleAnular = async () => {
    if (!selectedItem || !justificacionAnulacion.trim()) return;
    setAnulando(true);
    try {
      const admin = userData?.nombre ?? userData?.email ?? 'Administrador';
      const ahora = new Date().toISOString();
      const detActualizado = {
        fechaCorte:             selectedItem.fechaCorte,
        fechaLiquidacion:       selectedItem.fechaLiquidacion,
        estado:                 selectedItem.estado,
        motivo:                 selectedItem.motivo,
        observaciones:          selectedItem.observaciones,
        conceptos:              selectedItem.conceptos,
        calculo:                selectedItem.calculo,
        anulado:                true,
        justificacionAnulacion: justificacionAnulacion.trim(),
        anuladoPor:             admin,
        anuladoEn:              ahora,
      };
      const { error } = await supabase.rpc('actualizar_detalle_liquidacion', {
        p_id:      selectedItem.id,
        p_detalle: detActualizado,
      });
      if (error) throw error;

      setLiquidaciones(prev => prev.map(l =>
        l.id === selectedItem.id
          ? { ...l, anulado: true, justificacionAnulacion: justificacionAnulacion.trim(), anuladoPor: admin, anuladoEn: ahora }
          : l
      ));

      // Registrar en auditoría
      await registrarAuditLiq(
        selectedItem.id,
        selectedItem.asociado_id,
        'ANULACIÓN',
        {
          numLiquidacion:  numLiq(selectedItem.id),
          asociado:        selectedItem.asociado,
          tipo:            TIPOS_LIQ.find(t => t.value === selectedItem.tipo)?.label ?? selectedItem.tipo,
          montoFinal:      selectedItem.montoFinal,
          justificacion:   justificacionAnulacion.trim(),
          anuladoPor:      admin,
          anuladoEn:       ahora,
        }
      );

      toast.success(`Liquidación de "${selectedItem.asociado}" marcada como Inválida`);
      setIsAnularOpen(false);
      setSelectedItem(null);
      setJustificacionAnulacion('');
    } catch (err: any) {
      toast.error('Error al anular: ' + err.message);
    } finally {
      setAnulando(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // DETAIL DIALOG
  // ══════════════════════════════════════════════════════════════
  const renderDetailDialog = () => {
    const si = selectedItem;
    if (!si) return null;

    const tipoLabel   = TIPOS_LIQ.find(t => t.value === si.tipo)?.label ?? si.tipo ?? '—';
    const totalCreditos = (si.conceptos as Concepto[])?.filter(c => c.tipo === 'credito')
      .reduce((s, c) => s + (parseFloat(String(c.monto).replace(/[^\d.-]/g,''))||0), 0) ?? 0;
    const totalDebitos = (si.conceptos as Concepto[])?.filter(c => c.tipo === 'debito')
      .reduce((s, c) => s + Math.abs(parseFloat(String(c.monto).replace(/[^\d.-]/g,''))||0), 0) ?? 0;
    const fechaRegistroFmt = si.createdAt
      ? new Date(si.createdAt).toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' })
      : '—';
    const horaRegistroFmt = si.createdAt
      ? new Date(si.createdAt).toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' })
      : '';

    return (
      <Dialog open={isDetailOpen} onOpenChange={open => { setIsDetailOpen(open); if (!open) { setSelectedItem(null); setDocsLiquidacion([]); setAuditEntries([]); setAuditOpen(false); } }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileCog className="size-5 text-emerald-600" />
              Detalle completo de liquidación
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {numLiq(si.id)} · {tipoLabel} · Registrada el {fechaRegistroFmt}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="info"      className="text-xs gap-1"><FileCog className="size-3" />Información</TabsTrigger>
              <TabsTrigger value="conceptos" className="text-xs gap-1"><BarChart2 className="size-3" />Desglose ({(si.conceptos as Concepto[])?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="documentos" className="text-xs gap-1"><Paperclip className="size-3" />Documentos ({docsLiquidacion.length})</TabsTrigger>
            </TabsList>

            {/* ══════════════ TAB 1 — INFORMACIÓN GENERAL ══════════════ */}
            <TabsContent value="info" className="space-y-4 pt-4">

              {/* ── Encabezado de la liquidación ── */}
              <div className="rounded-xl border overflow-hidden">
                <div className={`px-4 py-3 flex items-center justify-between ${si.anulado ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-600 to-teal-600'}`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                      <FileCog className="size-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/70 font-medium uppercase tracking-wider">N° Liquidación</p>
                      <p className="text-xl font-bold text-white tracking-widest font-mono">{numLiq(si.id)}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-xs block">{tipoLabel}</Badge>
                    {getEstadoBadge(si.estado, si.anulado)}
                  </div>
                </div>

                {/* ── Datos del asociado + fechas ── */}
                <div className="bg-white border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-emerald-100 rounded-full shrink-0">
                      <Users className="size-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{si.asociado || '—'}</p>
                      <p className="text-xs text-slate-500">{si.cedula ? `C.C. ${si.cedula}` : 'Sin cédula registrada'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Calendar className="size-3" /> Fecha de corte
                      </p>
                      <p className="font-bold text-slate-800">{si.fechaCorte || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Calendar className="size-3" /> Fecha de liquidación
                      </p>
                      <p className="font-bold text-slate-800">{si.fechaLiquidacion || '—'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Clock className="size-3" /> Fecha de registro
                      </p>
                      <p className="font-bold text-slate-800">{fechaRegistroFmt}</p>
                      {horaRegistroFmt && <p className="text-[10px] text-slate-400 mt-0.5">{horaRegistroFmt}</p>}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Conceptos</p>
                      <p className="font-bold text-slate-800">{(si.conceptos as Concepto[])?.length ?? 0} ítem(s)</p>
                    </div>
                  </div>
                </div>

                {/* Motivo */}
                {si.motivo && (
                  <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5">
                    <p className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold mb-0.5">Motivo</p>
                    <p className="text-sm text-slate-700">{si.motivo}</p>
                  </div>
                )}
              </div>

              {/* ── Resumen financiero ── */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold">Total créditos</p>
                  <p className="text-base font-bold text-emerald-700 mt-1">+{fmtCOP(totalCreditos)}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-red-600 uppercase tracking-wider font-semibold">Total débitos</p>
                  <p className="text-base font-bold text-red-600 mt-1">−{fmtCOP(totalDebitos)}</p>
                </div>
                <div className={`border rounded-xl p-3 text-center ${si.montoFinal >= 0 ? 'bg-gradient-to-b from-emerald-50 to-teal-50 border-emerald-300' : 'bg-red-50 border-red-300'}`}>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Monto final</p>
                  <p className={`text-xl font-bold mt-1 ${si.montoFinal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {fmtCOP(si.montoFinal ?? 0)}
                  </p>
                </div>
              </div>

              {/* ── Datos del cálculo (si existen) ── */}
              {si.calculo && (
                <div className="rounded-xl border border-blue-200 overflow-hidden">
                  <div className="bg-blue-600 px-4 py-2.5 flex items-center gap-2">
                    <Calculator className="size-4 text-blue-100" />
                    <p className="text-xs font-semibold text-white uppercase tracking-wider">Datos del cálculo — Legislación colombiana (CST)</p>
                  </div>
                  <div className="bg-blue-50 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Salario mensual base</p>
                      <p className="font-bold text-slate-900 text-sm">{fmtCOP(si.calculo.salarioMensual ?? 0)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Fecha de ingreso</p>
                      <p className="font-bold text-slate-900">{si.calculo.fechaIngreso || '—'}</p>
                    </div>
                    <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Días vac. pendientes</p>
                      <p className="font-bold text-slate-900">{si.calculo.diasVacPendientes ?? 0} días</p>
                    </div>
                    {si.calculo.ahorroPermanente > 0 && (
                      <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Ahorro permanente</p>
                        <p className="font-bold text-emerald-700">{fmtCOP(si.calculo.ahorroPermanente)}</p>
                      </div>
                    )}
                    {si.calculo.ahorroVoluntario > 0 && (
                      <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Ahorro voluntario</p>
                        <p className="font-bold text-emerald-700">{fmtCOP(si.calculo.ahorroVoluntario)}</p>
                      </div>
                    )}
                    {si.calculo.creditoPendiente > 0 && (
                      <div className="bg-white rounded-lg p-2.5 border border-red-100">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Crédito pendiente</p>
                        <p className="font-bold text-red-600">{fmtCOP(si.calculo.creditoPendiente)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Observaciones ── */}
              {si.observaciones && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Info className="size-3.5" /> Observaciones
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">{si.observaciones}</p>
                </div>
              )}

              {/* ── Anulación ── */}
              {si.anulado && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-red-500" />
                    <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Liquidación Inválida — Anulada</p>
                  </div>
                  <p className="text-sm text-red-700">
                    <span className="font-semibold">Justificación:</span> {si.justificacionAnulacion || '—'}
                  </p>
                  {si.anuladoPor && (
                    <p className="text-xs text-red-500">
                      Anulada por: <span className="font-semibold">{si.anuladoPor}</span>
                      {si.anuladoEn && (
                        <span> · {new Date(si.anuladoEn).toLocaleString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* ── Cambio de estado (solo admin, no anulada) ── */}
              {userRole === 'admin' && !si.anulado && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs font-semibold text-slate-600 whitespace-nowrap flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 text-emerald-500" /> Cambiar estado:
                  </p>
                  <Select value={si.estado} onValueChange={v => handleCambiarEstado(si, v)}>
                    <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTADOS_LIQ.map(e => <SelectItem key={e.value} value={e.value} className="text-xs">{e.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* ── Historial de auditoría (desplegable) ── */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                  onClick={() => setAuditOpen(o => !o)}
                >
                  <div className="flex items-center gap-2">
                    <Activity className="size-4 text-slate-500" />
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Historial de auditoría</p>
                    {auditEntries.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                        {auditEntries.length}
                      </span>
                    )}
                  </div>
                  <div className={`transition-transform duration-200 ${auditOpen ? 'rotate-90' : '-rotate-90'}`}>
                    <ChevronLeft className="size-4 text-slate-400" />
                  </div>
                </button>
                {auditOpen && (
                  <div className="divide-y divide-slate-100">
                    {loadingAudit ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400" />
                        <span className="text-xs">Cargando historial...</span>
                      </div>
                    ) : auditEntries.length === 0 ? (
                      <div className="flex flex-col items-center py-8 gap-2 text-slate-400">
                        <Clock className="size-6 text-slate-300" />
                        <p className="text-xs">Sin eventos de auditoría registrados</p>
                      </div>
                    ) : (
                      auditEntries.map((entry, idx) => {
                        let det: Record<string, any> = {};
                        try { det = entry.detalle ? JSON.parse(entry.detalle) : {}; } catch { det = {}; }
                        const esAnulacion = entry.accion === 'ANULACIÓN';
                        const fecha = new Date(entry.created_at).toLocaleString('es-CO', {
                          day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit',
                        });
                        return (
                          <div key={entry.id} className="px-4 py-3 flex gap-3">
                            <div className="flex flex-col items-center pt-0.5">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${esAnulacion ? 'bg-red-100' : 'bg-slate-100'}`}>
                                {esAnulacion ? <ShieldAlert className="size-3.5 text-red-600" /> : <Activity className="size-3.5 text-slate-500" />}
                              </div>
                              {idx < auditEntries.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[16px]" />}
                            </div>
                            <div className="flex-1 min-w-0 pb-1">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className={`text-[11px] font-bold uppercase tracking-wider ${esAnulacion ? 'text-red-600' : 'text-slate-700'}`}>{entry.accion}</span>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">{fecha}</span>
                              </div>
                              {esAnulacion && (
                                <div className="space-y-0.5 text-xs text-slate-600">
                                  {det.justificacion && <p><span className="text-slate-400">Motivo: </span>{det.justificacion}</p>}
                                  {det.anuladoPor    && <p><span className="text-slate-400">Por: </span>{det.anuladoPor}</p>}
                                  {det.montoFinal !== undefined && (
                                    <p><span className="text-slate-400">Monto anulado: </span><span className="font-semibold text-red-600">{fmtCOP(det.montoFinal)}</span></p>
                                  )}
                                </div>
                              )}
                              {!esAnulacion && det.descripcion && <p className="text-xs text-slate-500">{det.descripcion}</p>}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ══════════════ TAB 2 — DESGLOSE DE CONCEPTOS ══════════════ */}
            <TabsContent value="conceptos" className="pt-4">
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-700 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="size-4 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Desglose de conceptos</p>
                  </div>
                  <span className="text-[10px] text-slate-400">{(si.conceptos as Concepto[])?.length ?? 0} conceptos</span>
                </div>

                {(si.conceptos as Concepto[])?.length > 0 ? (
                  <>
                    {/* Separador créditos */}
                    <div className="px-4 py-1.5 bg-emerald-50 border-b border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Créditos (ingresos)</p>
                    </div>
                    {(si.conceptos as Concepto[]).filter(c => c.tipo === 'credito').map((c, idx) => {
                      const monto = parseFloat(String(c.monto).replace(/[^\d.-]/g,'')) || 0;
                      return (
                        <div key={`cr-${idx}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-emerald-50/40 border-b border-slate-50">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="text-sm text-slate-700">{c.nombre}</span>
                          </div>
                          <span className="text-sm font-semibold text-emerald-700">+{fmtCOP(monto)}</span>
                        </div>
                      );
                    })}

                    {/* Separador débitos */}
                    {(si.conceptos as Concepto[]).some(c => c.tipo === 'debito') && (
                      <>
                        <div className="px-4 py-1.5 bg-red-50 border-y border-red-100">
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Débitos (descuentos)</p>
                        </div>
                        {(si.conceptos as Concepto[]).filter(c => c.tipo === 'debito').map((c, idx) => {
                          const monto = Math.abs(parseFloat(String(c.monto).replace(/[^\d.-]/g,'')) || 0);
                          return (
                            <div key={`db-${idx}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-red-50/40 border-b border-slate-50">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                                <span className="text-sm text-slate-700">{c.nombre}</span>
                              </div>
                              <span className="text-sm font-semibold text-red-600">−{fmtCOP(monto)}</span>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Totales */}
                    <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <p className="text-slate-400 uppercase tracking-wider text-[10px]">Total créditos</p>
                        <p className="font-bold text-emerald-700 text-base">+{fmtCOP(totalCreditos)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-400 uppercase tracking-wider text-[10px]">Total débitos</p>
                        <p className="font-bold text-red-600 text-base">−{fmtCOP(totalDebitos)}</p>
                      </div>
                      <div className="text-center border-l border-slate-200">
                        <p className="text-slate-400 uppercase tracking-wider text-[10px]">Neto a pagar</p>
                        <p className={`font-bold text-lg ${si.montoFinal >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {fmtCOP(si.montoFinal ?? 0)}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center py-10 text-slate-400 gap-2">
                    <BarChart2 className="size-8 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">Sin conceptos registrados</p>
                    <p className="text-xs text-slate-400">Esta liquidación no tiene desglose de conceptos guardado.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ══════════════ TAB 3 — DOCUMENTOS ══════════════ */}
            <TabsContent value="documentos" className="pt-4 space-y-3">
              {userRole === 'admin' && !si.anulado && (
                <div className="flex justify-end">
                  <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => { setUploadDocNombre(''); setUploadDocFile(null); setIsUploadDocOpen(true); }}>
                    <Upload className="size-3.5" /> Subir documento
                  </Button>
                </div>
              )}
              {loadingDocs ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                </div>
              ) : docsLiquidacion.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-slate-400 gap-2">
                  <Paperclip className="size-8 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">Sin documentos adjuntos</p>
                  {userRole === 'admin'
                    ? <p className="text-xs text-slate-400">Sube documentos de soporte usando el botón de arriba.</p>
                    : <p className="text-xs text-slate-400">El administrador puede adjuntar documentos a esta liquidación.</p>
                  }
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {docsLiquidacion.map(doc => {
                    const icons: Record<string, string> = { pdf:'📄', jpg:'🖼', jpeg:'🖼', png:'🖼', webp:'🖼', doc:'📝', docx:'📝' };
                    const icon = icons[doc.tipo_archivo] ?? '📎';
                    return (
                      <div key={doc.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl shrink-0">{icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{doc.nombre}</p>
                            <p className="text-xs text-slate-400">
                              {doc.subido_por} · {new Date(doc.created_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0 ml-3">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1 text-xs h-7 text-blue-600 border-blue-200 hover:bg-blue-50">
                              <ExternalLink className="size-3" /> Ver
                            </Button>
                          </a>
                          <a href={doc.url} download>
                            <Button variant="outline" size="sm" className="h-7 text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                              <Download className="size-3.5" />
                            </Button>
                          </a>
                          {userRole === 'admin' && (
                            <Button variant="outline" size="sm" className="h-7 text-red-500 border-red-200 hover:bg-red-50"
                              onClick={() => handleDeleteDoc(doc.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsDetailOpen(false); setSelectedItem(null); setDocsLiquidacion([]); setAuditEntries([]); setAuditOpen(false); }}>
              Cerrar
            </Button>
            {si && (
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => { const ok = generateLiquidacionPDF(si); if (ok) toast.success('PDF generado correctamente'); else toast.error('Error al generar PDF'); }}>
                <Download className="size-4" /> Descargar PDF
              </Button>
            )}
            {userRole === 'admin' && si && !si.anulado && (
              <Button variant="outline" className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => { setIsDetailOpen(false); setJustificacionAnulacion(''); setIsAnularOpen(true); }}>
                <Trash2 className="size-4" /> Anular
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // VISTA ASOCIADO
  // ══════════════════════════════════════════════════════════════
  const renderVistaAsociado = () => {
    // Los datos ya vienen filtrados server-side por el id del asociado
    const misLiqs = liquidaciones;

    const asocRegErr = validateDateRange(asocFilterRegDesde, asocFilterRegHasta);
    const hayFiltrosAsoc = !!(asocSearchTerm || asocFilterEstado || asocFilterDesde || asocFilterHasta || asocFilterRegDesde || asocFilterRegHasta);

    const filtered = misLiqs
      .filter(l => {
        const term      = asocSearchTerm.toLowerCase().trim();
        const nL        = numLiq(l.id).toLowerCase();
        const tipoLabel = (TIPOS_LIQ.find(t => t.value === l.tipo)?.label ?? '').toLowerCase();
        const matchSearch   = !term || nL.includes(term) || tipoLabel.includes(term)
                              || l.estado.toLowerCase().includes(term) || l.fechaCorte.includes(term);
        const matchEstado   = !asocFilterEstado || (asocFilterEstado === 'Inválida' ? l.anulado : l.estado === asocFilterEstado);
        const matchDesde    = !asocFilterDesde   || l.fechaCorte >= asocFilterDesde;
        const matchHasta    = !asocFilterHasta   || l.fechaCorte <= asocFilterHasta;
        const regD          = l.createdAt?.slice(0, 10) ?? '';
        const matchRegDesde = !asocFilterRegDesde || regD >= asocFilterRegDesde;
        const matchRegHasta = !asocFilterRegHasta || regD <= asocFilterRegHasta;
        return matchSearch && matchEstado && matchDesde && matchHasta && matchRegDesde && matchRegHasta;
      })
      .sort((a, b) => new Date(b.createdAt || b.fechaCorte).getTime() - new Date(a.createdAt || a.fechaCorte).getTime());

    const montoActivo  = misLiqs.filter(l => !l.anulado).reduce((s, l) => s + (l.montoFinal ?? 0), 0);
    const cantPagadas  = misLiqs.filter(l => l.estado === 'Pagada').length;
    const cantPendient = misLiqs.filter(l => l.estado === 'Pendiente' || l.estado === 'En proceso').length;

    return (
      <>
        <div className="min-h-screen bg-slate-50">
          {/* ── Banner de bienvenida ── */}
          <div className="bg-gradient-to-r from-emerald-700 to-teal-600 px-8 py-8">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div>
                <p className="text-emerald-200 text-sm font-medium mb-1">Bienvenido/a</p>
                <h1 className="text-white text-2xl font-bold">{userData?.name ?? userData?.nombre ?? 'Asociado'}</h1>
                {userData?.cedula && <p className="text-emerald-200 text-sm mt-0.5">C.C. {userData.cedula}</p>}
              </div>
              <div className="p-4 bg-white/10 rounded-2xl hidden sm:block">
                <FileCog className="size-10 text-white/80" />
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 space-y-6">

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 -mt-6">
              {[
                { label: 'Total', value: misLiqs.length, sub: 'liquidaciones', icon: <FileCog className="size-4 text-emerald-600" />, bg: 'bg-emerald-50', color: 'text-slate-900' },
                { label: 'Monto total', value: fmtCOP(montoActivo), sub: 'activas', icon: <Banknote className="size-4 text-indigo-600" />, bg: 'bg-indigo-50', color: 'text-emerald-700', small: true },
                { label: 'Pagadas', value: cantPagadas, sub: 'completadas', icon: <TrendingUp className="size-4 text-green-600" />, bg: 'bg-green-50', color: 'text-slate-900' },
                { label: 'Pendientes', value: cantPendient, sub: 'en proceso', icon: <Clock className="size-4 text-amber-600" />, bg: 'bg-amber-50', color: 'text-slate-900' },
              ].map((kpi, i) => (
                <Card key={i} className="border-0 shadow-md bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{kpi.label}</p>
                        <p className={`${kpi.small ? 'text-base' : 'text-2xl'} font-bold ${kpi.color}`}>{kpi.value}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{kpi.sub}</p>
                      </div>
                      <div className={`p-2 rounded-lg ${kpi.bg}`}>{kpi.icon}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Panel de búsqueda y filtros — asociado */}
            {misLiqs.length > 0 && (
              <Card className="border-0 shadow-sm bg-white">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Search className="size-3.5" /> Buscar y filtrar
                    </p>
                    {(asocSearchTerm || asocFilterEstado || asocFilterDesde || asocFilterHasta || asocFilterRegDesde || asocFilterRegHasta) && (
                      <button className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                        onClick={() => {
                          setAsocSearchTerm(''); setAsocFilterEstado('');
                          setAsocFilterDesde(''); setAsocFilterHasta('');
                          setAsocFilterRegDesde(''); setAsocFilterRegHasta('');
                        }}>
                        <X className="size-3" /> Limpiar
                      </button>
                    )}
                  </div>

                  {/* Buscador */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                    <Input
                      className="pl-10 h-9 text-sm"
                      placeholder="Buscar por N° liquidación, tipo, estado..."
                      value={asocSearchTerm}
                      autoComplete="off"
                      onChange={e => setAsocSearchTerm(e.target.value)}
                    />
                  </div>

                  {/* Estado */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Estado</p>
                      <Select value={asocFilterEstado || 'todos'} onValueChange={v => setAsocFilterEstado(v === 'todos' ? '' : v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos</SelectItem>
                          {ESTADOS_LIQ.map(e => <SelectItem key={e.value} value={e.value} className="text-xs">{e.value}</SelectItem>)}
                          <SelectItem value="Inválida" className="text-xs text-red-600">Inválida</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Rango fecha de corte */}
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Fecha de corte (desde – hasta)</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                          <Input type="date" className="pl-7 h-8 text-xs" value={asocFilterDesde}
                            max={asocFilterHasta || undefined}
                            onChange={e => setAsocFilterDesde(e.target.value)} />
                        </div>
                        <div className="relative">
                          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                          <Input type="date" className="pl-7 h-8 text-xs" value={asocFilterHasta}
                            min={asocFilterDesde || undefined}
                            onChange={e => setAsocFilterHasta(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rango fecha de registro */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="size-3" /> Fecha de registro (desde – hasta)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                        <Input type="date" className={`pl-7 h-8 text-xs ${asocRegErr ? 'border-red-400' : ''}`}
                          value={asocFilterRegDesde}
                          max={asocFilterRegHasta || new Date().toISOString().slice(0, 10)}
                          onChange={e => setAsocFilterRegDesde(e.target.value)} />
                      </div>
                      <div className="relative">
                        <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                        <Input type="date" className={`pl-7 h-8 text-xs ${asocRegErr ? 'border-red-400' : ''}`}
                          value={asocFilterRegHasta}
                          min={asocFilterRegDesde || undefined}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={e => setAsocFilterRegHasta(e.target.value)} />
                      </div>
                    </div>
                    {asocRegErr && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="size-3" /> {asocRegErr}
                      </p>
                    )}
                  </div>

                  {/* Contador de resultados */}
                  <p className="text-xs text-slate-400">
                    {filtered.length === misLiqs.length
                      ? `${misLiqs.length} liquidación(es) en total`
                      : `${filtered.length} de ${misLiqs.length} liquidación(es) coinciden`}
                  </p>
                </CardContent>
              </Card>
            )}

            {misLiqs.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3 text-slate-400">
                <div className="p-4 rounded-full bg-slate-100"><FileCog className="size-10 text-slate-300" /></div>
                <p className="font-semibold text-slate-600 text-lg">No tienes liquidaciones registradas</p>
                <p className="text-sm text-slate-400">Cuando se registre una liquidación a tu nombre aparecerá aquí.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-10 gap-3 text-slate-400">
                <Search className="size-8 text-slate-300" />
                <p className="font-semibold text-slate-600">Sin resultados</p>
                <p className="text-sm text-slate-400">Intenta con otros criterios de búsqueda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(l => (
                  <Card
                    key={l.id}
                    className="border-0 shadow-sm bg-white hover:shadow-lg transition-all duration-200 cursor-pointer group"
                    onClick={() => { setSelectedItem(l); cargarDocumentos(l.id); cargarAuditoria(l.id); setAuditOpen(false); setIsDetailOpen(true); }}
                  >
                    <CardContent className="p-5">
                      {/* Cabecera: N°, tipo, estado */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${l.anulado ? 'bg-red-50 group-hover:bg-red-100' : 'bg-emerald-50 group-hover:bg-emerald-100'}`}>
                            <FileCog className={`size-5 ${l.anulado ? 'text-red-400' : 'text-emerald-600'}`} />
                          </div>
                          <div>
                            <p className="font-mono text-sm font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">{numLiq(l.id)}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{TIPOS_LIQ.find(t => t.value === l.tipo)?.label ?? l.tipo}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getEstadoBadge(l.estado, l.anulado)}
                          <ChevronRight className="size-4 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                        </div>
                      </div>

                      {/* Datos en grid */}
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Fecha de corte</p>
                          <p className="text-sm font-semibold text-slate-800">{l.fechaCorte || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Fecha de registro</p>
                          <p className="text-sm font-semibold text-slate-600">
                            {l.createdAt ? new Date(l.createdAt).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Monto</p>
                          <p className="text-sm font-bold text-emerald-700">{fmtCOP(l.montoFinal ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Conceptos</p>
                          <p className="text-sm font-semibold text-slate-700">{l.conceptos?.length ?? 0} ítem(s)</p>
                        </div>
                      </div>

                      {/* Pie: motivo + hint de clic + PDF */}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        {l.motivo
                          ? <p className="text-xs text-slate-500 truncate flex-1"><span className="text-slate-400">Motivo:</span> {l.motivo}</p>
                          : <p className="text-xs text-slate-300 italic">Toca la tarjeta para ver el detalle completo</p>
                        }
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-7 text-xs border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
                          title="Descargar PDF"
                          onClick={e => {
                            e.stopPropagation(); // no abrir el detalle
                            const ok = generateLiquidacionPDF(l);
                            if (ok) toast.success('PDF descargado'); else toast.error('Error al generar PDF');
                          }}
                        >
                          <Download className="size-3" /> PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
        {renderDetailDialog()}
      </>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // LOADING
  // ══════════════════════════════════════════════════════════════
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Cargando liquidaciones...</p>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // HELPERS RENDER
  // ══════════════════════════════════════════════════════════════
  const renderPagination = (total: number, page: number, setPage: (p: number) => void, count: number, start: number) =>
    total <= 1 ? null : (
      <div className="flex items-center justify-between mt-3">
        <p className="text-sm text-slate-600">Mostrando {count === 0 ? 0 : start + 1} a {Math.min(start + itemsPerPage, count)} de {count}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}><ChevronLeft className="size-4" /></Button>
          {Array.from({ length: total }, (_, i) => i + 1).map(p => (
            <Button key={p} variant={page === p ? 'default' : 'outline'} size="sm" onClick={() => setPage(p)} className={page === p ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>{p}</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => setPage(Math.min(total, page + 1))} disabled={page === total}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    );

  const renderTable = (list: any[], isAnuladas = false) => (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead>N° Liquidación</TableHead>
            <TableHead>Asociado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="cursor-pointer hover:text-emerald-700 select-none" onClick={() => setSortBy(sortBy === 'fecha_desc' ? 'fecha_asc' : 'fecha_desc')}>
              Fecha corte {sortBy === 'fecha_desc' ? '↓' : sortBy === 'fecha_asc' ? '↑' : ''}
            </TableHead>
            <TableHead className="text-slate-500 text-xs">Fecha registro</TableHead>
            <TableHead className="cursor-pointer hover:text-emerald-700 select-none" onClick={() => setSortBy(sortBy === 'monto_desc' ? 'monto_asc' : 'monto_desc')}>
              Monto total {sortBy === 'monto_desc' ? '↓' : sortBy === 'monto_asc' ? '↑' : ''}
            </TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="py-14 text-center">
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <FileCog className="size-10" />
                <p className="font-medium text-slate-600">{isAnuladas ? 'No hay liquidaciones anuladas' : 'No hay liquidaciones registradas'}</p>
              </div>
            </TableCell></TableRow>
          ) : list.map(l => (
            <TableRow key={l.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedItem(l); cargarDocumentos(l.id); cargarAuditoria(l.id); setAuditOpen(false); setIsDetailOpen(true); }}>
              <TableCell onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${isAnuladas ? 'bg-slate-100' : 'bg-emerald-50'}`}>
                    <FileCog className={`size-4 ${isAnuladas ? 'text-slate-500' : 'text-emerald-600'}`} />
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-600">{numLiq(l.id)}</span>
                </div>
              </TableCell>
              <TableCell><p className="font-medium text-slate-900 text-sm">{l.asociado}</p><p className="text-xs text-slate-400">{l.cedula}</p></TableCell>
              <TableCell><Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">{TIPOS_LIQ.find(t => t.value === l.tipo)?.label ?? l.tipo}</Badge></TableCell>
              <TableCell className="text-slate-600 text-sm">{l.fechaCorte || '—'}</TableCell>
              <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                {l.createdAt ? new Date(l.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </TableCell>
              <TableCell><span className="font-semibold text-emerald-700">{fmtCOP(l.montoFinal ?? 0)}</span></TableCell>
              <TableCell>{getEstadoBadge(l.estado, l.anulado)}</TableCell>
              <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                <div className="flex gap-1.5 justify-end">
                  <Button variant="outline" size="sm" title="Ver detalle" onClick={() => { setSelectedItem(l); cargarDocumentos(l.id); cargarAuditoria(l.id); setAuditOpen(false); setIsDetailOpen(true); }}><Eye className="size-4" /></Button>
                  {!isAnuladas && <Button variant="outline" size="sm" title="Anular" onClick={() => { setSelectedItem(l); setJustificacionAnulacion(''); setIsAnularOpen(true); }}><Trash2 className="size-4 text-amber-600" /></Button>}
                  <Button variant="outline" size="sm" title="PDF" className="hover:bg-emerald-50"
                    onClick={() => { const ok = generateLiquidacionPDF(l); if (ok) toast.success(`PDF descargado`); else toast.error('Error al generar PDF'); }}>
                    <Download className="size-4 text-emerald-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const hayFiltros = searchTerm || filterEstado || filterTipo || filterDesde || filterHasta || filterRegDesde || filterRegHasta;
  if (userRole === 'asociado') return renderVistaAsociado();

  // ══════════════════════════════════════════════════════════════
  // MAIN RENDER (ADMIN)
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Gestión de Liquidaciones</h1>
            <p className="text-slate-600">Administra liquidaciones por retiro, cesantías y otros conceptos</p>
          </div>
          <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="size-4" /> Nueva liquidación
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: 'Total activas', value: todasActivas.length, sub: `${liquidaciones.filter(l=>l.anulado).length} anulada(s)`, icon: <FileCog className="size-5 text-emerald-600" />, bg: 'bg-emerald-50' },
            { label: 'Monto total procesado', value: fmtCOP(montoTotal), sub: 'Suma de liquidaciones activas', icon: <Banknote className="size-5 text-indigo-600" />, bg: 'bg-indigo-50', isCurrency: true },
            { label: 'Pagadas', value: cantPagadas, sub: 'Completadas', icon: <TrendingUp className="size-5 text-green-600" />, bg: 'bg-green-50' },
            { label: 'Pendientes', value: cantPendientes, sub: 'Requieren atención', icon: <Clock className="size-5 text-amber-600" />, bg: 'bg-amber-50' },
          ].map((kpi, i) => (
            <Card key={i} className="border-0 shadow-sm bg-white">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{kpi.label}</p>
                    <p className={`${kpi.isCurrency ? 'text-xl' : 'text-3xl'} font-bold ${kpi.isCurrency ? 'text-emerald-700' : 'text-slate-900'}`}>{kpi.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{kpi.sub}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${kpi.bg}`}>{kpi.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Panel de búsqueda y filtros ── */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">

            {/* Cabecera */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 rounded-lg">
                  <Search className="size-3.5 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Buscar y filtrar</p>
              </div>
              {hayFiltros && (
                <button
                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 hover:underline transition-colors"
                  onClick={() => {
                    setSearchTerm(''); setFilterEstado(''); setFilterTipo('');
                    setFilterDesde(''); setFilterHasta('');
                    setFilterRegDesde(''); setFilterRegHasta('');
                    setDateRangeError('');
                    setCurrentPage(1);
                    cargarDatos();
                  }}>
                  <X className="size-3" /> Limpiar filtros
                </button>
              )}
            </div>

            {/* Buscador principal */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <Input
                className="pl-10 pr-10 h-10 text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                placeholder="Nombre del asociado, cédula o N° liquidación..."
                value={searchTerm}
                autoComplete="off"
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600" />
                </div>
              )}
              {searchTerm && !isSearching && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => { setSearchTerm(''); setCurrentPage(1); }}>
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Fila de selectores: Estado + Tipo */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estado</p>
                <Select value={filterEstado || 'todos'} onValueChange={v => { setFilterEstado(v === 'todos' ? '' : v); setCurrentPage(1); }}>
                  <SelectTrigger className={`h-9 text-xs ${filterEstado ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {ESTADOS_LIQ.map(e => <SelectItem key={e.value} value={e.value} className="text-xs">{e.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo</p>
                <Select value={filterTipo || 'todos'} onValueChange={v => { setFilterTipo(v === 'todos' ? '' : v); setCurrentPage(1); }}>
                  <SelectTrigger className={`h-9 text-xs ${filterTipo ? 'border-emerald-400 text-emerald-700 bg-emerald-50' : ''}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    {TIPOS_LIQ.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Divisor */}
            <div className="border-t border-slate-100 mb-4" />

            {/* Rangos de fechas en grid 2×2 */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {/* Fecha de corte — Desde */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="size-3" /> Fecha de corte · Desde
                </p>
                <Input type="date" className="h-9 text-xs"
                  value={filterDesde} max={filterHasta || undefined}
                  onChange={e => { setFilterDesde(e.target.value); setCurrentPage(1); }} />
              </div>

              {/* Fecha de corte — Hasta */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="size-3" /> Fecha de corte · Hasta
                </p>
                <Input type="date" className="h-9 text-xs"
                  value={filterHasta} min={filterDesde || undefined}
                  onChange={e => { setFilterHasta(e.target.value); setCurrentPage(1); }} />
              </div>

              {/* Fecha de registro — Desde */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="size-3" /> Fecha de registro · Desde
                  <span className="px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">BD</span>
                </p>
                <Input type="date"
                  className={`h-9 text-xs ${dateRangeError ? 'border-red-400' : ''}`}
                  value={filterRegDesde}
                  max={filterRegHasta || new Date().toISOString().slice(0, 10)}
                  onChange={e => {
                    setFilterRegDesde(e.target.value);
                    setDateRangeError(validateDateRange(e.target.value, filterRegHasta));
                  }} />
              </div>

              {/* Fecha de registro — Hasta */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="size-3" /> Fecha de registro · Hasta
                  <span className="px-1 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">BD</span>
                </p>
                <Input type="date"
                  className={`h-9 text-xs ${dateRangeError ? 'border-red-400' : ''}`}
                  value={filterRegHasta}
                  min={filterRegDesde || undefined}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => {
                    setFilterRegHasta(e.target.value);
                    setDateRangeError(validateDateRange(filterRegDesde, e.target.value));
                  }} />
              </div>
            </div>

            {/* Error de validación de fechas */}
            {dateRangeError && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-3">
                <AlertTriangle className="size-3 shrink-0" /> {dateRangeError}
              </p>
            )}

            {/* Resumen de filtros activos */}
            {hayFiltros && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                {searchTerm && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs">"{searchTerm}"</span>}
                {filterEstado && <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs">{filterEstado}</span>}
                {filterTipo && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{TIPOS_LIQ.find(t=>t.value===filterTipo)?.label}</span>}
                {(filterDesde || filterHasta) && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs">Corte: {filterDesde||'…'} → {filterHasta||'…'}</span>}
                {(filterRegDesde || filterRegHasta) && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs">Registro: {filterRegDesde||'…'} → {filterRegHasta||'…'}</span>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tablas */}
        <Tabs defaultValue="activas">
          <TabsList>
            <TabsTrigger value="activas" className="gap-1"><Activity className="size-3.5" />Activas ({todasActivas.length})</TabsTrigger>
            <TabsTrigger value="anuladas" className="gap-1"><ShieldAlert className="size-3.5" />Anuladas ({liquidaciones.filter(l=>l.anulado).length})</TabsTrigger>
          </TabsList>
          <TabsContent value="activas" className="mt-4 space-y-4">
            {renderTable(pagActivas, false)}
            {renderPagination(totalPagActivas, currentPage, setCurrentPage, activas.length, (currentPage-1)*itemsPerPage)}
          </TabsContent>
          <TabsContent value="anuladas" className="mt-4 space-y-4">
            {renderTable(pagAnuladas, true)}
            {renderPagination(totalPagAn, currentPageAnuladas, setCurrentPageAnuladas, anuladas.length, (currentPageAnuladas-1)*itemsPerPage)}
          </TabsContent>
        </Tabs>
      </div>

      {/* ══════════════════════════════════════════════════════════
          DIALOG: CREAR LIQUIDACIÓN
          ══════════════════════════════════════════════════════════ */}
      <Dialog open={isCreateOpen} onOpenChange={open => { if (!open) resetForm(); setIsCreateOpen(open); }}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCog className="size-5 text-emerald-600" /> Nueva liquidación
            </DialogTitle>
            <DialogDescription>
              Registra una liquidación. Usa la calculadora para calcular automáticamente los conceptos según la legislación colombiana (CST).
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="basico"      className="text-xs">1. Básico</TabsTrigger>
              <TabsTrigger value="calculadora" className="text-xs">2. Calculadora</TabsTrigger>
              <TabsTrigger value="conceptos"   className="text-xs">3. Conceptos ({formConceptos.length})</TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Básico ── */}
            <TabsContent value="basico" className="space-y-4 pt-4">
              {/* Asociado */}
              <div className="space-y-2" ref={acRef}>
                <Label>Asociado *</Label>
                <div className="relative">
                  <Input
                    placeholder="Buscar por nombre o cédula..."
                    value={formAsocSearch} autoComplete="off"
                    onChange={e => { setFormAsocSearch(e.target.value); setFormAsociadoId(''); setShowAcomplete(true); setCalculoHecho(false); }}
                    onFocus={() => setShowAcomplete(true)}
                  />
                  {showAcomplete && acSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                      {acSuggestions.map(a => (
                        <div key={a.id} className="px-3 py-2.5 hover:bg-emerald-50 cursor-pointer text-sm border-b border-slate-50 last:border-0"
                          onMouseDown={() => handleSelectAsociado(a)}>
                          <p className="font-medium text-slate-900">{a.nombre}</p>
                          <p className="text-xs text-slate-400">C.C. {a.cedula}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {formAsociadoId && <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-3.5" />Asociado seleccionado {datosAsocLoading && '· Cargando datos financieros…'}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de liquidación *</Label>
                  <Select value={formTipo} onValueChange={v => { setFormTipo(v); setCalculoHecho(false); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS_LIQ.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estado inicial *</Label>
                  <Select value={formEstado} onValueChange={setFormEstado}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ESTADOS_LIQ.map(e => <SelectItem key={e.value} value={e.value}>{e.value}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de corte *</Label>
                  <Input type="date" value={formFechaCorte} onChange={e => { setFormFechaCorte(e.target.value); setCalculoHecho(false); }} />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-500">Fecha de liquidación <span className="text-xs">(opcional)</span></Label>
                  <Input type="date" value={formFechaLiq} onChange={e => setFormFechaLiq(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivo <span className="text-xs text-slate-400">(opcional)</span></Label>
                <Input placeholder="Ej: Retiro voluntario — carta radicada 12/01/2025" value={formMotivo} onChange={e => setFormMotivo(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Observaciones <span className="text-xs text-slate-400">(opcional)</span></Label>
                <Textarea rows={2} placeholder="Notas adicionales..." value={formObservaciones} onChange={e => setFormObservaciones(e.target.value)} />
              </div>

              {/* Archivo inicial */}
              <div className="space-y-2">
                <Label>Documento de soporte inicial <span className="text-xs text-slate-400">(PDF, imagen o Word — máx. 10 MB)</span></Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                  onClick={() => fileRef.current?.click()}
                >
                  {formArchivoFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-700">
                      <FileText className="size-4" />
                      <span className="text-sm font-medium">{formArchivoFile.name}</span>
                      <button type="button" onClick={e => { e.stopPropagation(); setFormArchivoFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                        <X className="size-4 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-slate-400">
                      <Upload className="size-6 mx-auto mb-1" />
                      <p className="text-xs">Arrastra un archivo o haz clic para seleccionar</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
              </div>
            </TabsContent>

            {/* ── Tab 2: Calculadora ── */}
            <TabsContent value="calculadora" className="space-y-4 pt-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800 space-y-1">
                  <p className="font-semibold">Calculadora según Legislación Colombiana (CST)</p>
                  <p>Aplica para tipos <strong>Retiro voluntario</strong> y <strong>Cesantías</strong>. Incluye:</p>
                  <ul className="ml-3 space-y-0.5 list-disc">
                    <li>Salario pendiente del mes</li>
                    <li>Cesantías (Art. 249 CST): <code className="bg-blue-100 px-1 rounded">(salario × días) / 360</code></li>
                    <li>Intereses de cesantías 12% anual (Ley 52/1975)</li>
                    <li>Prima de servicios (Art. 306 CST)</li>
                    <li>Vacaciones proporcionales (Art. 186 CST): <code className="bg-blue-100 px-1 rounded">salario / 720 × días</code></li>
                    <li>Ahorros y deducciones del fondo</li>
                  </ul>
                  <p className="text-blue-600">Los días se calculan en notación colombiana (año=360, mes=30).</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Salario mensual base (COP) *</Label>
                  <Input placeholder="Ej: 1300000" value={formSalario}
                    onChange={e => { setFormSalario(e.target.value); setCalculoHecho(false); }} />
                  <p className="text-xs text-slate-400">SMMLV 2025: $1.423.500</p>
                </div>
                <div className="space-y-2">
                  <Label>Fecha de ingreso *</Label>
                  <Input type="date" value={formFechaIngreso}
                    onChange={e => { setFormFechaIngreso(e.target.value); setCalculoHecho(false); }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Días de vacaciones pendientes no disfrutadas</Label>
                  <Input type="number" min="0" max="60" placeholder="0" value={formDiasVac}
                    onChange={e => setFormDiasVac(e.target.value)} />
                  <p className="text-xs text-slate-400">Solo si hay días causados no tomados</p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Fecha de corte *
                    {!formFechaCorte && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">Requerida</span>
                    )}
                  </Label>
                  <Input
                    type="date"
                    value={formFechaCorte}
                    onChange={e => { setFormFechaCorte(e.target.value); setCalculoHecho(false); }}
                    className={!formFechaCorte ? 'border-amber-300 focus:border-amber-500' : ''}
                  />
                  <p className="text-[10px] text-slate-400">También se puede configurar en la pestaña Básico</p>
                </div>
              </div>

              {/* Datos del fondo (precargados o ingresables) */}
              <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Saldos en el fondo {datosAsocLoading && <span className="text-emerald-500">(cargando…)</span>}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Ahorro permanente (COP)</Label>
                    <Input placeholder="0" value={formAhorroPerm} onChange={e => setFormAhorroPerm(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Ahorro voluntario (COP)</Label>
                    <Input placeholder="0" value={formAhorroVol} onChange={e => setFormAhorroVol(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Saldo crédito pendiente (COP)</Label>
                    <Input placeholder="0" value={formCreditoPend} onChange={e => setFormCreditoPend(e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-slate-400">Los valores se precargaron automáticamente al seleccionar el asociado. Puedes ajustarlos manualmente.</p>
              </div>

              <Button
                className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={handleCalcular}
                disabled={calculando}
              >
                {calculando ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Calculator className="size-4" />}
                {calculando ? 'Calculando…' : 'Calcular conceptos automáticamente'}
              </Button>

              {calculoHecho && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Cálculo completado</p>
                    <p className="text-xs text-emerald-600">Los conceptos se cargaron en la pestaña "3. Conceptos". Puedes ajustarlos manualmente.</p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Tab 3: Conceptos ── */}
            <TabsContent value="conceptos" className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Ajusta los conceptos antes de guardar. Los valores precalculados son editables.</p>
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={addConcepto}>
                  <Plus className="size-3" /> Agregar concepto
                </Button>
              </div>

              <div className="space-y-2">
                {formConceptos.map(c => (
                  <div key={c.id} className={`grid grid-cols-[1fr,auto,130px,auto] gap-2 items-center p-2 rounded-lg border ${c.tipo === 'credito' ? 'border-emerald-100 bg-emerald-50/30' : 'border-red-100 bg-red-50/30'}`}>
                    <Input
                      placeholder="Nombre del concepto"
                      value={c.nombre}
                      onChange={e => updateConcepto(c.id, 'nombre', e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Select value={c.tipo} onValueChange={v => updateConcepto(c.id, 'tipo', v)}>
                      <SelectTrigger className="h-8 w-28 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="credito" className="text-xs text-emerald-700">Crédito (+)</SelectItem>
                        <SelectItem value="debito"  className="text-xs text-red-700">Débito (−)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Monto COP"
                      value={c.monto}
                      onChange={e => updateConcepto(c.id, 'monto', e.target.value.replace(/[^\d.]/g, ''))}
                      className="h-8 text-sm text-right"
                    />
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => removeConcepto(c.id)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Resumen */}
              <div className="border-t border-slate-200 pt-3 grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <p className="text-xs text-slate-400">Total créditos</p>
                  <p className="font-bold text-emerald-700">+{fmtCOP(formConceptos.filter(c=>c.tipo==='credito').reduce((s,c)=>s+(parseFloat(c.monto)||0),0))}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-slate-400">Total débitos</p>
                  <p className="font-bold text-red-600">−{fmtCOP(formConceptos.filter(c=>c.tipo==='debito').reduce((s,c)=>s+Math.abs(parseFloat(c.monto)||0),0))}</p>
                </div>
                <div className={`p-3 rounded-lg ${montoCalculado >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  <p className="text-xs text-slate-400">Monto final</p>
                  <p className={`font-bold text-lg ${montoCalculado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmtCOP(montoCalculado)}</p>
                </div>
              </div>

              {montoCalculado <= 0 && formConceptos.length > 0 && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-700">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  El monto final debe ser mayor a cero para guardar la liquidación.
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancelar</Button>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={saving}>
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="size-4" />}
              {saving ? 'Guardando…' : 'Registrar liquidación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════
          DIALOG: ANULAR
          ══════════════════════════════════════════════════════════ */}
      <AlertDialog open={isAnularOpen} onOpenChange={open => { if (!open) { setJustificacionAnulacion(''); } setIsAnularOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-5" /> Anular liquidación
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>La liquidación <strong>{selectedItem && numLiq(selectedItem.id)}</strong> de <strong>"{selectedItem?.asociado}"</strong> será marcada como inválida. Esta acción queda registrada.</p>
              <div className="space-y-2">
                <Label className="text-slate-800">Justificación obligatoria (mín. 15 caracteres)</Label>
                <Textarea
                  value={justificacionAnulacion}
                  onChange={e => setJustificacionAnulacion(e.target.value)}
                  placeholder="Describe el motivo de la anulación..."
                  rows={3}
                />
                <p className={`text-xs ${justificacionAnulacion.length < 15 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {justificacionAnulacion.length}/15 mínimo {justificacionAnulacion.length >= 15 && '✓'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setJustificacionAnulacion('')}>Cancelar</AlertDialogCancel>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={justificacionAnulacion.trim().length < 15 || anulando}
              onClick={handleAnular}
            >
              {anulando ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : null}
              Confirmar anulación
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ══════════════════════════════════════════════════════════
          DIALOG: SUBIR DOCUMENTO
          ══════════════════════════════════════════════════════════ */}
      <Dialog open={isUploadDocOpen} onOpenChange={open => { setIsUploadDocOpen(open); if (!open) { setUploadDocFile(null); setUploadDocNombre(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-5 text-emerald-600" /> Subir documento
            </DialogTitle>
            <DialogDescription>Adjunta un documento de soporte a esta liquidación</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre del documento *</Label>
              <Input placeholder="Ej: Carta de retiro, Acta de liquidación..." value={uploadDocNombre} onChange={e => setUploadDocNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Archivo * <span className="text-xs text-slate-400">(PDF, JPG, PNG, Word — máx. 10 MB)</span></Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${uploadDocFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
                onClick={() => uploadDocRef.current?.click()}
              >
                {uploadDocFile ? (
                  <div className="flex items-center justify-center gap-2 text-emerald-700">
                    <FileText className="size-5" />
                    <span className="text-sm font-medium">{uploadDocFile.name}</span>
                    <button type="button" onClick={e => { e.stopPropagation(); setUploadDocFile(null); if (uploadDocRef.current) uploadDocRef.current.value = ''; }}>
                      <X className="size-4 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                ) : (
                  <div className="text-slate-400">
                    <Upload className="size-8 mx-auto mb-2" />
                    <p className="text-sm">Haz clic para seleccionar un archivo</p>
                  </div>
                )}
              </div>
              <input ref={uploadDocRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 10 * 1024 * 1024) { toast.error('El archivo supera los 10 MB'); return; }
                  setUploadDocFile(f);
                  if (!uploadDocNombre.trim()) setUploadDocNombre(f.name.replace(/\.[^.]+$/, ''));
                }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDocOpen(false)}>Cancelar</Button>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleUploadDoc} disabled={uploadingDoc || !uploadDocFile || !uploadDocNombre.trim()}>
              {uploadingDoc ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Upload className="size-4" />}
              {uploadingDoc ? 'Subiendo…' : 'Subir documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {renderDetailDialog()}
    </div>
  );
}
