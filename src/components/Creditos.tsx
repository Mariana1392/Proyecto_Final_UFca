import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import {
  Search, Plus, Eye, ChevronLeft, ChevronRight, Edit, Trash2,
  CreditCard, FileText, AlertTriangle, Percent, Calendar,
  DollarSign, Clock, Check, X, Link, TrendingUp, Wallet, Users, Activity,
  Upload, Paperclip, ExternalLink, BarChart2, Download, PieChart,
  CreditCard as CreditCardIcon, Banknote, History, CheckCircle2,
  ShieldAlert, Receipt, Table2,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { generateCreditoPDF, generateCarteraPDF, generateComprobantePagoPDF, generateHistorialCreditoPDF } from './utils/pdfGenerator';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import { creditosApi, asociadosApi, pagosCreditoApi } from '../lib/api';

interface CreditosProps {
  userRole?: 'admin' | 'asociado' | null;
  userData?: any;
}

const ESTADOS_APROBACION = [
  { value: 'simulacion',   label: 'Simulación',   color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'pendiente',    label: 'Pendiente',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'en_revision',  label: 'En revisión',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'aprobado',     label: 'Aprobado',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'activo',       label: 'Activo',       color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'desembolsado', label: 'Desembolsado', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'en_mora',      label: 'En mora',      color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'pagado',       label: 'Pagado',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'rechazado',    label: 'Rechazado',    color: 'bg-slate-100 text-slate-600 border-slate-200' },
];

const TIPOS_CREDITO = [
  { value: 'libre_inversion', label: 'Libre inversión' },
  { value: 'educacion',       label: 'Educación' },
  { value: 'vivienda',        label: 'Vivienda' },
  { value: 'calamidad',       label: 'Calamidad' },
];

const getEstadoBadge = (estado: string) => {
  const e = ESTADOS_APROBACION.find(e => e.value === estado);
  if (!e) {
    // Estado desconocido: mostrar el valor tal cual en gris, sin caer en 'Simulación'
    return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-xs font-medium capitalize">{estado}</Badge>;
  }
  return <Badge variant="outline" className={`${e.color} text-xs font-medium`}>{e.label}</Badge>;
};

/** Calcula cuota mensual con amortización francesa */
const calcularCuota = (monto: number, tasaAnual: number, plazoMeses: number): number => {
  if (!monto || !plazoMeses) return 0;
  if (!tasaAnual) return Math.round(monto / plazoMeses);
  const i = tasaAnual / 100 / 12;
  return Math.round(monto * (i * Math.pow(1 + i, plazoMeses)) / (Math.pow(1 + i, plazoMeses) - 1));
};

interface FilaAmortizacion {
  numero: number;
  fecha: string;
  cuota: number;
  interes: number;
  capital: number;
  saldo: number;
}

/** Genera tabla de amortización francesa completa */
const generarTablaAmortizacion = (
  monto: number, tasaAnual: number, plazo: number, fechaInicio: string
): FilaAmortizacion[] => {
  if (!monto || !plazo) return [];
  const r = tasaAnual / 100 / 12;
  const cuota = calcularCuota(monto, tasaAnual, plazo);
  const rows: FilaAmortizacion[] = [];
  let saldo = monto;
  const base = fechaInicio ? new Date(fechaInicio + 'T00:00:00') : new Date();

  for (let i = 1; i <= plazo; i++) {
    const fecha = new Date(base.getFullYear(), base.getMonth() + i, base.getDate());
    const interes = Math.round(saldo * r);
    const capital = Math.min(cuota - interes, saldo);
    saldo = Math.max(0, saldo - capital);
    rows.push({
      numero: i,
      fecha: fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
      cuota,
      interes,
      capital,
      saldo,
    });
  }
  return rows;
};

/** Genera y descarga un PDF con la tabla de amortización francesa */
const descargarPDFAmortizacion = (
  tabla: FilaAmortizacion[],
  opts: { monto: number; tasa: number; plazo: number; nombreAsociado?: string; tipo?: string }
) => {
  if (!tabla.length) return;
  const fmtCOP = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  const cuota        = tabla[0].cuota;
  const totalPagado  = tabla.reduce((s, r) => s + r.cuota,   0);
  const totalInteres = tabla.reduce((s, r) => s + r.interes, 0);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Franja superior morada ──────────────────────────────────────────────
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, 210, 44, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('UFCA – Tabla de Amortización Francesa', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Unión Familiar de Crédito y Ahorro · Método de cuota fija mensual', 14, 21);
  if (opts.nombreAsociado) {
    doc.text(`Asociado: ${opts.nombreAsociado}`, 14, 28);
  }
  doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 35);

  // ── Tarjetas KPI ────────────────────────────────────────────────────────
  const kpis = [
    { l: 'Monto solicitado', v: fmtCOP(opts.monto) },
    { l: 'Tasa EA',          v: `${opts.tasa}%` },
    { l: 'Plazo',            v: `${opts.plazo} meses` },
    { l: 'Cuota mensual',    v: fmtCOP(cuota) },
    { l: 'Total intereses',  v: fmtCOP(totalInteres) },
    { l: 'Total a pagar',    v: fmtCOP(totalPagado) },
  ];
  const cardW = 58, cardH = 14, startX = 14, startY = 50;
  kpis.forEach((k, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x   = startX + col * (cardW + 4);
    const y   = startY + row * (cardH + 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(k.l.toUpperCase(), x + cardW / 2, y + 4.5, { align: 'center' });
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(k.v, x + cardW / 2, y + 10.5, { align: 'center' });
  });

  // ── Tabla de amortización ───────────────────────────────────────────────
  autoTable(doc, {
    startY: startY + 2 * (cardH + 4) + 6,
    head:   [['#', 'Fecha de pago', 'Cuota total', 'Interés', 'Capital', 'Saldo restante']],
    body:   tabla.map(r => [
      r.numero,
      r.fecha,
      fmtCOP(r.cuota),
      fmtCOP(r.interes),
      fmtCOP(r.capital),
      r.saldo === 0 ? 'Pagado' : fmtCOP(r.saldo),
    ]),
    foot: [['', 'TOTALES', fmtCOP(totalPagado), fmtCOP(totalInteres), fmtCOP(opts.monto), '$ 0']],
    headStyles: {
      fillColor:  [30, 41, 59],
      textColor:  255,
      fontStyle:  'bold',
      fontSize:   8.5,
      halign:     'left',
    },
    footStyles: {
      fillColor:  [30, 41, 59],
      textColor:  255,
      fontStyle:  'bold',
      fontSize:   8.5,
    },
    bodyStyles:          { fontSize: 8, cellPadding: 2.5 },
    alternateRowStyles:  { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 32 },
      2: { halign: 'right', textColor: [109, 40, 217]  },
      3: { halign: 'right', textColor: [217, 119,   6]  },
      4: { halign: 'right', textColor: [ 37,  99, 235]  },
      5: { halign: 'right' },
    },
    margin:   { left: 14, right: 14 },
    showFoot: 'lastPage',
  });

  // ── Pie de página en cada hoja ──────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `© ${new Date().getFullYear()} UFCA – Simulación orientativa sujeta a aprobación. No constituye compromiso de crédito.`,
      14, 291
    );
    doc.text(`Página ${p} de ${pages}`, 196, 291, { align: 'right' });
  }

  const nombreArchivo = [
    'UFCA_Simulacion',
    opts.nombreAsociado?.replace(/\s+/g, '_') ?? 'credito',
    new Date().toISOString().split('T')[0],
  ].join('_');
  doc.save(`${nombreArchivo}.pdf`);
};

export default function Creditos({ userRole, userData }: CreditosProps) {
  // ── Paginación / búsqueda ─────────────────────────────────────────────────
  const [searchTerm, setSearchTerm]               = useState('');
  const [filterEstado, setFilterEstado]           = useState('');
  const [currentPage, setCurrentPage]             = useState(1);
  const [currentPageAnulados, setCurrentPageAnulados] = useState(1);
  const itemsPerPage = 10;

  // ── Diálogos ──────────────────────────────────────────────────────────────
  const [isCreateDialogOpen, setIsCreateDialogOpen]         = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen]         = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen]         = useState(false);
  const [anulacionStep, setAnulacionStep]                   = useState<1|2>(1);
  const [anulacionConfirmText, setAnulacionConfirmText]     = useState('');
  const [anulando, setAnulando]                             = useState(false);
  const [isHardDeleteDialogOpen, setIsHardDeleteDialogOpen] = useState(false);
  const [hardDeleteStep, setHardDeleteStep]                 = useState<1|2>(1);
  const [hardDeleteConfirmText, setHardDeleteConfirmText]   = useState('');
  const [hardDeleteJustificacion, setHardDeleteJustificacion] = useState('');
  const [hardDeleting, setHardDeleting]                     = useState(false);
  const [isInformeDialogOpen, setIsInformeDialogOpen]       = useState(false);
  const [isPagoDialogOpen, setIsPagoDialogOpen]             = useState(false);
  const [selectedItem, setSelectedItem]                     = useState<any>(null);
  const [justificacionAnulacion, setJustificacionAnulacion] = useState('');

  // ── Pago de cuota ──────────────────────────────────────────────────────────
  const [pagoMonto, setPagoMonto]             = useState('');
  const [pagoMetodo, setPagoMetodo]           = useState('efectivo');
  const [pagoObservacion, setPagoObservacion] = useState('');
  const [pagoFecha, setPagoFecha]             = useState('');
  const [pagoComprobante, setPagoComprobante] = useState<File | null>(null);
  const [pagando, setPagando]                 = useState(false);
  const [historialPagos, setHistorialPagos]   = useState<any[]>([]);
  const [loadingPagos, setLoadingPagos]       = useState(false);

  // ── Historial para el diálogo de detalle (separado del de pago) ───────────
  const [historialDetalle, setHistorialDetalle]     = useState<any[]>([]);
  const [loadingHistorialDetalle, setLoadingHistorialDetalle] = useState(false);

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [creditos, setCreditos]                   = useState<any[]>([]);
  const [asociadosDisponibles, setAsociadosDisponibles] = useState<any[]>([]);
  const [loading, setLoading]                     = useState(true);

  // ── Formulario ────────────────────────────────────────────────────────────
  const [formAsociadoId, setFormAsociadoId]       = useState('');
  const [formMonto, setFormMonto]                 = useState('');
  const [formTasa, setFormTasa]                   = useState('');
  const [formPlazo, setFormPlazo]                 = useState('');
  const [formFecha, setFormFecha]                 = useState('');
  const [formTipo, setFormTipo]                         = useState('libre_inversion');
  const [formEstadoAprobacion, setFormEstadoAprobacion] = useState('pendiente');
  const [formEstadoOriginal, setFormEstadoOriginal]     = useState('pendiente'); // estado al abrir form
  const [formFechaEstado, setFormFechaEstado]           = useState('');
  const [formMotivoEstado, setFormMotivoEstado]         = useState('');
  const [formDescSoporte, setFormDescSoporte]     = useState('');
  const [formUrlDocumento, setFormUrlDocumento]   = useState('');
  const [saving, setSaving]                       = useState(false);

  // ── Simulación de crédito ─────────────────────────────────────────────────
  const [isSimulacionOpen, setIsSimulacionOpen]           = useState(false);
  const [tablaSimulacion, setTablaSimulacion]             = useState<FilaAmortizacion[]>([]);
  const [enviandoSimulacion, setEnviandoSimulacion]       = useState(false);
  const [creditosSimulacion, setCreditosSimulacion]       = useState<any[]>([]);
  const [confirmandoSim, setConfirmandoSim]               = useState(false);
  const [rechazandoSim, setRechazandoSim]                 = useState(false);
  const [simSeleccionada, setSimSeleccionada]             = useState<any>(null);
  const [isConfirmSimOpen, setIsConfirmSimOpen]           = useState(false);
  const [isRechazarSimOpen, setIsRechazarSimOpen]         = useState(false);
  const [isSimDetalleOpen, setIsSimDetalleOpen]           = useState(false);
  const [simDetalleData, setSimDetalleData]               = useState<{ sim: any; tabla: FilaAmortizacion[] } | null>(null);

  // ── Solicitudes de crédito (asociado → pedir al admin) ───────────────────
  const [isSolicitudDialogOpen, setIsSolicitudDialogOpen] = useState(false);
  const [solMonto, setSolMonto]             = useState('');
  const [solTipo, setSolTipo]               = useState('libre_inversion');
  const [solPlazo, setSolPlazo]             = useState('');
  const [solTasa, setSolTasa]               = useState('');
  const [solDestino, setSolDestino]         = useState('');
  const [solObs, setSolObs]                 = useState('');
  const [savingSolicitud, setSavingSolicitud] = useState(false);
  const [misSolicitudes, setMisSolicitudes]   = useState<any[]>([]);
  const [isSolSimOpen, setIsSolSimOpen]       = useState(false);
  const [tablaSolSim, setTablaSolSim]         = useState<FilaAmortizacion[]>([]);
  // Admin: gestión de solicitudes entrantes
  const [solicitudesCredito, setSolicitudesCredito]           = useState<any[]>([]);
  const [isRechazarSolOpen, setIsRechazarSolOpen]             = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada]     = useState<any>(null);
  const [notaRechazoSol, setNotaRechazoSol]                   = useState('');
  const [savingRechazarSol, setSavingRechazarSol]             = useState(false);

  // ── Archivo adjunto ───────────────────────────────────────────────────────
  const [formArchivoFile, setFormArchivoFile]     = useState<File | null>(null);
  const [dragOver, setDragOver]                   = useState(false);
  const fileInputRef                              = useRef<HTMLInputElement>(null);

  // ── Autocompletado asociados (formulario) ─────────────────────────────────
  const [autocompleteSearch, setAutocompleteSearch] = useState('');
  const [showAutocomplete, setShowAutocomplete]     = useState(false);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // ── Autocompletado buscador principal ─────────────────────────────────────
  const [showSearchSugg, setShowSearchSugg]         = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Filtros exclusivos para vista asociado ────────────────────────────────
  const [asocSearch, setAsocSearch]         = useState('');
  const [asocFilterEstado, setAsocFilterEstado] = useState('');
  const [asocFechaDesde, setAsocFechaDesde] = useState('');
  const [asocFechaHasta, setAsocFechaHasta] = useState('');
  const [asocSortBy, setAsocSortBy]         = useState<'fecha_desc'|'fecha_asc'|'estado'|'monto_desc'|'monto_asc'>('fecha_desc');

  useEffect(() => { cargarDatos(); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node))
        setShowAutocomplete(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSearchSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function cargarDatos() {
    try {
      setLoading(true);
      const [creditosData, asociadosData] = await Promise.all([
        supabase
          .from('creditos')
          .select('*, asociados(nombre, cedula)')
          .order('created_at', { ascending: false }),
        asociadosApi.getAll(),
      ]);
      if (creditosData.error) throw creditosData.error;

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // ── Detección y sincronización automática de mora ───────────────────────
      // Cualquier crédito con fecha_desembolso y saldo > 0 puede entrar en mora
      const ESTADOS_ACTIVOS = new Set(['desembolsado', 'activo', 'en_mora', 'aprobado', 'aprobada']);

      const detectarMora = (c: any): boolean => {
        if (!c.fecha_desembolso || (c.saldo ?? 0) <= 0) return false;
        const monto  = c.monto ?? 0;
        const cuota  = c.cuota_mensual ?? 0;
        const plazo  = c.plazo_meses ?? 0;
        if (cuota <= 0 || monto <= 0 || plazo <= 0) return false;
        const cuotasPagadas = Math.max(0, Math.round((monto - (c.saldo ?? 0)) / cuota));
        if (cuotasPagadas >= plazo) return false; // ya terminó
        const fechaBase = new Date(c.fecha_desembolso + 'T00:00:00');
        const fechaVenc = new Date(
          fechaBase.getFullYear(),
          fechaBase.getMonth() + cuotasPagadas + 1,
          fechaBase.getDate()
        );
        fechaVenc.setHours(0, 0, 0, 0);
        return fechaVenc < hoy;
      };

      // Identificar créditos que deben pasar a en_mora o salir de ella
      const actualizaciones: Promise<any>[] = [];
      for (const c of creditosData.data || []) {
        const estadoActual = c.estado ?? '';
        if (!ESTADOS_ACTIVOS.has(estadoActual)) continue;
        // Solo aplica si tiene fecha de desembolso (ya fue entregado al asociado)
        if (!c.fecha_desembolso) continue;
        const enMora = detectarMora(c);
        if (enMora && estadoActual !== 'en_mora') {
          // Pasar a En Mora automáticamente
          actualizaciones.push(
            supabase.from('creditos').update({
              estado: 'en_mora',
              fecha_estado_cambio: new Date().toISOString(),
              motivo_estado_cambio: 'Mora detectada automáticamente: cuota vencida',
            }).eq('id', c.id)
          );
          c._estadoPrevio = estadoActual; // guardar para posible rollback
          c.estado = 'en_mora';
        } else if (!enMora && estadoActual === 'en_mora') {
          // Salir de mora si se regularizó: volver al estado previo o 'aprobado'
          const estadoRegularizado = c._estadoPrevio ?? 'aprobado';
          actualizaciones.push(
            supabase.from('creditos').update({
              estado: estadoRegularizado,
              fecha_estado_cambio: new Date().toISOString(),
              motivo_estado_cambio: 'Mora regularizada automáticamente',
            }).eq('id', c.id)
          );
          c.estado = estadoRegularizado;
        }
      }
      // Ejecutar todas las actualizaciones en paralelo (sin bloquear la carga)
      if (actualizaciones.length > 0) {
        Promise.all(actualizaciones).catch(() => {/* silencioso, no bloquear UI */});
      }
      // ────────────────────────────────────────────────────────────────────────

      const mapeados = (creditosData.data || []).map((c: any) => {
        const estadoAprobacion = c.estado ?? 'pendiente';

        return {
          id:                   c.id,
          asociado:             c.asociados?.nombre ?? 'Sin nombre',
          cedula:               c.asociados?.cedula ?? '',
          asociado_id:          c.asociado_id,
          // la BD usa tipo_credito, no tipo
          tipo:                 c.tipo_credito ?? c.tipo ?? 'libre_inversion',
          monto:                c.monto,
          tasaInteres:          c.tasa_interes ?? 0,
          plazo:                c.plazo_meses,
          cuotaMensual:         c.cuota_mensual,
          saldo:                c.saldo,
          fechaDesembolso:      c.fecha_desembolso,
          // la BD usa estado, no estado_aprobacion
          estadoAprobacion:     estadoAprobacion,
          // la BD usa observaciones, no descripcion_soporte
          descripcionSoporte:   c.observaciones ?? c.descripcion_soporte ?? '',
          urlDocumento:         c.url_documento ?? '',
          estado:               c.estado,
          anulado:              c.anulado,
          motivoAnulacion:      c.motivo_anulacion ?? '',
          editadoPor:           c.editado_por ?? '',
          editadoEn:            c.editado_en  ?? '',
          fechaEstadoCambio:    c.fecha_estado_cambio ?? '',
          motivoEstadoCambio:   c.motivo_estado_cambio ?? '',
          createdAt:            c.created_at,
        };
      });

      // Separar simulaciones del listado principal
      const simulaciones = mapeados.filter((c: any) => c.estadoAprobacion === 'simulacion');
      const normales     = mapeados.filter((c: any) => c.estadoAprobacion !== 'simulacion');
      setCreditos(normales);
      setCreditosSimulacion(simulaciones);
      setAsociadosDisponibles(asociadosData || []);

      // ── Cargar solicitudes de crédito (pre-solicitudes de asociados) ────
      const { data: solData } = await supabase
        .from('credito_solicitudes')
        .select('*, asociados(nombre, cedula)')
        .order('created_at', { ascending: false });

      const solMapeadas = (solData ?? []).map((s: any) => ({
        id:          s.id,
        asociadoId:  s.asociado_id,
        asociado:    s.asociados?.nombre ?? 'Sin nombre',
        cedula:      s.asociados?.cedula ?? '',
        tipoCreditoLabel: TIPOS_CREDITO.find(t => t.value === s.tipo_credito)?.label ?? s.tipo_credito ?? '—',
        tipoCredito: s.tipo_credito ?? 'libre_inversion',
        monto:       s.monto,
        plazoMeses:  s.plazo_meses,
        tasaInteres: s.tasa_interes ?? 0,
        destino:     s.destino ?? '',
        observaciones: s.observaciones ?? '',
        estado:      s.estado ?? 'pendiente',
        notaAdmin:   s.nota_admin ?? '',
        createdAt:   s.created_at,
        reviewedAt:  s.reviewed_at,
      }));

      // Admin ve todas; asociado ve solo las suyas (por cedula)
      setSolicitudesCredito(solMapeadas.filter((s: any) => s.estado === 'pendiente'));
      setMisSolicitudes(solMapeadas.filter((s: any) => s.cedula === userData?.cedula));

    } catch (err: any) {
      toast.error('Error al cargar créditos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

  const parseMonto = (v: string) => parseFloat(v.replace(/[^\d.]/g, '')) || 0;

  // Cuota calculada en tiempo real
  const cuotaPreview = calcularCuota(
    parseMonto(formMonto),
    parseFloat(formTasa) || 0,
    parseInt(formPlazo) || 0,
  );

  // ── Filtros / paginación ──────────────────────────────────────────────────
  const creditosBase = userRole === 'asociado'
    ? creditos.filter(c =>
        !c.anulado && (
          (userData?.asociado_id && c.asociado_id === userData.asociado_id) ||
          (userData?.cedula && c.cedula === userData.cedula)
        )
      )
    : creditos.filter(c => !c.anulado);

  const filteredCreditos = creditosBase.filter(c => {
    const term = searchTerm.toLowerCase();
    const matchSearch = !term || c.asociado.toLowerCase().includes(term) || c.cedula.includes(searchTerm);
    const matchEstado = !filterEstado || c.estadoAprobacion === filterEstado;
    return matchSearch && matchEstado;
  });

  const creditosAnulados = userRole === 'asociado'
    ? creditos.filter(c =>
        c.anulado && (
          (userData?.asociado_id && c.asociado_id === userData.asociado_id) ||
          (userData?.cedula && c.cedula === userData.cedula)
        )
      )
    : creditos.filter(c => c.anulado);

  const filteredAnulados = creditosAnulados.filter(c => {
    const term = searchTerm.toLowerCase();
    return !term || c.asociado.toLowerCase().includes(term) || c.cedula.includes(searchTerm);
  });

  const totalPages     = Math.ceil(filteredCreditos.length / itemsPerPage);
  const startIndex     = (currentPage - 1) * itemsPerPage;
  const currentList    = filteredCreditos.slice(startIndex, startIndex + itemsPerPage);

  const totalPagesAn   = Math.ceil(filteredAnulados.length / itemsPerPage);
  const startIndexAn   = (currentPageAnulados - 1) * itemsPerPage;
  const currentAnulados = filteredAnulados.slice(startIndexAn, startIndexAn + itemsPerPage);

  // ── Resumen de cartera ────────────────────────────────────────────────────
  const carteraActivos = creditosBase;

  // Cartera total = suma de montos de todos los créditos activos (capital otorgado)
  const totalCartera      = carteraActivos.reduce((s, c) => s + (c.monto ?? 0), 0);
  // Cuota mensual total = lo que se recauda cada mes sumando todas las cuotas
  const totalCuotaMensual = carteraActivos.reduce((s, c) => s + (c.cuotaMensual ?? 0), 0);
  // Plazo promedio ponderado en meses
  const plazoPromedio     = carteraActivos.length > 0
    ? Math.round(carteraActivos.reduce((s, c) => s + (c.plazo ?? 0), 0) / carteraActivos.length)
    : 0;
  // Tasa promedio ponderada (solo créditos con tasa > 0)
  const creditosConTasa   = carteraActivos.filter(c => (c.tasaInteres ?? 0) > 0);
  const tasaPromedio      = creditosConTasa.length > 0
    ? (creditosConTasa.reduce((s, c) => s + (c.tasaInteres ?? 0), 0) / creditosConTasa.length)
    : 0;
  // Conteo por estado de aprobación
  const countByEstado = ESTADOS_APROBACION.reduce((acc, e) => {
    acc[e.value] = carteraActivos.filter(c => c.estadoAprobacion === e.value).length;
    return acc;
  }, {} as Record<string, number>);

  // ── Lista filtrada y ordenada para la vista de asociado ──────────────────
  // Comparar por asociado_id (más preciso) o por cédula como fallback
  const misCreditosBase = creditos.filter(c =>
    (userData?.asociado_id && c.asociado_id === userData.asociado_id) ||
    (userData?.cedula && c.cedula === userData.cedula)
  );

  const misCreditosFiltrados = misCreditosBase.filter(c => {
    const term = asocSearch.toLowerCase().trim();
    const numCredito    = `CRE-${String(c.id).substring(0, 8).toUpperCase()}`;
    const estadoLabel   = (ESTADOS_APROBACION.find(e => e.value === c.estadoAprobacion)?.label ?? '').toLowerCase();
    const tipoLabel     = (TIPOS_CREDITO.find(t => t.value === c.tipo)?.label ?? '').toLowerCase();
    const matchSearch   = !term
      || numCredito.toLowerCase().includes(term)
      || c.estadoAprobacion.includes(term)
      || estadoLabel.includes(term)
      || tipoLabel.includes(term)
      || (c.fechaDesembolso ?? '').includes(term)
      || formatCurrency(c.monto).toLowerCase().includes(term);
    const matchEstado = !asocFilterEstado || c.estadoAprobacion === asocFilterEstado || (asocFilterEstado === 'anulado' && c.anulado);
    const matchDesde  = !asocFechaDesde  || (c.fechaDesembolso ?? '') >= asocFechaDesde;
    const matchHasta  = !asocFechaHasta  || (c.fechaDesembolso ?? '') <= asocFechaHasta;
    return matchSearch && matchEstado && matchDesde && matchHasta;
  }).sort((a, b) => {
    if (asocSortBy === 'fecha_desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (asocSortBy === 'fecha_asc')  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (asocSortBy === 'estado')     return a.estadoAprobacion.localeCompare(b.estadoAprobacion);
    if (asocSortBy === 'monto_desc') return (b.monto ?? 0) - (a.monto ?? 0);
    if (asocSortBy === 'monto_asc')  return (a.monto ?? 0) - (b.monto ?? 0);
    return 0;
  });

  // Resumen personal del asociado
  const misActivos        = misCreditosBase.filter(c => !c.anulado);
  const miSaldoTotal      = misActivos.reduce((s, c) => s + (c.saldo ?? 0), 0);
  const miCuotaMensual    = misActivos.filter(c => ['activo','desembolsado','en_mora'].includes(c.estadoAprobacion))
                              .reduce((s, c) => s + (c.cuotaMensual ?? 0), 0);
  const misEnMora         = misActivos.filter(c => c.estadoAprobacion === 'en_mora').length;

  // ── Autocompletado helpers ────────────────────────────────────────────────
  const acSuggestions = asociadosDisponibles
    .filter(a => a.estado && (
      a.nombre.toLowerCase().includes(autocompleteSearch.toLowerCase()) ||
      a.cedula.includes(autocompleteSearch)
    ))
    .slice(0, 8);

  const handleSelectAsociado = (a: any) => {
    setFormAsociadoId(a.id);
    setAutocompleteSearch(`${a.nombre}  ·  ${a.cedula}`);
    setShowAutocomplete(false);
  };

  // ── Abrir formulario ──────────────────────────────────────────────────────
  const handleOpenCreate = (item?: any) => {
    if (item) {
      setSelectedItem(item);
      setFormAsociadoId(item.asociado_id);
      setAutocompleteSearch(`${item.asociado}  ·  ${item.cedula}`);
      setFormTipo(item.tipo ?? 'libre_inversion');
      setFormMonto(item.monto.toString());
      setFormTasa(item.tasaInteres.toString());
      setFormPlazo(item.plazo.toString());
      setFormFecha(item.fechaDesembolso ?? '');
      setFormEstadoAprobacion(item.estadoAprobacion ?? 'pendiente');
      setFormEstadoOriginal(item.estadoAprobacion ?? 'pendiente');
      setFormFechaEstado(item.fechaEstadoCambio ? item.fechaEstadoCambio.split('T')[0] : '');
      setFormMotivoEstado(item.motivoEstadoCambio ?? '');
      setFormDescSoporte(item.descripcionSoporte ?? '');
      setFormUrlDocumento(item.urlDocumento ?? '');
    } else {
      setSelectedItem(null);
      setFormAsociadoId(''); setAutocompleteSearch('');
      setFormTipo('libre_inversion');
      setFormMonto(''); setFormTasa(''); setFormPlazo('');
      setFormFecha(new Date().toISOString().split('T')[0]);
      setFormEstadoAprobacion('pendiente');
      setFormEstadoOriginal('pendiente');
      setFormFechaEstado('');
      setFormMotivoEstado('');
      setFormDescSoporte(''); setFormUrlDocumento('');
      setFormArchivoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    setIsCreateDialogOpen(true);
  };

  // ── Helper: seleccionar / validar archivo ─────────────────────────────────
  const handleFileSelect = (file: File) => {
    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`El archivo supera los ${MAX_MB} MB permitidos`);
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      toast.error('Formato no permitido. Usa PDF, JPG, PNG, WEBP o Word.');
      return;
    }
    setFormArchivoFile(file);
  };

  // ── Guardar crédito ───────────────────────────────────────────────────────
  const handleSaveCredito = async () => {
    if (!formAsociadoId)        { toast.error('Selecciona un asociado'); return; }
    const monto = parseMonto(formMonto);
    if (!monto || monto <= 0)   { toast.error('Ingresa un monto válido'); return; }
    const tasa  = parseFloat(formTasa) || 0;
    const plazo = parseInt(formPlazo) || 0;
    if (plazo <= 0)             { toast.error('El plazo debe ser mayor a 0 meses'); return; }
    if (!formFecha)             { toast.error('Selecciona la fecha de desembolso'); return; }

    const cuota = calcularCuota(monto, tasa, plazo);
    setSaving(true);

    // ── Subir archivo a Supabase Storage (si hay uno nuevo) ─────────────────
    let urlFinal: string | null = formUrlDocumento.trim() || null;
    if (formArchivoFile) {
      try {
        const ext      = formArchivoFile.name.split('.').pop() ?? 'bin';
        const filePath = `${formAsociadoId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('creditos-documentos')
          .upload(filePath, formArchivoFile, { upsert: true });
        if (uploadError) throw new Error('Error al subir el archivo: ' + uploadError.message);
        const { data: urlData } = supabase.storage
          .from('creditos-documentos')
          .getPublicUrl(filePath);
        urlFinal = urlData.publicUrl;
      } catch (err: any) {
        toast.error(err.message);
        setSaving(false);
        return;
      }
    }

    try {
      const ahora       = new Date().toISOString();
      const adminNombre = userData?.nombre ?? userData?.email ?? 'Administrador';

      // ── Detectar cambio de estado ─────────────────────────────────────────
      const estadoCambio = selectedItem && formEstadoAprobacion !== formEstadoOriginal;

      // Nombres exactos de columnas según el esquema de Supabase:
      // tipo_credito, tasa_interes, plazo_meses, cuota_mensual, fecha_desembolso,
      // estado (no estado_aprobacion), observaciones (no descripcion_soporte),
      // url_documento, editado_por, editado_en, fecha_estado_cambio, motivo_estado_cambio
      const payload: Record<string, any> = {
        tipo_credito:     formTipo,
        monto,
        tasa_interes:     tasa,
        plazo_meses:      plazo,
        cuota_mensual:    cuota,
        fecha_desembolso: formFecha,
        estado:           formEstadoAprobacion,
        observaciones:    formDescSoporte.trim() || null,
        url_documento:    urlFinal,
      };

      // Si el estado cambia, registrar fecha efectiva y motivo
      if (estadoCambio) {
        payload.fecha_estado_cambio  = formFechaEstado  || ahora;
        payload.motivo_estado_cambio = formMotivoEstado.trim() || null;
      }

      if (selectedItem) {
        // ── Incluir auditoría en la edición ──────────────────────────────────
        const payloadEdit = { ...payload, editado_por: adminNombre, editado_en: ahora };
        await creditosApi.update(selectedItem.id, payloadEdit);
        setCreditos(prev => prev.map(c =>
          c.id === selectedItem.id ? {
            ...c, tipo: formTipo, monto, tasaInteres: tasa, plazo, cuotaMensual: cuota,
            fechaDesembolso: formFecha, estadoAprobacion: formEstadoAprobacion,
            descripcionSoporte: formDescSoporte, urlDocumento: urlFinal ?? '',
            editadoPor: adminNombre, editadoEn: ahora,
            fechaEstadoCambio:  estadoCambio ? (formFechaEstado || ahora) : c.fechaEstadoCambio,
            motivoEstadoCambio: estadoCambio ? formMotivoEstado.trim() : c.motivoEstadoCambio,
          } : c
        ));
        toast.success('✅ Crédito actualizado correctamente', {
          description: `Editado por ${adminNombre} · ${new Date(ahora).toLocaleString('es-CO')}`,
        });
      } else {
        const asociado = asociadosDisponibles.find(a => a.id === formAsociadoId);
        const nuevo = await creditosApi.create({
          asociado_id: formAsociadoId,
          saldo:       monto,
          estado:      'activo',
          anulado:     false,
          ...payload,
        });
        setCreditos(prev => [{
          id: nuevo.id,
          asociado:           asociado?.nombre ?? '',
          cedula:             asociado?.cedula ?? '',
          asociado_id:        formAsociadoId,
          tipo:               formTipo,
          monto, tasaInteres: tasa, plazo, cuotaMensual: cuota,
          saldo:              monto,
          fechaDesembolso:    formFecha,
          estadoAprobacion:   formEstadoAprobacion,
          descripcionSoporte: formDescSoporte,
          urlDocumento:       urlFinal ?? '',
          estado: 'activo', anulado: false, motivoAnulacion: '',
          editadoPor: '', editadoEn: '',
          fechaEstadoCambio: formFechaEstado || '',
          motivoEstadoCambio: formMotivoEstado || '',
          createdAt: ahora,
        }, ...prev]);
        toast.success('✅ Crédito registrado exitosamente', {
          description: `${asociado?.nombre} · ${formatCurrency(monto)} · ${plazo} meses`,
        });
      }
      setIsCreateDialogOpen(false);
      setSelectedItem(null);
      setFormArchivoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error('Error al guardar crédito: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Simulación de crédito ────────────────────────────────────────────────
  const handleAbrirSimulacion = () => {
    const monto = parseMonto(formMonto);
    const tasa  = parseFloat(formTasa) || 0;
    const plazo = parseInt(formPlazo)  || 0;
    if (!formAsociadoId) { toast.error('Selecciona un asociado'); return; }
    if (!monto || monto <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (plazo <= 0)  { toast.error('El plazo debe ser mayor a 0'); return; }
    const tabla = generarTablaAmortizacion(monto, tasa, plazo, formFecha || new Date().toISOString().split('T')[0]);
    setTablaSimulacion(tabla);
    setIsSimulacionOpen(true);
  };

  const handleEnviarSimulacion = async () => {
    if (!formAsociadoId) return;
    const monto = parseMonto(formMonto);
    const tasa  = parseFloat(formTasa) || 0;
    const plazo = parseInt(formPlazo)  || 0;
    const cuota = calcularCuota(monto, tasa, plazo);
    const asociado = asociadosDisponibles.find(a => a.id === formAsociadoId);
    setEnviandoSimulacion(true);
    try {
      // Guardar crédito en estado 'simulacion' (no registrado aún)
      const nuevo = await creditosApi.create({
        asociado_id:      formAsociadoId,
        tipo_credito:     formTipo,
        monto,
        tasa_interes:     tasa,
        plazo_meses:      plazo,
        cuota_mensual:    cuota,
        fecha_desembolso: formFecha || new Date().toISOString().split('T')[0],
        estado:           'simulacion',
        observaciones:    formDescSoporte.trim() || null,
        saldo:            monto,
        anulado:          false,
      });

      // Buscar usuario_id del asociado para notificarle
      const { data: usuarioAsoc } = await supabase
        .from('usuarios')
        .select('id, email')
        .eq('asociado_id', formAsociadoId)
        .maybeSingle();

      // Notificación in-app al asociado
      await supabase.from('notificaciones').insert({
        usuario_id:  usuarioAsoc?.id ?? null,
        asociado_id: formAsociadoId,
        tipo:        'simulacion_credito',
        titulo:      '📊 Simulación de crédito pendiente de confirmación',
        mensaje:     `Se ha generado una simulación de crédito por ${formatCurrency(monto)} a ${plazo} meses con cuota mensual de ${formatCurrency(cuota)}. Revisa la tabla de amortización y confirma o rechaza el crédito.`,
        leida:       false,
        para_admin:  false,
        credito_id:  nuevo.id,
      }).then(() => {}).catch(() => {});

      // Intento de envío de email (requiere Edge Function configurada)
      supabase.functions.invoke('enviar-simulacion-credito', {
        body: {
          destinatario:   usuarioAsoc?.email ?? asociado?.email ?? null,
          nombreAsociado: asociado?.nombre ?? 'Asociado',
          monto, tasa, plazo,
        },
      }).catch(() => { /* Edge Function opcional */ });

      const ahora = new Date().toISOString();
      const simEntry = {
        id: nuevo.id,
        asociado:         asociado?.nombre ?? '',
        cedula:           asociado?.cedula ?? '',
        asociado_id:      formAsociadoId,
        tipo:             formTipo,
        monto,  tasaInteres: tasa, plazo, cuotaMensual: cuota,
        saldo:            monto,
        fechaDesembolso:  formFecha || ahora.split('T')[0],
        estadoAprobacion: 'simulacion',
        descripcionSoporte: formDescSoporte,
        urlDocumento:     '',
        estado:           'simulacion',
        anulado:          false,
        motivoAnulacion:  '',
        editadoPor: '', editadoEn: '',
        fechaEstadoCambio: '', motivoEstadoCambio: '',
        createdAt: ahora,
      };
      setCreditosSimulacion(prev => [simEntry, ...prev]);

      toast.success('✅ Simulación enviada al asociado', {
        description: `${asociado?.nombre} recibirá la tabla de amortización para confirmar o rechazar.`,
      });
      setIsSimulacionOpen(false);
      setIsCreateDialogOpen(false);
      setSelectedItem(null);
      setFormArchivoFile(null);
    } catch (err: any) {
      toast.error('Error al enviar simulación: ' + err.message);
    } finally {
      setEnviandoSimulacion(false);
    }
  };

  const handleConfirmarSimulacion = async () => {
    if (!simSeleccionada) return;
    setConfirmandoSim(true);
    try {
      // ── Intentar primero con la función RPC (bypassea RLS) ──────────────
      const { error: rpcError } = await supabase.rpc('confirmar_simulacion_credito', {
        p_credito_id: simSeleccionada.id,
      });

      if (rpcError) {
        // Fallback: update directo si el RPC aún no existe en la BD
        const { error: updateError } = await supabase.from('creditos').update({
          estado:               'activo',
          saldo:                simSeleccionada.monto,
          fecha_desembolso:     new Date().toISOString().split('T')[0],
          fecha_estado_cambio:  new Date().toISOString(),
          motivo_estado_cambio: 'Crédito confirmado y activado por el asociado',
          anulado:              false,
        }).eq('id', simSeleccionada.id);

        if (updateError) throw updateError;
      }

      // Notificación al admin (sin columnas opcionales que podrían no existir)
      supabase.from('notificaciones').insert({
        titulo:     '✅ Crédito activo — confirmado por asociado',
        mensaje:    `${simSeleccionada.asociado} confirmó el crédito por ${formatCurrency(simSeleccionada.monto)} a ${simSeleccionada.plazo} meses. Ya está ACTIVO.`,
        tipo:       'credito_activo',
        leida:      false,
        para_admin: true,
      }).then(() => {}).catch(() => {});

      // Notificación al propio asociado
      const asocId = simSeleccionada.asociadoId ?? simSeleccionada.asociado_id;
      if (asocId) {
        supabase.from('notificaciones').insert({
          titulo:      '🎉 Tu crédito ha sido activado',
          mensaje:     `Tu crédito por ${formatCurrency(simSeleccionada.monto)} a ${simSeleccionada.plazo} meses ha quedado registrado y activo.`,
          tipo:        'credito_activo',
          leida:       false,
          para_admin:  false,
          asociado_id: asocId,
        }).then(() => {}).catch(() => {});
      }

      toast.success('🎉 ¡Crédito activado! Ya aparece en Gestión de Créditos.');
      setIsConfirmSimOpen(false);
      setSimSeleccionada(null);
      await cargarDatos();
    } catch (err: any) {
      toast.error('Error al activar el crédito: ' + err.message);
    } finally {
      setConfirmandoSim(false);
    }
  };

  const handleRechazarSimulacion = async () => {
    if (!simSeleccionada) return;
    setRechazandoSim(true);
    try {
      // ── Intentar primero con la función RPC (bypassea RLS) ──────────────
      const { error: rpcError } = await supabase.rpc('rechazar_simulacion_credito', {
        p_credito_id: simSeleccionada.id,
      });

      if (rpcError) {
        // Fallback: delete directo si el RPC aún no existe en la BD
        const { error: deleteError } = await supabase
          .from('creditos')
          .delete()
          .eq('id', simSeleccionada.id);

        if (deleteError) throw deleteError;
      }

      // Notificar al admin
      supabase.from('notificaciones').insert({
        titulo:     '❌ Simulación de crédito rechazada',
        mensaje:    `${simSeleccionada.asociado} rechazó la simulación por ${formatCurrency(simSeleccionada.monto)}.`,
        tipo:       'credito_rechazado',
        leida:      false,
        para_admin: true,
      }).then(() => {}).catch(() => {});

      toast.success('Simulación rechazada y eliminada correctamente.');
      setIsRechazarSimOpen(false);
      setSimSeleccionada(null);
      await cargarDatos();
    } catch (err: any) {
      toast.error('Error al rechazar: ' + err.message);
    } finally {
      setRechazandoSim(false);
    }
  };

  // ── Anular ────────────────────────────────────────────────────────────────
  // Estados que NO pueden anularse (crédito con compromisos financieros activos)
  const ESTADOS_NO_ANULABLES = new Set([
    'aprobado', 'aprobada', 'desembolsado', 'activo', 'en_mora',
  ]);

  const handleOpenAnular = (item: any) => {
    if (item.anulado) {
      toast.error('Este crédito ya se encuentra anulado');
      return;
    }
    if (ESTADOS_NO_ANULABLES.has(item.estadoAprobacion)) {
      toast.error('No se puede anular este crédito', {
        description: `Estado "${ESTADOS_APROBACION.find(e => e.value === item.estadoAprobacion)?.label ?? item.estadoAprobacion}" indica compromisos financieros activos. Solo se pueden anular créditos en estado: Pendiente, En revisión, Rechazado o Pagado.`,
      });
      return;
    }
    setSelectedItem(item);
    setJustificacionAnulacion('');
    setAnulacionConfirmText('');
    setAnulacionStep(1);
    setIsDeleteDialogOpen(true);
  };

  const handleAnular = async () => {
    if (!selectedItem) return;
    if (anulacionConfirmText !== 'ANULAR') {
      toast.error('Debes escribir ANULAR para confirmar');
      return;
    }
    setAnulando(true);
    try {
      await creditosApi.anular(selectedItem.id, justificacionAnulacion.trim());
      setCreditos(prev => prev.map(c =>
        c.id === selectedItem.id
          ? { ...c, anulado: true, motivoAnulacion: justificacionAnulacion.trim() }
          : c
      ));
      toast.success(`Crédito de "${selectedItem.asociado}" anulado correctamente`, {
        description: `Motivo: ${justificacionAnulacion.trim()}`,
      });
      setIsDeleteDialogOpen(false);
      setSelectedItem(null);
      setJustificacionAnulacion('');
      setAnulacionConfirmText('');
      setAnulacionStep(1);
    } catch (err: any) {
      toast.error('Error al anular: ' + err.message);
    } finally {
      setAnulando(false);
    }
  };

  // ── Eliminación definitiva ────────────────────────────────────────────────
  // Estados que NO se pueden eliminar (crédito en uso o con compromisos activos)
  const ESTADOS_NO_ELIMINABLES = new Set([
    'aprobado', 'aprobada', 'desembolsado', 'activo', 'en_mora',
  ]);

  const handleOpenHardDelete = (item: any) => {
    // Bloquear si el crédito está aprobado o activo (tiene compromisos financieros)
    if (ESTADOS_NO_ELIMINABLES.has(item.estadoAprobacion) && !item.anulado) {
      toast.error('No se puede eliminar este crédito', {
        description: `Estado "${item.estadoAprobacion}" indica que el crédito tiene compromisos activos. Solo puedes eliminar créditos pendientes, rechazados o ya pagados.`,
      });
      return;
    }
    // Bloquear si tiene saldo activo (por si acaso el estado no está sincronizado)
    if ((item.saldo ?? 0) > 0 && !item.anulado) {
      toast.error('No se puede eliminar un crédito con saldo activo', {
        description: `Saldo pendiente: ${formatCurrency(item.saldo)}. Anula el crédito primero.`,
      });
      return;
    }
    setSelectedItem(item);
    setHardDeleteStep(1);
    setHardDeleteConfirmText('');
    setIsHardDeleteDialogOpen(true);
  };

  const handleHardDelete = async () => {
    if (!selectedItem) return;
    if (hardDeleteConfirmText !== 'ELIMINAR') {
      toast.error('Debes escribir ELIMINAR para confirmar');
      return;
    }
    setHardDeleting(true);
    try {
      await creditosApi.eliminar(selectedItem.id);
      setCreditos(prev => prev.filter(c => c.id !== selectedItem.id));
      toast.success(`Crédito de "${selectedItem.asociado}" eliminado definitivamente`, {
        description: `Motivo: ${hardDeleteJustificacion.trim()}`,
      });
      setIsHardDeleteDialogOpen(false);
      setSelectedItem(null);
      setHardDeleteJustificacion('');
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    } finally {
      setHardDeleting(false);
    }
  };

  // ── Exportar historial de pagos a CSV ─────────────────────────────────────
  const exportarHistorialCSV = (historial: any[], credito: any) => {
    const numCredito = `CRE-${String(credito.id ?? '').substring(0, 8).toUpperCase()}`;
    const headers = ['N° Cuota', 'Fecha Pago', 'Monto Pagado', 'Capital', 'Interés', 'Saldo Antes', 'Saldo Después', 'Método', 'Registrado Por', 'Observación'];
    const rows = [...historial].reverse().map((p: any) => [
      p.num_cuota ?? '',
      p.fecha_pago ?? '',
      p.monto_pagado ?? 0,
      p.capital ?? 0,
      p.interes ?? 0,
      p.saldo_antes ?? 0,
      p.saldo_despues ?? 0,
      p.metodo_pago ?? '',
      p.registrado_por ?? '',
      p.observacion ?? '',
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${v}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Historial_${numCredito}_${credito.asociado?.replace(/\s+/g, '_') || ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Abrir diálogo de pago ──────────────────────────────────────────────────
  const handleOpenPago = async (credito: any) => {
    setSelectedItem(credito);
    setPagoMonto(credito.cuotaMensual?.toString() ?? '');
    setPagoMetodo('efectivo');
    setPagoObservacion('');
    setPagoFecha(new Date().toISOString().split('T')[0]);
    setIsPagoDialogOpen(true);
    // Cargar historial de pagos del crédito
    setLoadingPagos(true);
    try {
      const pagos = await pagosCreditoApi.getByCredito(credito.id);
      setHistorialPagos(pagos);
    } catch { setHistorialPagos([]); }
    finally { setLoadingPagos(false); }
  };

  // ── Registrar pago ─────────────────────────────────────────────────────────
  const handleRegistrarPago = async () => {
    if (!selectedItem) return;
    const monto = parseFloat(pagoMonto.replace(/[^\d.]/g, '')) || 0;
    const cuotaAcordada = selectedItem.cuotaMensual ?? 0;
    if (monto <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (cuotaAcordada > 0 && monto < cuotaAcordada) {
      toast.error('Monto insuficiente', {
        description: `El pago mínimo es ${formatCurrency(cuotaAcordada)}. Puedes pagar más — el excedente se abona directamente al capital.`,
        duration: 6000,
      });
      return;
    }
    if (monto > selectedItem.saldo) { toast.error('El monto no puede superar el saldo pendiente'); return; }
    if (!pagoFecha)            { toast.error('Selecciona la fecha del pago'); return; }
    if (pagoMetodo === 'transferencia' && !pagoComprobante) {
      toast.error('Adjunta el comprobante de transferencia para continuar');
      return;
    }

    // Descomponer cuota en capital + interés (amortización francesa)
    const tasaMensual = (selectedItem.tasaInteres ?? 0) > 0
      ? selectedItem.tasaInteres / 100 / 12 : 0;
    const interesCuota  = Math.round(selectedItem.saldo * tasaMensual);
    const capitalCuota  = Math.round(monto - interesCuota);
    const saldoDespues  = Math.max(0, selectedItem.saldo - capitalCuota);

    // Número de cuota (pagadas + 1)
    const numCuota = historialPagos.length + 1;

    const nombrePagador = userData?.nombre ?? userData?.email ?? 'Asociado';

    setPagando(true);
    try {
      // Subir comprobante si es transferencia
      let urlComprobante: string | undefined;
      if (pagoMetodo === 'transferencia' && pagoComprobante) {
        const ext      = pagoComprobante.name.split('.').pop() ?? 'bin';
        const filePath = `comprobantes/${selectedItem.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('creditos-documentos')
          .upload(filePath, pagoComprobante, { upsert: true });
        if (uploadErr) throw new Error('Error al subir el comprobante: ' + uploadErr.message);
        const { data: urlData } = supabase.storage
          .from('creditos-documentos')
          .getPublicUrl(filePath);
        urlComprobante = urlData.publicUrl;
      }

      const nuevoPago = await pagosCreditoApi.registrar({
        credito_id:      selectedItem.id,
        monto_pagado:    monto,
        capital:         Math.max(0, capitalCuota),
        interes:         interesCuota,
        saldo_antes:     selectedItem.saldo,
        saldo_despues:   saldoDespues,
        num_cuota:       numCuota,
        fecha_pago:      pagoFecha,
        metodo_pago:     pagoMetodo,
        observacion:     pagoObservacion.trim() || undefined,
        registrado_por:  nombrePagador,
        url_comprobante: urlComprobante,
      });

      // Actualizar estado local inmediatamente (optimistic update)
      const ahora = new Date().toISOString();
      setCreditos(prev => prev.map(c =>
        c.id === selectedItem.id
          ? {
              ...c,
              saldo: saldoDespues,
              estadoAprobacion:   saldoDespues <= 0 ? 'pagado' : c.estadoAprobacion,
              fechaEstadoCambio:  saldoDespues <= 0 ? ahora    : c.fechaEstadoCambio,
              motivoEstadoCambio: saldoDespues <= 0 ? 'Crédito pagado en su totalidad' : c.motivoEstadoCambio,
            }
          : c
      ));
      setSelectedItem((prev: any) => prev ? { ...prev, saldo: saldoDespues } : prev);

      // Agregar al historial local
      setHistorialPagos(prev => [nuevoPago, ...prev]);

      toast.success('✅ Pago registrado correctamente', {
        description: `Cuota ${numCuota} · ${formatCurrency(monto)} · Saldo restante: ${formatCurrency(saldoDespues)}`,
      });

      // Reset form
      setPagoMonto('');
      setPagoObservacion('');
      setPagoComprobante(null);

      // Recargar datos desde BD para garantizar sincronización en tiempo real
      await cargarDatos();

      if (saldoDespues <= 0) {
        toast.success('🎉 ¡Crédito completamente pagado!');
        setIsPagoDialogOpen(false);
      }
    } catch (err: any) {
      toast.error('Error al registrar el pago: ' + err.message);
    } finally {
      setPagando(false);
    }
  };

  // ── Solicitar crédito (asociado) ──────────────────────────────────────────
  const handleSolicitarCredito = async () => {
    const monto = parseMonto(solMonto);
    if (!monto || monto <= 0)      { toast.error('Ingresa un monto válido'); return; }
    const plazo = parseInt(solPlazo) || 0;
    if (plazo <= 0)                { toast.error('El plazo debe ser mayor a 0 meses'); return; }
    if (!solDestino.trim())        { toast.error('Describe el destino del crédito'); return; }

    setSavingSolicitud(true);
    try {
      const { data, error } = await supabase
        .from('credito_solicitudes')
        .insert({
          asociado_id:  userData?.asociado_id ?? userData?.id,
          tipo_credito: solTipo,
          monto,
          plazo_meses:  plazo,
          tasa_interes: parseFloat(solTasa) || 0,
          destino:      solDestino.trim(),
          observaciones: solObs.trim() || null,
          estado:       'pendiente',
        })
        .select('*, asociados(nombre, cedula)')
        .single();

      if (error) throw error;

      const nueva = {
        id:          data.id,
        asociadoId:  data.asociado_id,
        asociado:    data.asociados?.nombre ?? userData?.nombre ?? '',
        cedula:      data.asociados?.cedula ?? userData?.cedula ?? '',
        tipoCreditoLabel: TIPOS_CREDITO.find(t => t.value === data.tipo_credito)?.label ?? data.tipo_credito,
        tipoCredito: data.tipo_credito,
        monto:       data.monto,
        plazoMeses:  data.plazo_meses,
        tasaInteres: data.tasa_interes ?? 0,
        destino:     data.destino ?? '',
        observaciones: data.observaciones ?? '',
        estado:      'pendiente',
        notaAdmin:   '',
        createdAt:   data.created_at,
        reviewedAt:  null,
      };
      setMisSolicitudes(prev => [nueva, ...prev]);

      // Notificar al admin de la nueva solicitud
      supabase.from('notificaciones').insert({
        titulo:     '📋 Nueva solicitud de crédito',
        mensaje:    `${userData?.nombre ?? 'Un asociado'} solicitó un crédito por ${formatCurrency(monto)} a ${plazo} meses (${TIPOS_CREDITO.find(t => t.value === solTipo)?.label ?? solTipo}). Destino: ${solDestino.trim()}.`,
        tipo:       'solicitud_credito',
        leida:      false,
        para_admin: true,
      }).then(() => {}).catch(() => {});

      toast.success('✅ Solicitud enviada al administrador', {
        description: 'Recibirás una notificación cuando sea revisada.',
      });
      setIsSolicitudDialogOpen(false);
      setSolMonto(''); setSolTipo('libre_inversion'); setSolPlazo('');
      setSolTasa(''); setSolDestino(''); setSolObs('');
    } catch (err: any) {
      toast.error('Error al enviar la solicitud: ' + err.message);
    } finally {
      setSavingSolicitud(false);
    }
  };

  // ── Aprobar solicitud de crédito (admin) ───────────────────────────────────
  const handleAprobarSolicitudCredito = async (sol: any) => {
    try {
      const ahora   = new Date().toISOString();
      const tasa    = sol.tasaInteres || 0;
      const cuota   = calcularCuota(sol.monto, tasa, sol.plazoMeses);

      // Crear el crédito real
      const { data: creditoData, error: creditoErr } = await supabase
        .from('creditos')
        .insert({
          asociado_id:     sol.asociadoId,
          tipo_credito:    sol.tipoCredito,
          monto:           sol.monto,
          tasa_interes:    tasa,
          plazo_meses:     sol.plazoMeses,
          cuota_mensual:   cuota,
          saldo:           sol.monto,
          estado:          'aprobado',
          anulado:         false,
          observaciones:   sol.destino || sol.observaciones || null,
        })
        .select()
        .single();

      if (creditoErr) throw creditoErr;

      // Marcar solicitud como aprobada
      await supabase
        .from('credito_solicitudes')
        .update({ estado: 'aprobada', reviewed_at: ahora, nota_admin: 'Solicitud aprobada' })
        .eq('id', sol.id);

      // Notificar al asociado
      await supabase.from('notificaciones').insert({
        usuario_id: sol.asociadoId,
        tipo:       'solicitud_credito',
        titulo:     '✅ Solicitud de crédito aprobada',
        mensaje:    `Tu solicitud de crédito por ${formatCurrency(sol.monto)} (${sol.tipoCreditoLabel}) fue aprobada. El crédito ha sido creado en tu cuenta.`,
        leida:      false,
      });

      // Actualizar estado local
      setSolicitudesCredito(prev => prev.filter(s => s.id !== sol.id));
      setCreditos(prev => [{
        id:                 creditoData.id,
        asociado:           sol.asociado,
        cedula:             sol.cedula,
        asociado_id:        sol.asociadoId,
        tipo:               sol.tipoCredito,
        monto:              sol.monto,
        tasaInteres:        tasa,
        plazo:              sol.plazoMeses,
        cuotaMensual:       cuota,
        saldo:              sol.monto,
        fechaDesembolso:    null,
        estadoAprobacion:   'aprobado',
        descripcionSoporte: sol.observaciones,
        urlDocumento:       '',
        estado:             'aprobado',
        anulado:            false,
        motivoAnulacion:    '',
        editadoPor:         '',
        editadoEn:          '',
        fechaEstadoCambio:  ahora,
        motivoEstadoCambio: 'Aprobado desde solicitud',
        createdAt:          ahora,
      }, ...prev]);

      toast.success(`✅ Solicitud de ${sol.asociado} aprobada`, {
        description: `Crédito de ${formatCurrency(sol.monto)} creado y listo para desembolso.`,
      });
    } catch (err: any) {
      toast.error('Error al aprobar la solicitud: ' + err.message);
    }
  };

  // ── Rechazar solicitud de crédito (admin) ─────────────────────────────────
  const handleRechazarSolicitudCredito = async () => {
    if (!solicitudSeleccionada) return;
    if (!notaRechazoSol.trim())  { toast.error('Escribe el motivo del rechazo'); return; }
    setSavingRechazarSol(true);
    try {
      const ahora = new Date().toISOString();
      await supabase
        .from('credito_solicitudes')
        .update({ estado: 'rechazada', reviewed_at: ahora, nota_admin: notaRechazoSol.trim() })
        .eq('id', solicitudSeleccionada.id);

      await supabase.from('notificaciones').insert({
        usuario_id: solicitudSeleccionada.asociadoId,
        tipo:       'solicitud_credito',
        titulo:     '❌ Solicitud de crédito rechazada',
        mensaje:    `Tu solicitud de crédito por ${formatCurrency(solicitudSeleccionada.monto)} fue rechazada. Motivo: ${notaRechazoSol.trim()}`,
        leida:      false,
      });

      setSolicitudesCredito(prev => prev.filter(s => s.id !== solicitudSeleccionada.id));
      toast.success('Solicitud rechazada y asociado notificado.');
      setIsRechazarSolOpen(false);
      setSolicitudSeleccionada(null);
      setNotaRechazoSol('');
    } catch (err: any) {
      toast.error('Error al rechazar la solicitud: ' + err.message);
    } finally {
      setSavingRechazarSol(false);
    }
  };

  // ── Render vista de asociado ──────────────────────────────────────────────
  const renderVistaAsociado = () => {
    const hayFiltros = asocSearch.trim() || asocFilterEstado || asocFechaDesde || asocFechaHasta;

    return (
      <>
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* ── Encabezado personal ── */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-slate-900 mb-1">Mis Créditos</h1>
              <p className="text-slate-500 text-sm">
                Bienvenido, <span className="font-semibold text-slate-700">{userData?.nombre ?? userData?.email}</span>
              </p>
            </div>
            <Button
              className="gap-2 bg-blue-600 hover:bg-blue-700 shrink-0"
              onClick={() => setIsSolicitudDialogOpen(true)}
            >
              <Plus className="size-4" /> Solicitar crédito
            </Button>
          </div>

          {/* ── Simulaciones pendientes de confirmación (asociado) ── */}
          {creditosSimulacion.filter(s =>
            (userData?.asociado_id && s.asociado_id === userData.asociado_id) ||
            (userData?.cedula && s.cedula === userData.cedula)
          ).length > 0 && (
            <div className="space-y-3">
              {/* Banner de aviso */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-purple-600 text-white shadow-lg shadow-purple-200">
                <div className="p-2 bg-white/20 rounded-xl shrink-0">
                  <BarChart2 className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm leading-tight">Tienes simulaciones de crédito pendientes</p>
                  <p className="text-purple-200 text-xs mt-0.5">Revisa la tabla de amortización y decide si aceptas o rechazas.</p>
                </div>
                <Badge className="bg-white text-purple-700 font-black shrink-0">
                  {creditosSimulacion.filter(s =>
                    (userData?.asociado_id && s.asociado_id === userData.asociado_id) ||
                    (userData?.cedula && s.cedula === userData.cedula)
                  ).length}
                </Badge>
              </div>

              {/* Tarjetas compactas por simulación */}
              {creditosSimulacion
                .filter(s =>
                  (userData?.asociado_id && s.asociado_id === userData.asociado_id) ||
                  (userData?.cedula && s.cedula === userData.cedula)
                )
                .map(sim => {
                  const tabla       = generarTablaAmortizacion(sim.monto, sim.tasaInteres, sim.plazo, sim.fechaDesembolso || new Date().toISOString().split('T')[0]);
                  const totalPagado = sim.cuotaMensual * sim.plazo;
                  const totalInteres = totalPagado - sim.monto;
                  const tipoLabel   = TIPOS_CREDITO.find(t => t.value === sim.tipo)?.label ?? sim.tipo;
                  return (
                    <div key={sim.id} className="bg-white rounded-2xl border-2 border-purple-200 shadow-sm overflow-hidden">

                      {/* Header */}
                      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/20 rounded-xl">
                            <CreditCard className="size-5 text-white" />
                          </div>
                          <div>
                            <p className="font-black text-white text-base leading-tight">Simulación de crédito</p>
                            <p className="text-purple-200 text-xs">{tipoLabel} · Pendiente de confirmación</p>
                          </div>
                        </div>
                        <Badge className="bg-white/20 text-white border-white/30 text-xs">Simulación</Badge>
                      </div>

                      {/* KPIs principales */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-purple-100">
                        {[
                          { l: 'Monto del crédito',  v: formatCurrency(sim.monto),         color: 'text-indigo-700' },
                          { l: 'Cuota mensual fija',  v: formatCurrency(sim.cuotaMensual),   color: 'text-purple-700' },
                          { l: 'Plazo',               v: `${sim.plazo} meses`,               color: 'text-slate-800' },
                          { l: 'Total intereses',     v: formatCurrency(totalInteres),        color: 'text-amber-600' },
                        ].map(d => (
                          <div key={d.l} className="px-4 py-3.5 text-center">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{d.l}</p>
                            <p className={`font-black text-base mt-1 ${d.color}`}>{d.v}</p>
                          </div>
                        ))}
                      </div>

                      {/* Resumen adicional */}
                      <div className="flex flex-wrap gap-4 px-5 py-3 bg-slate-50 border-t border-purple-100 text-xs text-slate-600">
                        <span><strong>Tasa EA:</strong> {sim.tasaInteres}%</span>
                        <span>·</span>
                        <span><strong>Total a pagar:</strong> {formatCurrency(totalPagado)}</span>
                        <span>·</span>
                        <span><strong>Tipo:</strong> {tipoLabel}</span>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex flex-col sm:flex-row gap-3 px-5 py-4 border-t border-purple-100">
                        <Button
                          className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700"
                          onClick={() => {
                            setSimDetalleData({ sim, tabla });
                            setIsSimDetalleOpen(true);
                          }}
                        >
                          <Table2 className="size-4" />
                          Ver tabla de amortización completa
                        </Button>
                        <Button
                          className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => { setSimSeleccionada(sim); setIsConfirmSimOpen(true); }}
                        >
                          <Check className="size-4" /> Confirmar crédito
                        </Button>
                        <Button
                          variant="outline"
                          className="sm:w-auto border-red-300 text-red-600 hover:bg-red-50 gap-2"
                          onClick={() => { setSimSeleccionada(sim); setIsRechazarSimOpen(true); }}
                        >
                          <X className="size-4" /> Rechazar
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* ── KPIs personales ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total créditos</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{misActivos.length}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {misCreditosBase.filter(c => c.anulado).length} anulado{misCreditosBase.filter(c => c.anulado).length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Saldo total</p>
                <p className="text-lg font-bold text-indigo-700 mt-1">{formatCurrency(miSaldoTotal)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Capital pendiente</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">Cuota mensual</p>
                <p className="text-lg font-bold text-emerald-700 mt-1">{miCuotaMensual > 0 ? formatCurrency(miCuotaMensual) : '—'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Próximo pago</p>
              </CardContent>
            </Card>
            <Card className={`border-0 shadow-sm ${misEnMora > 0 ? 'bg-red-50' : 'bg-white'}`}>
              <CardContent className="p-4">
                <p className={`text-[10px] font-semibold uppercase tracking-wider ${misEnMora > 0 ? 'text-red-400' : 'text-slate-400'}`}>En mora</p>
                <p className={`text-2xl font-bold mt-1 ${misEnMora > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {misEnMora > 0 ? misEnMora : '✓'}
                </p>
                <p className={`text-[10px] mt-0.5 ${misEnMora > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {misEnMora > 0 ? `crédito${misEnMora !== 1 ? 's' : ''} vencido${misEnMora !== 1 ? 's' : ''}` : 'Al día'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Barra de búsqueda y filtros (compacta) ── */}
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-3 space-y-2.5">

              {/* ── Fila principal: búsqueda + estado + ordenar ── */}
              <div className="flex gap-2 items-center">
                {/* Input de búsqueda */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                  {asocSearch && (
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setAsocSearch('')}>
                      <X className="size-3.5" />
                    </button>
                  )}
                  <Input
                    className="pl-9 pr-8 h-9 text-sm"
                    placeholder="Buscar por N° crédito, estado, tipo o fecha…"
                    value={asocSearch}
                    autoComplete="off"
                    onChange={(e) => setAsocSearch(e.target.value)}
                  />
                </div>

                {/* Estado */}
                <Select value={asocFilterEstado || 'todos'} onValueChange={(v) => setAsocFilterEstado(v === 'todos' ? '' : v)}>
                  <SelectTrigger className="h-9 text-xs w-36 shrink-0">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {ESTADOS_APROBACION.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                    <SelectItem value="anulado">Anulado</SelectItem>
                  </SelectContent>
                </Select>

                {/* Ordenar */}
                <Select value={asocSortBy} onValueChange={(v) => setAsocSortBy(v as any)}>
                  <SelectTrigger className="h-9 text-xs w-40 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fecha_desc">Más reciente</SelectItem>
                    <SelectItem value="fecha_asc">Más antiguo</SelectItem>
                    <SelectItem value="estado">Estado A–Z</SelectItem>
                    <SelectItem value="monto_desc">Mayor monto</SelectItem>
                    <SelectItem value="monto_asc">Menor monto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ── Fila secundaria: fechas + limpiar ── */}
              <div className="flex gap-2 items-center">
                <span className="text-[11px] text-slate-400 shrink-0">Periodo:</span>
                <div className="relative flex-1">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    type="date" className="pl-8 h-8 text-xs"
                    value={asocFechaDesde}
                    onChange={(e) => setAsocFechaDesde(e.target.value)}
                  />
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">–</span>
                <div className="relative flex-1">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    type="date" className="pl-8 h-8 text-xs"
                    value={asocFechaHasta}
                    onChange={(e) => setAsocFechaHasta(e.target.value)}
                  />
                </div>
                {hayFiltros && (
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0 whitespace-nowrap"
                    onClick={() => { setAsocSearch(''); setAsocFilterEstado(''); setAsocFechaDesde(''); setAsocFechaHasta(''); }}
                  >
                    <X className="size-3" /> Limpiar
                  </button>
                )}
                {/* Contador de resultados */}
                <span className="text-[11px] text-slate-400 shrink-0 ml-auto">
                  {misCreditosFiltrados.length} crédito{misCreditosFiltrados.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* ── Chips de filtros activos ── */}
              {hayFiltros && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                  {asocSearch.trim() && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                      <Search className="size-2.5" />
                      "{asocSearch.trim()}"
                      <button onClick={() => setAsocSearch('')} className="ml-0.5 hover:text-blue-900">
                        <X className="size-2.5" />
                      </button>
                    </span>
                  )}
                  {asocFilterEstado && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                      Estado: {ESTADOS_APROBACION.find(e => e.value === asocFilterEstado)?.label ?? asocFilterEstado}
                      <button onClick={() => setAsocFilterEstado('')} className="ml-0.5 hover:text-indigo-900">
                        <X className="size-2.5" />
                      </button>
                    </span>
                  )}
                  {asocFechaDesde && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Desde: {asocFechaDesde}
                      <button onClick={() => setAsocFechaDesde('')} className="ml-0.5 hover:text-slate-900">
                        <X className="size-2.5" />
                      </button>
                    </span>
                  )}
                  {asocFechaHasta && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                      Hasta: {asocFechaHasta}
                      <button onClick={() => setAsocFechaHasta('')} className="ml-0.5 hover:text-slate-900">
                        <X className="size-2.5" />
                      </button>
                    </span>
                  )}
                </div>
              )}

              {/* ── Contador de resultados ── */}
              <div className="flex items-center justify-between pt-0.5">
                <p className="text-xs text-slate-500">
                  {misCreditosFiltrados.length === misCreditosBase.length
                    ? <><span className="font-semibold text-slate-700">{misCreditosBase.length}</span> crédito{misCreditosBase.length !== 1 ? 's' : ''} en total</>
                    : <><span className="font-semibold text-blue-700">{misCreditosFiltrados.length}</span> de <span className="font-semibold">{misCreditosBase.length}</span> crédito{misCreditosBase.length !== 1 ? 's' : ''} coinciden con la búsqueda</>
                  }
                </p>
                {misCreditosFiltrados.length !== misCreditosBase.length && (
                  <span className="text-[10px] text-slate-400">{misCreditosBase.length - misCreditosFiltrados.length} oculto{misCreditosBase.length - misCreditosFiltrados.length !== 1 ? 's' : ''}</span>
                )}
              </div>

            </CardContent>
          </Card>

          {/* ── Lista de créditos ── */}
          {misCreditosFiltrados.length === 0 ? (
            /* Estado vacío */
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="py-16 text-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className={`p-4 rounded-full ${hayFiltros ? 'bg-blue-50' : 'bg-slate-100'}`}>
                    <Search className={`size-8 ${hayFiltros ? 'text-blue-400' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-600">
                      {hayFiltros ? 'No se encontraron créditos' : 'No tienes créditos registrados'}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {hayFiltros
                        ? 'Ningún crédito coincide con los criterios ingresados'
                        : 'Cuando se apruebe un crédito a tu nombre aparecerá aquí'}
                    </p>
                    {hayFiltros && asocSearch.trim() && (
                      <p className="text-xs text-slate-400 mt-1">
                        Búsqueda: <span className="font-semibold text-slate-600">"{asocSearch.trim()}"</span>
                      </p>
                    )}
                  </div>
                  {hayFiltros && (
                    <Button variant="outline" size="sm" className="mt-1 gap-1.5"
                      onClick={() => { setAsocSearch(''); setAsocFilterEstado(''); setAsocFechaDesde(''); setAsocFechaHasta(''); }}>
                      <X className="size-3.5" /> Limpiar filtros y ver todos
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {misCreditosFiltrados.map(c => {
                const numCredito   = `CRE-${String(c.id).substring(0, 8).toUpperCase()}`;
                const progreso     = c.plazo > 0 ? Math.max(0, Math.min(100, ((c.monto - c.saldo) / c.monto) * 100)) : 0;
                const cuotasPag    = c.cuotaMensual > 0 ? Math.max(0, Math.round((c.monto - c.saldo) / c.cuotaMensual)) : 0;
                const cuotasPend   = Math.max(0, (c.plazo ?? 0) - cuotasPag);
                const fechaBase    = c.fechaDesembolso ? new Date(c.fechaDesembolso + 'T00:00:00') : null;
                const fechaVenc    = fechaBase && c.plazo
                  ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + c.plazo, fechaBase.getDate())
                  : null;
                const fechaProx    = fechaBase && cuotasPag < c.plazo
                  ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + cuotasPag + 1, fechaBase.getDate())
                  : null;
                const hoy          = new Date(); hoy.setHours(0, 0, 0, 0);
                const diasMora     = c.estadoAprobacion === 'en_mora' && fechaProx && fechaProx < hoy
                  ? Math.floor((hoy.getTime() - fechaProx.getTime()) / 86400000) : 0;
                const estadoConfig = ESTADOS_APROBACION.find(e => e.value === c.estadoAprobacion);

                return (
                  <Card
                    key={c.id}
                    className={`border shadow-sm cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                      c.anulado ? 'opacity-60 bg-slate-50' :
                      c.estadoAprobacion === 'en_mora' ? 'border-red-200 bg-red-50/30' :
                      c.estadoAprobacion === 'pagado'  ? 'border-emerald-200 bg-emerald-50/20' :
                      'bg-white border-slate-200'
                    }`}
                    onClick={async () => {
                      setSelectedItem(c);
                      setIsDetailDialogOpen(true);
                      setLoadingHistorialDetalle(true);
                      try {
                        const pagos = await pagosCreditoApi.getByCredito(c.id);
                        setHistorialDetalle(pagos ?? []);
                      } catch { setHistorialDetalle([]); }
                      finally { setLoadingHistorialDetalle(false); }
                    }}
                  >
                    <CardContent className="p-4">
                      {/* ── Fila superior: número + estado + fecha ── */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            c.anulado ? 'bg-slate-100' :
                            c.estadoAprobacion === 'en_mora' ? 'bg-red-100' :
                            c.estadoAprobacion === 'pagado'  ? 'bg-emerald-100' :
                            'bg-blue-50'
                          }`}>
                            <CreditCard className={`size-4 ${
                              c.anulado ? 'text-slate-400' :
                              c.estadoAprobacion === 'en_mora' ? 'text-red-500' :
                              c.estadoAprobacion === 'pagado'  ? 'text-emerald-600' :
                              'text-blue-600'
                            }`} />
                          </div>
                          <div>
                            <p className="text-xs font-mono font-bold text-slate-500 tracking-wider">{numCredito}</p>
                            <p className="text-[10px] text-slate-400">{TIPOS_CREDITO.find(t => t.value === c.tipo)?.label ?? 'Libre inversión'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.anulado
                            ? <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">Anulado</Badge>
                            : <Badge variant="outline" className={`text-[10px] ${estadoConfig?.color ?? ''}`}>{estadoConfig?.label ?? c.estadoAprobacion}</Badge>
                          }
                          {diasMora > 0 && (
                            <Badge className="bg-red-600 text-white text-[10px] gap-0.5">
                              <AlertTriangle className="size-2.5" /> {diasMora}d mora
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* ── Grid principal: monto + plazo + cuotas + saldo ── */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Monto aprobado</p>
                          <p className="text-sm font-bold text-indigo-700">{formatCurrency(c.monto)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Plazo</p>
                          <p className="text-sm font-bold text-slate-700">{c.plazo} meses</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Cuotas</p>
                          <p className="text-sm font-bold text-blue-700">
                            {cuotasPag}<span className="text-xs font-normal text-slate-400"> pagadas</span>
                            {cuotasPend > 0 && <span className="text-xs font-semibold text-amber-600"> · {cuotasPend} pend.</span>}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Saldo pendiente</p>
                          <p className={`text-sm font-bold ${c.saldo <= 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                            {c.saldo <= 0 ? 'Pagado ✓' : formatCurrency(c.saldo)}
                          </p>
                        </div>
                      </div>

                      {/* ── Info adicional: tasa + fechas ── */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 mb-3">
                        {c.tasaInteres > 0 && (
                          <span className="flex items-center gap-1">
                            <Percent className="size-3 text-orange-400" />
                            <span>{c.tasaInteres}% EA</span>
                          </span>
                        )}
                        {c.fechaDesembolso && (
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3 text-slate-400" />
                            Inicio: <span className="font-medium text-slate-600">{c.fechaDesembolso}</span>
                          </span>
                        )}
                        {fechaVenc && (
                          <span className="flex items-center gap-1">
                            <Clock className="size-3 text-slate-400" />
                            Vence: <span className="font-medium text-slate-600">
                              {fechaVenc.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </span>
                        )}
                        {fechaProx && c.saldo > 0 && (
                          <span className={`flex items-center gap-1 ${diasMora > 0 ? 'text-red-500 font-medium' : ''}`}>
                            <Calendar className={`size-3 ${diasMora > 0 ? 'text-red-400' : 'text-emerald-400'}`} />
                            {diasMora > 0 ? 'Vencida:' : 'Próx. cuota:'}{' '}
                            <span className="font-medium">
                              {fechaProx.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </span>
                        )}
                      </div>

                      {/* ── Barra de progreso ── */}
                      {c.plazo > 0 && (
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>{cuotasPag} de {c.plazo} cuotas pagadas</span>
                            <span className="font-semibold">{progreso.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                c.estadoAprobacion === 'en_mora' ? 'bg-red-400' :
                                c.estadoAprobacion === 'pagado'  ? 'bg-emerald-500' :
                                'bg-blue-400'
                              }`}
                              style={{ width: `${progreso}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* ── Botones de acción ── */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100"
                        onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline" size="sm"
                          className="gap-1.5 h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                          onClick={async () => {
                            setSelectedItem(c);
                            setIsDetailDialogOpen(true);
                            setLoadingHistorialDetalle(true);
                            try {
                              const pagos = await pagosCreditoApi.getByCredito(c.id);
                              setHistorialDetalle(pagos ?? []);
                            } catch { setHistorialDetalle([]); }
                            finally { setLoadingHistorialDetalle(false); }
                          }}
                        >
                          <Eye className="size-3" /> Ver detalle
                        </Button>
                        <div className="flex gap-1.5">
                          {!c.anulado && c.saldo > 0 && ['activo', 'desembolsado', 'en_mora'].includes(c.estadoAprobacion) && (
                            <Button
                              size="sm"
                              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
                              onClick={() => handleOpenPago(c)}
                            >
                              <Banknote className="size-3" /> Pagar cuota
                            </Button>
                          )}
                          <Button
                            variant="outline" size="sm"
                            className="gap-1.5 h-7 text-xs hover:bg-emerald-50 border-emerald-200 text-emerald-700"
                            onClick={() => {
                              const ok = generateCreditoPDF({
                                id: c.id, tipo: c.tipo, asociado: c.asociado, cedula: c.cedula,
                                monto: c.monto, plazo: c.plazo, tasaInteres: c.tasaInteres,
                                cuotaMensual: c.cuotaMensual, saldo: c.saldo,
                                fechaDesembolso: c.fechaDesembolso, estadoAprobacion: c.estadoAprobacion,
                                descripcionSoporte: c.descripcionSoporte,
                                anulado: c.anulado, motivoAnulacion: c.motivoAnulacion,
                                motivoEstadoCambio: c.motivoEstadoCambio,
                              });
                              if (ok) toast.success('Certificado descargado');
                              else toast.error('Error al generar PDF');
                            }}
                          >
                            <FileText className="size-3" /> Certificado
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Mis Solicitudes ── */}
          {misSolicitudes.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Clock className="size-4 text-amber-500" /> Mis Solicitudes
              </h2>
              <div className="space-y-2">
                {misSolicitudes.map(s => {
                  const estadoColor =
                    s.estado === 'aprobada'  ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    s.estado === 'rechazada' ? 'bg-red-100 text-red-700 border-red-200' :
                                               'bg-yellow-100 text-yellow-700 border-yellow-200';
                  const estadoLabel =
                    s.estado === 'aprobada'  ? 'Aprobada' :
                    s.estado === 'rechazada' ? 'Rechazada' : 'Pendiente';
                  return (
                    <Card key={s.id} className="border-0 shadow-sm bg-white">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800">
                                {s.tipoCreditoLabel}
                              </span>
                              <Badge variant="outline" className={`text-[11px] ${estadoColor}`}>
                                {estadoLabel}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500">
                              Monto solicitado:{' '}
                              <span className="font-semibold text-slate-700">{formatCurrency(s.monto)}</span>
                              {' · '}
                              Plazo: <span className="font-semibold text-slate-700">{s.plazoMeses} meses</span>
                            </p>
                            {s.destino && (
                              <p className="text-xs text-slate-400">Destino: {s.destino}</p>
                            )}
                            {s.notaAdmin && s.estado !== 'pendiente' && (
                              <p className={`text-xs mt-1 ${s.estado === 'rechazada' ? 'text-red-600' : 'text-emerald-600'}`}>
                                Nota del administrador: {s.notaAdmin}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-slate-400">
                              {new Date(s.createdAt).toLocaleDateString('es-CO', {
                                day: '2-digit', month: 'short', year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Modal tabla completa amortización (asociado) ── */}
      <Dialog open={isSimDetalleOpen} onOpenChange={setIsSimDetalleOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Tabla de amortización completa</DialogTitle>
          </DialogHeader>
          {simDetalleData && (() => {
            const { sim, tabla } = simDetalleData;
            const totalPagado   = sim.cuotaMensual * sim.plazo;
            const totalInteres  = totalPagado - sim.monto;
            const tipoLabel     = TIPOS_CREDITO.find(t => t.value === sim.tipo)?.label ?? sim.tipo;
            return (
              <>
                {/* Header visual */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-white/20 rounded-xl">
                      <BarChart2 className="size-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-white font-black text-lg leading-tight">Tabla de Amortización Francesa</h2>
                      <p className="text-purple-200 text-sm">{tipoLabel} · {sim.plazo} meses · {sim.tasaInteres}% EA</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { l: 'Monto',           v: formatCurrency(sim.monto) },
                      { l: 'Cuota mensual',   v: formatCurrency(sim.cuotaMensual) },
                      { l: 'Total intereses', v: formatCurrency(totalInteres) },
                      { l: 'Total a pagar',   v: formatCurrency(totalPagado) },
                    ].map(d => (
                      <div key={d.l} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
                        <p className="text-purple-200 text-[10px] uppercase tracking-wide font-medium">{d.l}</p>
                        <p className="text-white font-black text-sm mt-0.5">{d.v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabla completa */}
                <div className="px-6 py-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Table2 className="size-3.5" /> Plan de pagos — {tabla.length} cuotas
                  </p>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto" style={{ maxHeight: '42vh', overflowY: 'auto' }}>
                      <table className="w-full text-sm">
                        <thead className="bg-slate-800 text-white sticky top-0 z-10">
                          <tr>
                            {['N°','Fecha de pago','Cuota total','Interés','Capital','Saldo restante'].map(h => (
                              <th key={h} className="px-4 py-3 text-left font-semibold text-xs tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tabla.map((fila, idx) => (
                            <tr key={fila.numero} className={idx % 2 === 0 ? 'bg-white hover:bg-purple-50/40' : 'bg-slate-50 hover:bg-purple-50/40'}>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-black">
                                  {fila.numero}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">{fila.fecha}</td>
                              <td className="px-4 py-3 font-black text-purple-700 whitespace-nowrap">{formatCurrency(fila.cuota)}</td>
                              <td className="px-4 py-3 text-amber-600 font-medium whitespace-nowrap">{formatCurrency(fila.interes)}</td>
                              <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap">{formatCurrency(fila.capital)}</td>
                              <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                                {fila.saldo === 0
                                  ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Pagado</span>
                                  : formatCurrency(fila.saldo)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-800 text-white sticky bottom-0">
                          <tr>
                            <td className="px-4 py-3 font-bold text-xs" colSpan={2}>TOTALES</td>
                            <td className="px-4 py-3 font-black text-purple-300 whitespace-nowrap">{formatCurrency(totalPagado)}</td>
                            <td className="px-4 py-3 font-bold text-amber-300 whitespace-nowrap">{formatCurrency(totalInteres)}</td>
                            <td className="px-4 py-3 font-bold text-blue-300 whitespace-nowrap">{formatCurrency(sim.monto)}</td>
                            <td className="px-4 py-3 font-bold text-emerald-300">$ 0</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer acciones */}
                <div className="flex flex-col sm:flex-row gap-3 px-6 pb-6 pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    className="border-slate-400 text-slate-700 hover:bg-slate-50 gap-2"
                    onClick={() => descargarPDFAmortizacion(tabla, {
                      monto:          sim.monto,
                      tasa:           sim.tasaInteres,
                      plazo:          sim.plazo,
                      nombreAsociado: userData?.nombre,
                      tipo:           tipoLabel,
                    })}
                  >
                    <Download className="size-4" /> Descargar PDF
                  </Button>
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2 py-5"
                    onClick={() => { setSimSeleccionada(sim); setIsSimDetalleOpen(false); setIsConfirmSimOpen(true); }}>
                    <Check className="size-5" /><span className="font-bold">Confirmar y aceptar crédito</span>
                  </Button>
                  <Button variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2 py-5"
                    onClick={() => { setSimSeleccionada(sim); setIsSimDetalleOpen(false); setIsRechazarSimOpen(true); }}>
                    <X className="size-5" /><span className="font-bold">Rechazar simulación</span>
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Confirmar simulación (asociado) ── */}
      <AlertDialog open={isConfirmSimOpen} onOpenChange={setIsConfirmSimOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar y activar este crédito?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  El crédito por <strong className="text-slate-800">{simSeleccionada ? formatCurrency(simSeleccionada.monto) : ''}</strong> a{' '}
                  <strong className="text-slate-800">{simSeleccionada?.plazo} meses</strong> quedará registrado como{' '}
                  <strong className="text-emerald-600">Activo</strong> de inmediato en Gestión de Créditos.
                </p>
                <p className="text-xs text-slate-400">
                  Esta acción no se puede deshacer. El administrador recibirá una notificación.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700" onClick={handleConfirmarSimulacion} disabled={confirmandoSim}>
              {confirmandoSim ? 'Activando crédito...' : '🎉 Sí, activar crédito'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Rechazar simulación (asociado) ── */}
      <AlertDialog open={isRechazarSimOpen} onOpenChange={setIsRechazarSimOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar esta simulación?</AlertDialogTitle>
            <AlertDialogDescription>
              Al rechazar, la simulación por <strong>{simSeleccionada ? formatCurrency(simSeleccionada.monto) : ''}</strong> se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleRechazarSimulacion} disabled={rechazandoSim}>
              {rechazandoSim ? 'Rechazando...' : '❌ Sí, rechazar y eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog solicitar crédito (asociado) ── */}
      <Dialog open={isSolicitudDialogOpen} onOpenChange={(open) => {
        setIsSolicitudDialogOpen(open);
        if (!open) { setSolMonto(''); setSolTipo('libre_inversion'); setSolPlazo(''); setSolTasa(''); setSolDestino(''); setSolObs(''); }
      }}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-blue-600" /> Solicitar crédito
            </DialogTitle>
            <DialogDescription>
              Completa el formulario y el administrador revisará tu solicitud.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tipo de crédito */}
            <div className="space-y-1.5">
              <Label>Tipo de crédito <span className="text-red-500">*</span></Label>
              <Select value={solTipo} onValueChange={setSolTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CREDITO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monto + Plazo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto solicitado <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                  <Input className="pl-8" placeholder="0" value={solMonto} onChange={(e) => setSolMonto(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Plazo (meses) <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                  <Input className="pl-8" type="number" min={1} placeholder="12" value={solPlazo} onChange={(e) => setSolPlazo(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Tasa de interés */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Percent className="size-3.5 text-slate-400" /> Tasa de interés anual (%) — opcional
              </Label>
              <Input type="number" min={0} step={0.1} placeholder="Ej. 12" value={solTasa} onChange={(e) => setSolTasa(e.target.value)} />
              <p className="text-[11px] text-slate-400">Déjalo en blanco si no conoces la tasa; el admin la definirá.</p>
            </div>

            {/* ── Tarjeta de simulación en vivo ── */}
            {parseMonto(solMonto) > 0 && parseInt(solPlazo) > 0 && (() => {
              const _monto   = parseMonto(solMonto);
              const _tasa    = parseFloat(solTasa) || 0;
              const _plazo   = parseInt(solPlazo);
              const _cuota   = calcularCuota(_monto, _tasa, _plazo);
              const _total   = _cuota * _plazo;
              const _interes = _total - _monto;
              return (
                <div className="rounded-xl border border-purple-200 overflow-hidden shadow-sm">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="size-4 text-white" />
                      <span className="text-white text-sm font-bold">Simulación del crédito</span>
                    </div>
                    <span className="text-purple-200 text-[10px] font-medium uppercase tracking-wide">Método francés · cuota fija</span>
                  </div>
                  {/* KPIs */}
                  <div className="grid grid-cols-3 divide-x divide-purple-100 bg-white">
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] text-purple-400 uppercase tracking-wide font-semibold">Cuota mensual</p>
                      <p className="text-base font-black text-purple-700 mt-0.5">{formatCurrency(_cuota)}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] text-amber-500 uppercase tracking-wide font-semibold">Total intereses</p>
                      <p className="text-base font-black text-amber-600 mt-0.5">{formatCurrency(_interes)}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] text-emerald-500 uppercase tracking-wide font-semibold">Total a pagar</p>
                      <p className="text-base font-black text-emerald-600 mt-0.5">{formatCurrency(_total)}</p>
                    </div>
                  </div>
                  {/* Botones rápidos */}
                  <div className="flex gap-2 px-4 py-3 bg-slate-50 border-t border-purple-100">
                    <Button
                      type="button" variant="outline" size="sm"
                      className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50 gap-1.5 text-xs"
                      onClick={() => {
                        const t = generarTablaAmortizacion(_monto, _tasa, _plazo, new Date().toISOString().split('T')[0]);
                        setTablaSolSim(t);
                        setIsSolSimOpen(true);
                      }}
                    >
                      <Table2 className="size-3.5" /> Ver tabla completa ({_plazo} cuotas)
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      className="border-slate-300 text-slate-600 hover:bg-slate-100 gap-1.5 text-xs"
                      onClick={() => {
                        const t = generarTablaAmortizacion(_monto, _tasa, _plazo, new Date().toISOString().split('T')[0]);
                        descargarPDFAmortizacion(t, { monto: _monto, tasa: _tasa, plazo: _plazo, nombreAsociado: userData?.nombre });
                      }}
                    >
                      <Download className="size-3.5" /> PDF
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center pb-2">
                    Cálculo orientativo · las condiciones finales las define el administrador
                  </p>
                </div>
              );
            })()}

            {/* Destino */}
            <div className="space-y-1.5">
              <Label>Destino del crédito <span className="text-red-500">*</span></Label>
              <Input placeholder="Ej. Pago de matrícula universitaria" value={solDestino} onChange={(e) => setSolDestino(e.target.value)} />
            </div>

            {/* Observaciones */}
            <div className="space-y-1.5">
              <Label>Observaciones adicionales</Label>
              <Textarea placeholder="Información adicional para el administrador..." value={solObs} onChange={(e) => setSolObs(e.target.value)} rows={3} />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsSolicitudDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={savingSolicitud} onClick={handleSolicitarCredito}>
              {savingSolicitud ? 'Enviando...' : 'Enviar solicitud'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: tabla de amortización completa desde solicitud asociado ── */}
      <Dialog open={isSolSimOpen} onOpenChange={setIsSolSimOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          {/* Header con KPIs */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white">
            <DialogTitle className="text-lg font-bold flex items-center gap-2 mb-1">
              <BarChart2 className="size-5" /> Tabla de amortización — Método Francés
            </DialogTitle>
            <p className="text-purple-200 text-xs">Cuota fija mensual · cálculo orientativo, sujeto a aprobación</p>
            {tablaSolSim.length > 0 && (() => {
              const totalIntereses = tablaSolSim.reduce((s, r) => s + r.interes, 0);
              const totalPagado    = tablaSolSim.reduce((s, r) => s + r.cuota,   0);
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
                    <p className="text-purple-200 text-[10px] uppercase tracking-wide">Monto</p>
                    <p className="font-bold text-sm">{formatCurrency(tablaSolSim.reduce((s,r)=>s+r.capital,0))}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
                    <p className="text-purple-200 text-[10px] uppercase tracking-wide">Cuota mensual</p>
                    <p className="font-bold text-sm">{formatCurrency(tablaSolSim[0].cuota)}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
                    <p className="text-purple-200 text-[10px] uppercase tracking-wide">Total intereses</p>
                    <p className="font-bold text-sm">{formatCurrency(totalIntereses)}</p>
                  </div>
                  <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
                    <p className="text-purple-200 text-[10px] uppercase tracking-wide">Total a pagar</p>
                    <p className="font-bold text-sm">{formatCurrency(totalPagado)}</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Tabla */}
          <div className="rounded-xl overflow-hidden mx-5 my-4 border border-slate-200">
            <div style={{ maxHeight: '44vh', overflowY: 'auto' }}>
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-white sticky top-0 z-10">
                  <tr>
                    {['N°', 'Fecha de pago', 'Cuota total', 'Interés', 'Capital', 'Saldo restante'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tablaSolSim.map((r, idx) => (
                    <tr key={r.numero} className={idx % 2 === 0 ? 'bg-white hover:bg-purple-50/40' : 'bg-slate-50 hover:bg-purple-50/40'}>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-black">
                          {r.numero}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 font-medium whitespace-nowrap">{r.fecha}</td>
                      <td className="px-4 py-2.5 font-black text-purple-700 whitespace-nowrap">{formatCurrency(r.cuota)}</td>
                      <td className="px-4 py-2.5 text-amber-600 font-medium whitespace-nowrap">{formatCurrency(r.interes)}</td>
                      <td className="px-4 py-2.5 text-blue-600 font-medium whitespace-nowrap">{formatCurrency(r.capital)}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-800 whitespace-nowrap">
                        {r.saldo === 0
                          ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Pagado</span>
                          : formatCurrency(r.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {tablaSolSim.length > 0 && (
                  <tfoot className="bg-slate-800 text-white sticky bottom-0">
                    <tr>
                      <td colSpan={2} className="px-4 py-2.5 font-bold text-xs">TOTALES</td>
                      <td className="px-4 py-2.5 font-black text-purple-300 whitespace-nowrap">{formatCurrency(tablaSolSim.reduce((s,r)=>s+r.cuota,0))}</td>
                      <td className="px-4 py-2.5 font-bold text-amber-300 whitespace-nowrap">{formatCurrency(tablaSolSim.reduce((s,r)=>s+r.interes,0))}</td>
                      <td className="px-4 py-2.5 font-bold text-blue-300 whitespace-nowrap">{formatCurrency(tablaSolSim.reduce((s,r)=>s+r.capital,0))}</td>
                      <td className="px-4 py-2.5 font-bold text-emerald-300">$ 0</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Footer con acciones */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 pb-5 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500 text-center sm:text-left">
              ¿Te convence el plan? Envía tu solicitud y el administrador la revisará.
            </p>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                className="border-slate-300 text-slate-600 gap-2"
                onClick={() => descargarPDFAmortizacion(tablaSolSim, {
                  monto:          tablaSolSim.reduce((s,r) => s + r.capital, 0),
                  tasa:           parseFloat(solTasa) || 0,
                  plazo:          tablaSolSim.length,
                  nombreAsociado: userData?.nombre,
                })}
              >
                <Download className="size-4" /> Descargar PDF
              </Button>
              <Button variant="outline" onClick={() => setIsSolSimOpen(false)}>
                Volver al formulario
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 gap-2"
                disabled={savingSolicitud}
                onClick={() => { setIsSolSimOpen(false); handleSolicitarCredito(); }}
              >
                {savingSolicitud ? 'Enviando...' : '📤 Enviar solicitud'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Detalle del crédito (asociado) ─────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isDetailDialogOpen} onOpenChange={(open) => {
        setIsDetailDialogOpen(open);
        if (!open) { setSelectedItem(null); setHistorialDetalle([]); }
      }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-blue-600" /> Detalle del crédito
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (() => {
            const monto       = selectedItem.monto       ?? 0;
            const saldo       = selectedItem.saldo       ?? monto;
            const cuota       = selectedItem.cuotaMensual ?? 0;
            const tasaAnual   = selectedItem.tasaInteres  ?? 0;
            const plazo       = selectedItem.plazo        ?? 0;
            const tasaMensual = tasaAnual > 0 ? tasaAnual / 100 / 12 : 0;

            const cuotasPagadasReal = historialDetalle.length;
            const cuotasPagadas     = cuotasPagadasReal > 0
              ? cuotasPagadasReal
              : (cuota > 0 ? Math.max(0, Math.round((monto - saldo) / cuota)) : 0);
            const cuotasPendientes  = Math.max(0, plazo - cuotasPagadas);

            const capitalPagado    = historialDetalle.reduce((s: number, p: any) => s + (p.capital ?? 0), 0);
            const interesesPagados = historialDetalle.reduce((s: number, p: any) => s + (p.interes  ?? 0), 0);

            let interesesPendientes = 0;
            let saldoTemp = saldo;
            for (let i = 0; i < cuotasPendientes; i++) {
              const intCuota = Math.round(saldoTemp * tasaMensual);
              const capCuota = Math.round(cuota - intCuota);
              interesesPendientes += intCuota;
              saldoTemp = Math.max(0, saldoTemp - capCuota);
            }

            const fechaBase = selectedItem.fechaDesembolso
              ? new Date(selectedItem.fechaDesembolso + 'T00:00:00') : null;
            const fechaBaseAmort    = fechaBase ?? new Date();
            const fechaVencimiento  = fechaBase && plazo > 0
              ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + plazo, fechaBase.getDate()) : null;
            const fechaVencProxima  = fechaBase && cuotasPagadas < plazo
              ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + cuotasPagadas + 1, fechaBase.getDate()) : null;

            const hoyMs    = new Date(); hoyMs.setHours(0,0,0,0);
            const diasMora = (selectedItem.estadoAprobacion === 'en_mora' && fechaVencProxima && fechaVencProxima < hoyMs)
              ? Math.floor((hoyMs.getTime() - fechaVencProxima.getTime()) / 86400000) : 0;

            const numCredito = `CRE-${String(selectedItem.id ?? '').substring(0, 8).toUpperCase()}`;

            const amortizacion: { num: number; fecha: string; cuota: number; capital: number; interes: number; saldoFinal: number; pagada: boolean }[] = [];
            let saldoAcum = monto;
            for (let i = 1; i <= plazo; i++) {
              const interesCuota = Math.round(saldoAcum * tasaMensual);
              const capitalCuota = Math.round(cuota - interesCuota);
              saldoAcum = Math.max(0, saldoAcum - capitalCuota);
              const fechaCuota = new Date(fechaBaseAmort.getFullYear(), fechaBaseAmort.getMonth() + i, fechaBaseAmort.getDate());
              amortizacion.push({
                num: i, fecha: fechaCuota.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
                cuota, capital: capitalCuota, interes: interesCuota, saldoFinal: saldoAcum, pagada: i <= cuotasPagadas,
              });
            }

            return (
              <div className="space-y-4 py-1">
                {/* Encabezado */}
                <div className="rounded-xl border border-blue-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg"><CreditCard className="size-5 text-white" /></div>
                      <div>
                        <p className="text-xs text-blue-100 font-medium">N° de crédito</p>
                        <p className="text-lg font-bold text-white tracking-wider">{numCredito}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-blue-100 mb-1">
                        {TIPOS_CREDITO.find(t => t.value === selectedItem.tipo)?.label ?? 'Crédito de consumo'}
                      </p>
                      {selectedItem.anulado
                        ? <Badge className="bg-red-500 text-white border-0">Anulado</Badge>
                        : getEstadoBadge(selectedItem.estadoAprobacion)}
                    </div>
                  </div>
                  <div className="bg-blue-50 px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="col-span-2 flex items-center gap-2 pb-2 border-b border-blue-100 mb-0.5">
                      <div className="p-1.5 bg-blue-100 rounded-full"><Users className="size-3.5 text-blue-600" /></div>
                      <div>
                        <p className="font-bold text-slate-900">{selectedItem.asociado}</p>
                        <p className="text-slate-500">C.C. {selectedItem.cedula}</p>
                      </div>
                    </div>
                    <div><span className="text-slate-400">Monto aprobado</span><p className="font-bold text-slate-800">{formatCurrency(monto)}</p></div>
                    <div><span className="text-slate-400">Cuota mensual</span><p className="font-bold text-indigo-700">{formatCurrency(cuota)}</p></div>
                    <div>
                      <span className="text-slate-400">Tasa de interés</span>
                      <p className="font-bold text-orange-700">{tasaAnual > 0 ? `${tasaAnual}% EA` : 'Sin interés'}</p>
                    </div>
                    <div><span className="text-slate-400">Plazo total</span><p className="font-bold text-slate-800">{plazo} meses</p></div>
                    <div>
                      <span className="text-slate-400">Fecha de inicio</span>
                      <p className="font-bold text-slate-800">
                        {selectedItem.fechaDesembolso
                          ? new Date(selectedItem.fechaDesembolso + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Fecha de vencimiento</span>
                      <p className="font-bold text-slate-800">
                        {fechaVencimiento
                          ? fechaVencimiento.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Resumen financiero */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-700 px-4 py-2.5 flex items-center gap-2">
                    <BarChart2 className="size-4 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Resumen financiero</p>
                  </div>
                  <div className="grid grid-cols-3 gap-px bg-slate-200">
                    <div className={`bg-white p-3 ${diasMora > 0 ? 'bg-red-50' : ''}`}>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Saldo pendiente</p>
                      <p className={`text-base font-bold mt-0.5 ${saldo <= 0 ? 'text-emerald-600' : diasMora > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {saldo <= 0 ? '✓ Pagado' : formatCurrency(saldo)}
                      </p>
                    </div>
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Capital pagado</p>
                      <p className="text-base font-bold text-blue-700 mt-0.5">{formatCurrency(capitalPagado)}</p>
                    </div>
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Intereses pagados</p>
                      <p className="text-base font-bold text-orange-600 mt-0.5">{formatCurrency(interesesPagados)}</p>
                    </div>
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Intereses pendientes</p>
                      <p className="text-sm font-semibold text-amber-600 mt-0.5">
                        {cuotasPendientes > 0 ? `≈ ${formatCurrency(interesesPendientes)}` : '—'}
                      </p>
                    </div>
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Cuotas pagadas</p>
                      <p className="text-base font-bold text-emerald-700 mt-0.5">
                        {cuotasPagadas} <span className="text-xs font-normal text-slate-400">de {plazo}</span>
                      </p>
                    </div>
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Cuotas pendientes</p>
                      <p className={`text-base font-bold mt-0.5 ${cuotasPendientes > 0 ? 'text-slate-700' : 'text-emerald-600'}`}>
                        {cuotasPendientes > 0 ? cuotasPendientes : '—'}
                      </p>
                    </div>
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Valor de cuota</p>
                      <p className="text-base font-bold text-indigo-700 mt-0.5">{formatCurrency(cuota)}</p>
                    </div>
                    <div className="bg-white p-3 col-span-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Próxima fecha de pago</p>
                      <p className={`text-sm font-semibold mt-0.5 ${diasMora > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                        {fechaVencProxima
                          ? fechaVencProxima.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                          : <span className="text-emerald-600">Pagado ✓</span>}
                      </p>
                    </div>
                  </div>
                  {/* Barra de progreso */}
                  <div className="bg-white px-4 py-3 border-t border-slate-100">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span className="font-medium">Progreso del crédito</span>
                      <span>{plazo > 0 ? `${((cuotasPagadas / plazo) * 100).toFixed(0)}% completado` : '—'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${diasMora > 0 ? 'bg-red-400' : 'bg-emerald-500'}`}
                        style={{ width: plazo > 0 ? `${(cuotasPagadas / plazo) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tabla de amortización */}
                <Tabs defaultValue="amortizacion">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="amortizacion" className="text-xs gap-1">
                      <Clock className="size-3" /> Cuotas
                    </TabsTrigger>
                    <TabsTrigger value="pagos" className="text-xs gap-1">
                      <History className="size-3" />
                      Pagos{historialDetalle.length > 0 && ` (${historialDetalle.length})`}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="amortizacion" className="mt-3">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                            <tr>
                              <th className="px-2 py-2 text-left text-slate-500 font-medium">#</th>
                              <th className="px-2 py-2 text-left text-slate-500 font-medium">Fecha</th>
                              <th className="px-2 py-2 text-right text-slate-500 font-medium">Cuota</th>
                              <th className="px-2 py-2 text-right text-slate-500 font-medium">Capital</th>
                              <th className="px-2 py-2 text-right text-slate-500 font-medium">Interés</th>
                              <th className="px-2 py-2 text-right text-slate-500 font-medium">Saldo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {amortizacion.map((row) => (
                              <tr key={row.num} className={row.pagada ? 'bg-emerald-50/50 opacity-60' : 'hover:bg-slate-50'}>
                                <td className="px-2 py-1.5 text-slate-400">{row.num}</td>
                                <td className="px-2 py-1.5 text-slate-600">{row.fecha}</td>
                                <td className="px-2 py-1.5 text-right font-medium text-slate-800">{formatCurrency(row.cuota)}</td>
                                <td className="px-2 py-1.5 text-right text-blue-600">{formatCurrency(row.capital)}</td>
                                <td className="px-2 py-1.5 text-right text-orange-600">{formatCurrency(row.interes)}</td>
                                <td className="px-2 py-1.5 text-right font-semibold text-indigo-700">{formatCurrency(row.saldoFinal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {/* Botón PDF */}
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="outline" size="sm"
                        className="gap-1.5 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => descargarPDFAmortizacion(
                          amortizacion.map(r => ({ numero: r.num, fecha: r.fecha, cuota: r.cuota, capital: r.capital, interes: r.interes, saldo: r.saldoFinal })),
                          { monto, tasa: tasaAnual, plazo, nombreAsociado: selectedItem.asociado, tipo: selectedItem.tipo }
                        )}
                      >
                        <Download className="size-3" /> Descargar PDF
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="pagos" className="mt-3">
                    {loadingHistorialDetalle ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                      </div>
                    ) : historialDetalle.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                        <History className="size-7" />
                        <p className="text-sm">Sin pagos registrados aún</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="max-h-64 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                              <tr>
                                <th className="px-2 py-2 text-left text-slate-500 font-medium">Cuota</th>
                                <th className="px-2 py-2 text-left text-slate-500 font-medium">Fecha</th>
                                <th className="px-2 py-2 text-right text-slate-500 font-medium">Valor</th>
                                <th className="px-2 py-2 text-right text-slate-500 font-medium">Capital</th>
                                <th className="px-2 py-2 text-right text-slate-500 font-medium">Interés</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {historialDetalle.map((p: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-2 py-1.5 font-medium text-slate-700">#{p.num_cuota ?? idx + 1}</td>
                                  <td className="px-2 py-1.5 text-slate-600">
                                    {p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-semibold text-emerald-700">{formatCurrency(p.monto_pagado ?? p.valor ?? 0)}</td>
                                  <td className="px-2 py-1.5 text-right text-blue-600">{formatCurrency(p.capital ?? 0)}</td>
                                  <td className="px-2 py-1.5 text-right text-orange-600">{formatCurrency(p.interes ?? 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Pagar cuota (asociado) ──────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isPagoDialogOpen} onOpenChange={(open) => {
        setIsPagoDialogOpen(open);
        if (!open) { setSelectedItem(null); setHistorialPagos([]); }
      }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="size-5 text-emerald-600" /> Pagar cuota del crédito
            </DialogTitle>
            <DialogDescription>
              {selectedItem && `Saldo pendiente: ${formatCurrency(selectedItem.saldo)}`}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (() => {
            const saldo       = selectedItem.saldo       ?? 0;
            const cuota       = selectedItem.cuotaMensual ?? 0;
            const tasaAnual   = selectedItem.tasaInteres  ?? 0;
            const tasaMensual = tasaAnual > 0 ? tasaAnual / 100 / 12 : 0;
            const montoPago   = parseFloat(pagoMonto.replace(/[^\d.]/g, '')) || 0;
            const interesPrev = Math.round(saldo * tasaMensual);
            const capitalPrev = Math.max(0, Math.round(montoPago - interesPrev));
            const saldoNuevo  = Math.max(0, saldo - capitalPrev);
            const numCuotaNext = historialPagos.length + 1;

            const fechaBase = selectedItem.fechaDesembolso
              ? new Date(selectedItem.fechaDesembolso + 'T00:00:00') : new Date();
            const fechaVenc = new Date(
              fechaBase.getFullYear(),
              fechaBase.getMonth() + numCuotaNext,
              fechaBase.getDate()
            );

            return (
              <div className="space-y-5 py-1">
                {/* Resumen */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-indigo-500 uppercase">Monto original</p>
                    <p className="text-sm font-bold text-indigo-700 mt-0.5">{formatCurrency(selectedItem.monto)}</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-orange-500 uppercase">Saldo pendiente</p>
                    <p className="text-sm font-bold text-orange-700 mt-0.5">{formatCurrency(saldo)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-blue-500 uppercase">Cuota mensual</p>
                    <p className="text-sm font-bold text-blue-700 mt-0.5">{formatCurrency(cuota)}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">N° cuota</p>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">{numCuotaNext} de {selectedItem.plazo}</p>
                  </div>
                </div>

                {/* Fecha vencimiento */}
                <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-sm">
                  <Calendar className="size-4 text-yellow-600 shrink-0" />
                  <span className="text-slate-600">
                    Vencimiento cuota {numCuotaNext}:{' '}
                    <span className="font-bold text-yellow-700">
                      {fechaVenc.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </span>
                </div>

                {/* Formulario */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos del pago</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="asoc-pago-monto" className="flex items-center gap-1.5">
                        <DollarSign className="size-3.5 text-emerald-500" /> Monto a pagar <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="asoc-pago-monto"
                        type="text"
                        placeholder={formatCurrency(cuota)}
                        value={pagoMonto}
                        onChange={e => setPagoMonto(e.target.value.replace(/[^\d.]/g, ''))}
                        className={
                          pagoMonto && parseFloat(pagoMonto) < cuota && cuota > 0
                            ? 'border-red-400 focus-visible:ring-red-400'
                            : pagoMonto && parseFloat(pagoMonto) >= cuota && cuota > 0
                            ? 'border-emerald-400 focus-visible:ring-emerald-400'
                            : ''
                        }
                      />
                      {pagoMonto && parseFloat(pagoMonto) < cuota && cuota > 0 ? (
                        <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                          <AlertTriangle className="size-3 shrink-0" />
                          Mínimo a pagar: <strong>{formatCurrency(cuota)}</strong>
                        </p>
                      ) : pagoMonto && parseFloat(pagoMonto) > cuota && cuota > 0 ? (
                        <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="size-3 shrink-0" />
                          Excedente <strong>{formatCurrency(parseFloat(pagoMonto) - cuota)}</strong> se abonará al capital
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">Mínimo: <strong>{formatCurrency(cuota)}</strong> · puedes pagar más para reducir capital</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="asoc-pago-fecha" className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-slate-500" /> Fecha del pago <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="asoc-pago-fecha"
                        type="date"
                        value={pagoFecha}
                        onChange={e => setPagoFecha(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <CreditCardIcon className="size-3.5 text-slate-500" /> Método de pago
                    </Label>
                    <Select value={pagoMetodo} onValueChange={(v) => { setPagoMetodo(v); setPagoComprobante(null); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                        <SelectItem value="transferencia">🏦 Transferencia bancaria</SelectItem>

                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Comprobante — obligatorio si es transferencia */}
                  {pagoMetodo === 'transferencia' && (
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-sm font-medium">
                        <Upload className="size-3.5 text-blue-500" />
                        Comprobante de transferencia <span className="text-red-500">*</span>
                      </Label>
                      <div
                        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-colors ${
                          pagoComprobante
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                        }`}
                        onClick={() => document.getElementById('asoc-comprobante-input')?.click()}
                      >
                        <input
                          id="asoc-comprobante-input"
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={e => setPagoComprobante(e.target.files?.[0] ?? null)}
                        />
                        {pagoComprobante ? (
                          <>
                            <CheckCircle2 className="size-6 text-emerald-500" />
                            <p className="text-sm font-medium text-emerald-700 text-center break-all">{pagoComprobante.name}</p>
                            <p className="text-xs text-slate-500">{(pagoComprobante.size / 1024).toFixed(0)} KB · haz clic para cambiar</p>
                          </>
                        ) : (
                          <>
                            <Upload className="size-6 text-blue-400" />
                            <p className="text-sm font-medium text-blue-700">Haz clic para adjuntar el comprobante</p>
                            <p className="text-xs text-slate-500">JPG, PNG o PDF · máx. 5 MB</p>
                          </>
                        )}
                      </div>
                      {!pagoComprobante && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="size-3" /> Requerido para pagos por transferencia
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="asoc-pago-obs" className="flex items-center gap-1.5">
                      <FileText className="size-3.5 text-slate-500" /> Observación <span className="text-xs text-slate-400 font-normal">(opcional)</span>
                    </Label>
                    <Textarea
                      id="asoc-pago-obs"
                      placeholder="Ej: Referencia de transferencia, etc."
                      className="resize-none text-sm"
                      rows={2}
                      value={pagoObservacion}
                      onChange={e => setPagoObservacion(e.target.value)}
                    />
                  </div>
                </div>

                {/* Desglose */}
                {montoPago > 0 && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Desglose del pago</p>
                    {(() => {
                      const capitalNormal = Math.max(0, Math.round(cuota - interesPrev));
                      const abonoExtra    = Math.max(0, capitalPrev - capitalNormal);
                      return montoPago > cuota ? (
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Interés</p>
                            <p className="text-sm font-bold text-orange-600">{formatCurrency(interesPrev)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Capital cuota</p>
                            <p className="text-sm font-bold text-blue-600">{formatCurrency(capitalNormal)}</p>
                          </div>
                          <div className="bg-violet-50 rounded-lg p-1 border border-violet-200">
                            <p className="text-[10px] text-violet-600 uppercase font-semibold">Abono extra</p>
                            <p className="text-sm font-bold text-violet-700">+{formatCurrency(abonoExtra)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Nuevo saldo</p>
                            <p className="text-sm font-bold text-emerald-700">{formatCurrency(saldoNuevo)}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Interés</p>
                            <p className="text-sm font-bold text-orange-600">{formatCurrency(interesPrev)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Capital</p>
                            <p className="text-sm font-bold text-blue-600">{formatCurrency(capitalPrev)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Nuevo saldo</p>
                            <p className="text-sm font-bold text-emerald-700">{formatCurrency(saldoNuevo)}</p>
                          </div>
                        </div>
                      );
                    })()}
                    {montoPago > cuota && cuota > 0 && (
                      <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 shrink-0" />
                        El excedente se aplica directamente al capital, reduciendo el saldo más rápido
                      </p>
                    )}
                    {saldoNuevo <= 0 && (
                      <div className="flex items-center gap-2 pt-1 text-emerald-700 font-semibold text-sm">
                        <CheckCircle2 className="size-4" /> ¡Este pago cancela el crédito completamente!
                      </div>
                    )}
                  </div>
                )}

                {/* Historial */}
                {historialPagos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <History className="size-4 text-slate-400" />
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Pagos anteriores ({historialPagos.length})
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="max-h-40 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                            <tr>
                              <th className="px-2 py-2 text-center text-slate-500">#</th>
                              <th className="px-2 py-2 text-left text-slate-500">Fecha</th>
                              <th className="px-2 py-2 text-right text-slate-500">Pagado</th>
                              <th className="px-2 py-2 text-right text-slate-500">Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historialPagos.map((p: any) => (
                              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                <td className="px-2 py-1.5 text-center text-slate-500">{p.num_cuota ?? '—'}</td>
                                <td className="px-2 py-1.5 text-slate-600">
                                  {new Date(p.fecha_pago).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-2 py-1.5 text-right font-semibold text-emerald-700">{formatCurrency(p.monto_pagado)}</td>
                                <td className="px-2 py-1.5 text-right text-indigo-600">{formatCurrency(p.saldo_despues)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPagoDialogOpen(false)}>Cancelar</Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleRegistrarPago}
              disabled={pagando || !selectedItem || (selectedItem?.saldo ?? 0) <= 0}
            >
              {pagando
                ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> Procesando...</>
                : <><Banknote className="size-4" /> Registrar pago</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando créditos...</p>
        </div>
      </div>
    );
  }

  const renderPagination = (total: number, page: number, setPage: (p: number) => void, count: number, start: number) => (
    <div className="flex items-center justify-between mt-3">
      <p className="text-sm text-slate-600">
        Mostrando {count === 0 ? 0 : start + 1} a {Math.min(start + itemsPerPage, count)} de {count}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
          <ChevronLeft className="size-4" />
        </Button>
        {Array.from({ length: total }, (_, i) => i + 1).map(p => (
          <Button key={p} variant={page === p ? 'default' : 'outline'} size="sm"
            onClick={() => setPage(p)} className={page === p ? 'bg-blue-600 hover:bg-blue-700' : ''}>{p}</Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => setPage(Math.min(total, page + 1))} disabled={page === total}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );

  // ── Ruta exclusiva para el rol asociado ──────────────────────────────────
  if (userRole === 'asociado') return renderVistaAsociado();

  const renderTable = (list: any[], isAnulados = false) => (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asociado</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Tasa EA</TableHead>
            <TableHead>Plazo</TableHead>
            <TableHead>Cuota mensual</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Aprobación</TableHead>
            <TableHead>Soporte</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <CreditCard className="size-10" />
                  <p>{isAnulados ? 'No hay créditos anulados' : 'No hay créditos registrados'}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : list.map((c) => (
            <TableRow key={c.id} className="cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={async () => {
                setSelectedItem(c);
                setIsDetailDialogOpen(true);
                // Cargar historial real de pagos
                setLoadingHistorialDetalle(true);
                try {
                  const pagos = await pagosCreditoApi.getByCredito(c.id);
                  setHistorialDetalle(pagos ?? []);
                } catch { setHistorialDetalle([]); }
                finally { setLoadingHistorialDetalle(false); }
              }}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${isAnulados ? 'bg-slate-100' : 'bg-blue-50'}`}>
                    <CreditCard className={`size-4 ${isAnulados ? 'text-slate-500' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{c.asociado}</p>
                    <p className="text-xs text-slate-400">{c.cedula}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] whitespace-nowrap">
                  {TIPOS_CREDITO.find(t => t.value === c.tipo)?.label ?? 'Libre inversión'}
                </Badge>
              </TableCell>
              <TableCell><p className="font-semibold text-slate-900">{formatCurrency(c.monto)}</p></TableCell>
              <TableCell>
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {c.tasaInteres > 0 ? `${c.tasaInteres}%` : '—'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">{c.plazo} m.</Badge>
              </TableCell>
              <TableCell><p className="text-slate-600">{formatCurrency(c.cuotaMensual)}</p></TableCell>
              <TableCell><p className="font-medium text-blue-700">{formatCurrency(c.saldo)}</p></TableCell>
              <TableCell>
                {isAnulados
                  ? <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Anulado</Badge>
                  : getEstadoBadge(c.estadoAprobacion)}
              </TableCell>
              <TableCell>
                {c.descripcionSoporte || c.urlDocumento ? (
                  <div className="flex items-center gap-1 text-xs text-emerald-600">
                    <FileText className="size-3" />
                    <span>Adjunto</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-1.5 justify-end">
                  {!isAnulados && userRole === 'asociado' && c.saldo > 0 && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      title="Pagar cuota"
                      onClick={() => handleOpenPago(c)}
                    >
                      <Banknote className="size-3.5" /> Pagar
                    </Button>
                  )}
                  {!isAnulados && userRole === 'admin' && (
                    <>
                      <Button variant="outline" size="sm" title="Editar"
                        onClick={() => handleOpenCreate(c)}>
                        <Edit className="size-4" />
                      </Button>
                      <Button variant="outline" size="sm" title="Anular crédito"
                        onClick={() => handleOpenAnular(c)}>
                        <Trash2 className="size-4 text-red-500" />
                      </Button>
                    </>
                  )}
                  {isAnulados && userRole === 'admin' && (
                    <Button
                      variant="outline" size="sm"
                      title="Eliminar definitivamente"
                      className="hover:bg-red-50 border-red-200"
                      onClick={() => handleOpenHardDelete(c)}
                    >
                      <ShieldAlert className="size-4 text-red-600" />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" title="Descargar certificado"
                    className="hover:bg-emerald-50"
                    onClick={() => {
                      const ok = generateCreditoPDF({
                        id:               c.id,
                        tipo:             c.tipo,
                        asociado:         c.asociado,
                        cedula:           c.cedula,
                        monto:            c.monto,
                        plazo:            c.plazo,
                        tasaInteres:      c.tasaInteres,
                        cuotaMensual:     c.cuotaMensual,
                        saldo:            c.saldo,
                        fechaDesembolso:  c.fechaDesembolso,
                        estadoAprobacion: c.estadoAprobacion,
                        descripcionSoporte: c.descripcionSoporte,
                        anulado:          c.anulado,
                        motivoAnulacion:  c.motivoAnulacion,
                        motivoEstadoCambio: c.motivoEstadoCambio,
                      });
                      if (ok) toast.success('PDF descargado');
                      else toast.error('Error al generar el PDF');
                    }}>
                    <FileText className="size-4 text-emerald-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Gestión de Créditos</h1>
            <p className="text-slate-600">
              {userRole === 'asociado' ? 'Consulta tus créditos' : 'Administra los créditos de los asociados'}
            </p>
          </div>
          {userRole === 'admin' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                onClick={() => setIsInformeDialogOpen(true)}
              >
                <BarChart2 className="size-4" /> Informe de cartera
              </Button>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => handleOpenCreate()}>
                <Plus className="size-4" /> Nuevo crédito
              </Button>
            </div>
          )}
        </div>

        {/* ── Resumen de cartera ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Card 1 — Créditos activos + distribución por estado */}
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Créditos activos
                  </p>
                  <p className="text-3xl font-bold text-slate-900">{carteraActivos.length}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {creditosAnulados.length} anulado{creditosAnulados.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-blue-50">
                  <Users className="size-5 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex gap-1.5 flex-wrap">
                {ESTADOS_APROBACION.filter(e => countByEstado[e.value] > 0).map(e => (
                  <span key={e.value}
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${e.color}`}>
                    {countByEstado[e.value]} {e.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Card 2 — Cartera total = suma de montos otorgados */}
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Cartera total
                  </p>
                  <p className="text-2xl font-bold text-indigo-700">
                    {formatCurrency(totalCartera)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Capital otorgado en {carteraActivos.length} crédito{carteraActivos.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50">
                  <Wallet className="size-5 text-indigo-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5">
                <DollarSign className="size-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">
                  Promedio por crédito:{' '}
                  <span className="font-semibold text-slate-700">
                    {carteraActivos.length > 0
                      ? formatCurrency(Math.round(totalCartera / carteraActivos.length))
                      : '—'}
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3 — Cuota mensual total (lo que ingresa cada mes) */}
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Recaudo mensual
                  </p>
                  <p className="text-2xl font-bold text-emerald-700">
                    {formatCurrency(totalCuotaMensual)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Suma de cuotas mensuales activas
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50">
                  <Activity className="size-5 text-emerald-600" />
                </div>
              </div>
              {/* Relación cuota / cartera: qué % de la cartera se recauda cada mes */}
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Cuota / Cartera</span>
                  <span>
                    {totalCartera > 0
                      ? `${((totalCuotaMensual / totalCartera) * 100).toFixed(2)}% mensual`
                      : '—'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
                    style={{
                      width: totalCartera > 0
                        ? `${Math.min(100, (totalCuotaMensual / totalCartera) * 100 * 10).toFixed(1)}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 4 — Indicadores de condiciones */}
          <Card className="border-0 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Condiciones promedio
                  </p>
                  <p className="text-2xl font-bold text-orange-700">
                    {tasaPromedio > 0 ? `${tasaPromedio.toFixed(2)}% EA` : 'Sin tasa'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Tasa de interés promedio</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-50">
                  <TrendingUp className="size-5 text-orange-600" />
                </div>
              </div>
              <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Plazo promedio</span>
                  <span className="font-semibold text-slate-700">
                    {plazoPromedio > 0 ? `${plazoPromedio} meses` : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cuota promedio</span>
                  <span className="font-semibold text-slate-700">
                    {carteraActivos.length > 0
                      ? formatCurrency(Math.round(totalCuotaMensual / carteraActivos.length))
                      : '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── Tabla ── */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <CardTitle>Lista de Créditos</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                {/* Buscador con autocompletado */}
                <div className="relative flex-1 sm:flex-none sm:w-64" ref={searchRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10" />
                  {searchTerm && (
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-10"
                      onClick={() => { setSearchTerm(''); setCurrentPage(1); setShowSearchSugg(false); }}>
                      <X className="size-3.5" />
                    </button>
                  )}
                  <Input placeholder="Buscar por nombre o cédula..." className="pl-10 pr-8"
                    value={searchTerm} autoComplete="off"
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setShowSearchSugg(true); }}
                    onFocus={() => setShowSearchSugg(true)}
                  />
                  {showSearchSugg && searchTerm.trim().length > 0 && (() => {
                    const term = searchTerm.toLowerCase();
                    const seen = new Set<string>();
                    const sugs = creditos.filter(c => {
                      const match = c.asociado.toLowerCase().includes(term) || c.cedula.includes(searchTerm);
                      if (!match || seen.has(c.asociado_id)) return false;
                      seen.add(c.asociado_id); return true;
                    }).slice(0, 6);
                    if (!sugs.length) return null;
                    return (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                        <p className="text-xs text-slate-400 px-3 pt-2 pb-1 border-b border-slate-100">Asociados con crédito</p>
                        {sugs.map(s => (
                          <button key={s.asociado_id} type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between group"
                            onMouseDown={() => { setSearchTerm(s.asociado); setCurrentPage(1); setShowSearchSugg(false); }}>
                            <div className="flex items-center gap-2">
                              <CreditCard className="size-3.5 text-blue-400" />
                              <span className="text-sm font-medium text-slate-800 group-hover:text-blue-700">{s.asociado}</span>
                            </div>
                            <span className="text-xs text-slate-400">{s.cedula}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Filtro por estado de aprobación */}
                <Select value={filterEstado} onValueChange={(v) => { setFilterEstado(v === 'todos' ? '' : v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Aprobación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    {ESTADOS_APROBACION.map(e => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="activos">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="activos" className="gap-2">
                  <CreditCard className="size-4" /> Activos ({filteredCreditos.length})
                </TabsTrigger>
                <TabsTrigger value="anulados" className="gap-2">
                  <FileText className="size-4" /> Anulados ({filteredAnulados.length})
                </TabsTrigger>
                <TabsTrigger value="solicitudes" className="gap-2 relative">
                  <Clock className="size-4" /> Solicitudes
                  {solicitudesCredito.length > 0 && (
                    <span className="absolute -top-1 -right-1 size-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {solicitudesCredito.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="simulaciones" className="gap-2 relative">
                  <BarChart2 className="size-4" /> Simulaciones
                  {creditosSimulacion.length > 0 && (
                    <span className="absolute -top-1 -right-1 size-4 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {creditosSimulacion.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="activos" className="space-y-3">
                {renderTable(currentList)}
                {filteredCreditos.length > 0 && renderPagination(totalPages, currentPage, setCurrentPage, filteredCreditos.length, startIndex)}
              </TabsContent>
              <TabsContent value="anulados" className="space-y-3">
                {renderTable(currentAnulados, true)}
                {filteredAnulados.length > 0 && renderPagination(totalPagesAn, currentPageAnulados, setCurrentPageAnulados, filteredAnulados.length, startIndexAn)}
              </TabsContent>
              <TabsContent value="solicitudes">
                {solicitudesCredito.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                    <div className="p-4 bg-slate-100 rounded-full">
                      <CheckCircle2 className="size-8 text-slate-300" />
                    </div>
                    <p className="font-semibold text-slate-500">No hay solicitudes pendientes</p>
                    <p className="text-sm">Cuando los asociados soliciten créditos aparecerán aquí.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {solicitudesCredito.map(sol => {
                      const cuotaEst = calcularCuota(sol.monto, sol.tasaInteres, sol.plazoMeses);
                      return (
                        <Card key={sol.id} className="border border-amber-200 bg-amber-50/30">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-slate-900">{sol.asociado}</span>
                                  <span className="text-xs text-slate-400">{sol.cedula}</span>
                                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[11px]">
                                    Pendiente
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                                  <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Tipo</p>
                                    <p className="text-sm text-slate-700">{sol.tipoCreditoLabel}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Monto</p>
                                    <p className="text-sm font-bold text-slate-900">{formatCurrency(sol.monto)}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Plazo</p>
                                    <p className="text-sm text-slate-700">{sol.plazoMeses} meses</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Cuota est.</p>
                                    <p className="text-sm text-indigo-700 font-semibold">{formatCurrency(cuotaEst)}</p>
                                  </div>
                                </div>
                                {sol.destino && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    <span className="font-semibold">Destino:</span> {sol.destino}
                                  </p>
                                )}
                                {sol.observaciones && (
                                  <p className="text-xs text-slate-500">
                                    <span className="font-semibold">Observaciones:</span> {sol.observaciones}
                                  </p>
                                )}
                                <p className="text-[11px] text-slate-400">
                                  Solicitado: {new Date(sol.createdAt).toLocaleString('es-CO', {
                                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              </div>
                              <div className="flex flex-col gap-2 shrink-0">
                                <Button
                                  size="sm"
                                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleAprobarSolicitudCredito(sol)}
                                >
                                  <Check className="size-3.5" /> Aprobar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={() => { setSolicitudSeleccionada(sol); setNotaRechazoSol(''); setIsRechazarSolOpen(true); }}
                                >
                                  <X className="size-3.5" /> Rechazar
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ── Tab Simulaciones pendientes (admin) ── */}
              <TabsContent value="simulaciones">
                {creditosSimulacion.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    <BarChart2 className="size-10 mx-auto mb-3 opacity-30" />
                    No hay simulaciones pendientes de confirmación.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                      📊 Estas simulaciones fueron enviadas al asociado. <strong>El crédito se registrará solo cuando el asociado confirme.</strong> Si rechaza, se eliminará automáticamente.
                    </p>
                    {creditosSimulacion.map(sim => (
                      <div key={sim.id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-purple-200 bg-purple-50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-purple-100 rounded-xl shrink-0">
                            <BarChart2 className="size-5 text-purple-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{sim.asociado}</p>
                            <p className="text-xs text-slate-500">{sim.cedula}</p>
                          </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-end text-right">
                          <p className="font-bold text-purple-700 text-sm">{formatCurrency(sim.monto)}</p>
                          <p className="text-xs text-slate-500">{sim.plazo} meses · {sim.tasaInteres}% EA</p>
                        </div>
                        <div className="hidden md:block text-right">
                          <p className="font-semibold text-slate-700 text-sm">{formatCurrency(sim.cuotaMensual)}</p>
                          <p className="text-xs text-slate-400">cuota mensual</p>
                        </div>
                        <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200 text-xs shrink-0">
                          Pendiente confirmación
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Crear / Editar crédito ───────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) {
          setSelectedItem(null);
          setAutocompleteSearch('');
          setFormArchivoFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-blue-600" />
              {selectedItem ? 'Editar crédito' : 'Registrar nuevo crédito'}
            </DialogTitle>
            <DialogDescription>
              {selectedItem
                ? `Modifica la información del crédito de "${selectedItem.asociado}"`
                : 'Completa todos los campos para formalizar el crédito'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">

            {/* ── Sección: Asociado ── */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">1. Asociado</p>
              <div className="relative" ref={!selectedItem ? autocompleteRef : undefined}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10" />
                <Input
                  className="pl-10 pr-8"
                  placeholder="Buscar asociado por nombre o cédula..."
                  value={autocompleteSearch}
                  disabled={!!selectedItem}
                  autoComplete="off"
                  onChange={(e) => { setAutocompleteSearch(e.target.value); setFormAsociadoId(''); setShowAutocomplete(true); }}
                  onFocus={() => { if (!selectedItem) setShowAutocomplete(true); }}
                />
                {formAsociadoId && <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />}
                {showAutocomplete && !selectedItem && acSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                    {acSuggestions.map(a => (
                      <button key={a.id} type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50 flex items-center justify-between group transition-colors"
                        onMouseDown={() => handleSelectAsociado(a)}>
                        <span className="font-medium text-slate-800 text-sm group-hover:text-blue-700">{a.nombre}</span>
                        <span className="text-xs text-slate-400">{a.cedula}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showAutocomplete && !selectedItem && autocompleteSearch.length > 0 && acSuggestions.length === 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-3 text-sm text-slate-500 text-center">
                    Sin resultados para "{autocompleteSearch}"
                  </div>
                )}
              </div>
              {!formAsociadoId && autocompleteSearch.length > 0 && (
                <p className="text-xs text-amber-600">Selecciona un asociado de la lista</p>
              )}
            </div>

            {/* ── Sección: Condiciones financieras ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">2. Condiciones financieras</p>
              {/* Tipo de crédito */}
              <div className="space-y-1.5">
                <Label htmlFor="tipo-credito" className="flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-indigo-500" /> Tipo de crédito <span className="text-red-500">*</span>
                </Label>
                <Select value={formTipo} onValueChange={setFormTipo}>
                  <SelectTrigger id="tipo-credito">
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_CREDITO.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="monto" className="flex items-center gap-1.5">
                    <DollarSign className="size-3.5 text-blue-500" /> Monto <span className="text-red-500">*</span>
                  </Label>
                  <Input id="monto" type="text" placeholder="5.000.000"
                    value={formMonto}
                    onChange={(e) => setFormMonto(e.target.value.replace(/[^\d.]/g, ''))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tasa" className="flex items-center gap-1.5">
                    <Percent className="size-3.5 text-orange-500" /> Tasa anual (%)
                  </Label>
                  <Input id="tasa" type="number" step="0.01" min="0" max="100"
                    placeholder="12.5"
                    value={formTasa}
                    onChange={(e) => setFormTasa(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="plazo" className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-indigo-500" /> Plazo (meses) <span className="text-red-500">*</span>
                  </Label>
                  <Input id="plazo" type="number" min="1" max="360" placeholder="36"
                    value={formPlazo}
                    onChange={(e) => setFormPlazo(e.target.value)}
                  />
                </div>
              </div>

              {/* Cuota calculada */}
              {cuotaPreview > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <DollarSign className="size-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-xs text-blue-600">Cuota mensual estimada</p>
                    <p className="text-lg font-bold text-blue-800">{formatCurrency(cuotaPreview)}</p>
                  </div>
                  <div className="ml-auto text-right text-xs text-blue-500">
                    <p>Amortización francesa</p>
                    <p>{formTasa ? `${formTasa}% EA` : 'Sin interés'}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fecha" className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-slate-500" /> Fecha de desembolso <span className="text-red-500">*</span>
                  </Label>
                  <Input id="fecha" type="date" value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-emerald-500" /> Estado de aprobación <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formEstadoAprobacion}
                    onValueChange={(v) => {
                      setFormEstadoAprobacion(v);
                      // Pre-rellenar fecha efectiva con hoy si aún está vacía
                      if (!formFechaEstado) {
                        setFormFechaEstado(new Date().toISOString().split('T')[0]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_APROBACION
                        .filter(e => selectedItem
                          // Edición: mostrar todos los estados
                          ? true
                          // Creación: ocultar estados que no aplican al momento de registrar
                          : !['desembolsado', 'rechazado', 'pagado', 'en_mora', 'aprobado', 'simulacion'].includes(e.value)
                        )
                        .map(e => (
                          <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ── Campos de cambio de estado (solo en edición o cuando el estado lo requiere) ── */}
              {(selectedItem || ['en_mora', 'pagado', 'rechazado', 'desembolsado'].includes(formEstadoAprobacion)) && (
                <div className={`grid gap-3 p-3 rounded-xl border ${
                  selectedItem && formEstadoAprobacion !== formEstadoOriginal
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  {selectedItem && formEstadoAprobacion !== formEstadoOriginal && (
                    <div className="flex items-center gap-2 text-xs text-amber-700 font-medium mb-0.5">
                      <AlertTriangle className="size-3.5" />
                      Estás cambiando el estado de <strong>{ESTADOS_APROBACION.find(e => e.value === formEstadoOriginal)?.label ?? formEstadoOriginal}</strong> a <strong>{ESTADOS_APROBACION.find(e => e.value === formEstadoAprobacion)?.label ?? formEstadoAprobacion}</strong>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="fecha-estado" className="flex items-center gap-1.5 text-xs">
                        <Calendar className="size-3.5 text-slate-500" />
                        Fecha efectiva del cambio
                        {selectedItem && formEstadoAprobacion !== formEstadoOriginal && (
                          <span className="text-red-500">*</span>
                        )}
                      </Label>
                      <Input
                        id="fecha-estado"
                        type="date"
                        value={formFechaEstado}
                        onChange={(e) => setFormFechaEstado(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="motivo-estado" className="flex items-center gap-1.5 text-xs">
                        <FileText className="size-3.5 text-slate-500" />
                        Motivo del cambio
                        <span className="text-slate-400 font-normal">(opcional)</span>
                      </Label>
                      <Input
                        id="motivo-estado"
                        placeholder="Ej: Aprobado en comité, cuota vencida..."
                        value={formMotivoEstado}
                        onChange={(e) => setFormMotivoEstado(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Sección: Documentación de soporte ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">3. Documentación de soporte</p>

              {/* Descripción textual */}
              <div className="space-y-1.5">
                <Label htmlFor="desc-soporte" className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-slate-500" />
                  Descripción de documentos entregados
                  <span className="text-xs text-slate-400 font-normal">(opcional)</span>
                </Label>
                <Textarea
                  id="desc-soporte"
                  placeholder="Ej: Cédula de ciudadanía, desprendibles de nómina últimos 3 meses, carta laboral, extractos bancarios..."
                  className="resize-none text-sm"
                  rows={3}
                  value={formDescSoporte}
                  onChange={(e) => setFormDescSoporte(e.target.value)}
                />
              </div>

              {/* Zona de carga de archivo */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Paperclip className="size-3.5 text-slate-500" />
                  Archivo adjunto
                  <span className="text-xs text-slate-400 font-normal">
                    (opcional · PDF, JPG, PNG, Word · máx 10 MB)
                  </span>
                </Label>

                {/* Input oculto — se abre al hacer clic o desde el celular */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />

                {/* ¿Ya hay archivo nuevo seleccionado? */}
                {formArchivoFile ? (
                  <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                      <FileText className="size-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{formArchivoFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(formArchivoFile.size / 1024).toFixed(0)} KB · Se subirá al guardar
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        title="Cambiar archivo"
                        className="p-1.5 rounded-md hover:bg-emerald-100 text-slate-500 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Quitar archivo"
                        className="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition-colors"
                        onClick={() => {
                          setFormArchivoFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>

                ) : formUrlDocumento ? (
                  /* ¿Hay un archivo ya guardado en BD (edición)? */
                  <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                      <FileText className="size-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {decodeURIComponent(formUrlDocumento.split('/').pop() ?? 'Documento adjunto')}
                      </p>
                      <p className="text-xs text-slate-500">Archivo guardado anteriormente</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <a
                        href={formUrlDocumento}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver documento"
                        className="p-1.5 rounded-md hover:bg-blue-100 text-blue-600 transition-colors"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                      <button
                        type="button"
                        title="Reemplazar con otro archivo"
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Quitar archivo"
                        className="p-1.5 rounded-md hover:bg-red-100 text-red-500 transition-colors"
                        onClick={() => {
                          setFormUrlDocumento('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>

                ) : (
                  /* Zona drag-and-drop vacía */
                  <div
                    role="button"
                    tabIndex={0}
                    className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer select-none transition-all
                      ${dragOver
                        ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                    onDragOver={(e)  => { e.preventDefault(); setDragOver(true);  }}
                    onDragLeave={()  => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                  >
                    <div className="flex flex-col items-center gap-2.5 pointer-events-none">
                      <div className={`p-3 rounded-full transition-colors ${dragOver ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <Upload className={`size-5 transition-colors ${dragOver ? 'text-blue-500' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          Arrastra el archivo aquí o{' '}
                          <span className="text-blue-600 underline underline-offset-2">haz clic para seleccionar</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          También puedes subir desde tu celular · PDF, JPG, PNG, Word · Máx 10 MB
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); setSelectedItem(null); }}>
              Cancelar
            </Button>
            {/* Solo mostrar "Ver simulación" cuando es un crédito nuevo */}
            {!selectedItem && (
              <Button
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-50 gap-2"
                onClick={handleAbrirSimulacion}
                disabled={saving}
              >
                <BarChart2 className="size-4" />
                Ver simulación primero
              </Button>
            )}
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSaveCredito} disabled={saving}>
              {saving ? 'Guardando...' : selectedItem ? 'Actualizar crédito' : 'Registrar directamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Modal Simulación / Tabla Amortización ─────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isSimulacionOpen} onOpenChange={setIsSimulacionOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <BarChart2 className="size-5" />
              Simulación de Crédito — Método Francés
            </DialogTitle>
            <DialogDescription>
              Tabla de amortización con cuota fija. Revisa el plan de pagos antes de enviarlo al asociado.
            </DialogDescription>
          </DialogHeader>

          {tablaSimulacion.length > 0 && (() => {
            const monto   = parseMonto(formMonto);
            const tasa    = parseFloat(formTasa) || 0;
            const plazo   = parseInt(formPlazo)  || 0;
            const cuota   = calcularCuota(monto, tasa, plazo);
            const totalPagado  = cuota * plazo;
            const totalInteres = totalPagado - monto;
            const asociado     = asociadosDisponibles.find(a => a.id === formAsociadoId);
            const fmt          = (n: number) => formatCurrency(n);

            return (
              <div className="space-y-5">
                {/* Resumen */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Monto solicitado', val: fmt(monto), color: 'bg-blue-50 border-blue-200 text-blue-700' },
                    { label: 'Cuota mensual',    val: fmt(cuota), color: 'bg-purple-50 border-purple-200 text-purple-700' },
                    { label: 'Total intereses',  val: fmt(totalInteres), color: 'bg-amber-50 border-amber-200 text-amber-700' },
                    { label: 'Total a pagar',    val: fmt(totalPagado),  color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                  ].map(c => (
                    <div key={c.label} className={`p-3 rounded-xl border ${c.color}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{c.label}</p>
                      <p className="text-base font-black mt-1">{c.val}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-2.5">
                  <span><strong>Asociado:</strong> {asociado?.nombre ?? '—'}</span>
                  <span>·</span>
                  <span><strong>Tasa EA:</strong> {tasa}%</span>
                  <span>·</span>
                  <span><strong>Plazo:</strong> {plazo} meses</span>
                  <span>·</span>
                  <span><strong>Tipo:</strong> {TIPOS_CREDITO.find(t => t.value === formTipo)?.label ?? formTipo}</span>
                </div>

                {/* Tabla */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-800 text-white sticky top-0">
                        <tr>
                          {['#', 'Fecha de pago', 'Cuota', 'Interés', 'Capital', 'Saldo'].map(h => (
                            <th key={h} className="px-3 py-2.5 text-left font-semibold tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tablaSimulacion.map((fila, idx) => (
                          <tr key={fila.numero} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-3 py-2 font-bold text-slate-500">{fila.numero}</td>
                            <td className="px-3 py-2 text-slate-700">{fila.fecha}</td>
                            <td className="px-3 py-2 font-semibold text-purple-700">{fmt(fila.cuota)}</td>
                            <td className="px-3 py-2 text-amber-600">{fmt(fila.interes)}</td>
                            <td className="px-3 py-2 text-blue-600">{fmt(fila.capital)}</td>
                            <td className="px-3 py-2 font-bold text-slate-800">{fmt(fila.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold text-slate-700 sticky bottom-0">
                        <tr>
                          <td className="px-3 py-2.5" colSpan={2}>TOTALES</td>
                          <td className="px-3 py-2.5 text-purple-700">{fmt(totalPagado)}</td>
                          <td className="px-3 py-2.5 text-amber-600">{fmt(totalInteres)}</td>
                          <td className="px-3 py-2.5 text-blue-600">{fmt(monto)}</td>
                          <td className="px-3 py-2.5 text-emerald-600">$ 0</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Nota informativa */}
                <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ Esta simulación <strong>no registra el crédito</strong>. Al enviarla al asociado, quedará en estado <strong>"Simulación"</strong> hasta que él confirme o rechace. Solo entonces se registrará oficialmente.
                </p>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 pt-2 flex-wrap">
            <Button variant="outline" onClick={() => setIsSimulacionOpen(false)}>
              Volver al formulario
            </Button>
            {tablaSimulacion.length > 0 && (
              <Button
                variant="outline"
                className="border-slate-400 text-slate-700 hover:bg-slate-50 gap-2"
                onClick={() => descargarPDFAmortizacion(tablaSimulacion, {
                  monto:          parseMonto(formMonto),
                  tasa:           parseFloat(formTasa) || 0,
                  plazo:          parseInt(formPlazo)  || 0,
                  nombreAsociado: asociadosDisponibles.find(a => a.id === formAsociadoId)?.nombre,
                })}
              >
                <Download className="size-4" /> Descargar PDF
              </Button>
            )}
            <Button
              className="bg-purple-600 hover:bg-purple-700 gap-2"
              onClick={handleEnviarSimulacion}
              disabled={enviandoSimulacion}
            >
              {enviandoSimulacion ? (
                <><div className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enviando...</>
              ) : (
                <><Receipt className="size-4" /> Enviar al asociado para confirmar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal tabla completa de amortización (asociado) ─── */}
      <Dialog open={isSimDetalleOpen} onOpenChange={setIsSimDetalleOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
          {simDetalleData && (() => {
            const { sim, tabla } = simDetalleData;
            const totalPagado   = sim.cuotaMensual * sim.plazo;
            const totalInteres  = totalPagado - sim.monto;
            const tipoLabel     = TIPOS_CREDITO.find(t => t.value === sim.tipo)?.label ?? sim.tipo;
            return (
              <>
                {/* Header visual */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white/20 rounded-xl">
                        <BarChart2 className="size-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-white font-black text-lg leading-tight">Tabla de Amortización Francesa</h2>
                        <p className="text-purple-200 text-sm">{tipoLabel} · {sim.plazo} meses · {sim.tasaInteres}% EA</p>
                      </div>
                    </div>
                    <button onClick={() => setIsSimDetalleOpen(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                      <X className="size-5 text-white" />
                    </button>
                  </div>

                  {/* KPIs en el header */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {[
                      { l: 'Monto',          v: formatCurrency(sim.monto) },
                      { l: 'Cuota mensual',  v: formatCurrency(sim.cuotaMensual) },
                      { l: 'Total intereses',v: formatCurrency(totalInteres) },
                      { l: 'Total a pagar',  v: formatCurrency(totalPagado) },
                    ].map(d => (
                      <div key={d.l} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
                        <p className="text-purple-200 text-[10px] uppercase tracking-wide font-medium">{d.l}</p>
                        <p className="text-white font-black text-sm mt-0.5">{d.v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tabla completa */}
                <div className="px-6 py-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Table2 className="size-3.5" />
                    Plan de pagos completo — {tabla.length} cuotas
                  </p>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto" style={{ maxHeight: '45vh' }}>
                      <table className="w-full text-sm">
                        <thead className="bg-slate-800 text-white sticky top-0 z-10">
                          <tr>
                            {['N°', 'Fecha de pago', 'Cuota total', 'Interés', 'Capital', 'Saldo restante'].map(h => (
                              <th key={h} className="px-4 py-3 text-left font-semibold text-xs tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tabla.map((fila, idx) => (
                            <tr key={fila.numero}
                              className={`transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-purple-50/40' : 'bg-slate-50 hover:bg-purple-50/40'}`}>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-black">
                                  {fila.numero}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">{fila.fecha}</td>
                              <td className="px-4 py-3 font-black text-purple-700 whitespace-nowrap">{formatCurrency(fila.cuota)}</td>
                              <td className="px-4 py-3 text-amber-600 font-medium whitespace-nowrap">{formatCurrency(fila.interes)}</td>
                              <td className="px-4 py-3 text-blue-600 font-medium whitespace-nowrap">{formatCurrency(fila.capital)}</td>
                              <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                                {fila.saldo === 0
                                  ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Pagado</span>
                                  : formatCurrency(fila.saldo)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-800 text-white sticky bottom-0">
                          <tr>
                            <td className="px-4 py-3 font-bold text-xs" colSpan={2}>TOTALES</td>
                            <td className="px-4 py-3 font-black text-purple-300 whitespace-nowrap">{formatCurrency(totalPagado)}</td>
                            <td className="px-4 py-3 font-bold text-amber-300 whitespace-nowrap">{formatCurrency(totalInteres)}</td>
                            <td className="px-4 py-3 font-bold text-blue-300 whitespace-nowrap">{formatCurrency(sim.monto)}</td>
                            <td className="px-4 py-3 font-bold text-emerald-300">$ 0</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Footer con acciones */}
                <div className="flex flex-col sm:flex-row gap-3 px-6 pb-6 pt-2 border-t border-slate-100">
                  <Button
                    variant="outline"
                    className="border-slate-400 text-slate-700 hover:bg-slate-50 gap-2"
                    onClick={() => descargarPDFAmortizacion(tabla, {
                      monto:          sim.monto,
                      tasa:           sim.tasaInteres,
                      plazo:          sim.plazo,
                      nombreAsociado: sim.asociado,
                      tipo:           tipoLabel,
                    })}
                  >
                    <Download className="size-4" /> Descargar PDF
                  </Button>
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2 py-5"
                    onClick={() => {
                      setSimSeleccionada(sim);
                      setIsSimDetalleOpen(false);
                      setIsConfirmSimOpen(true);
                    }}
                  >
                    <Check className="size-5" />
                    <span className="font-bold">Confirmar y aceptar crédito</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2 py-5"
                    onClick={() => {
                      setSimSeleccionada(sim);
                      setIsSimDetalleOpen(false);
                      setIsRechazarSimOpen(true);
                    }}
                  >
                    <X className="size-5" />
                    <span className="font-bold">Rechazar simulación</span>
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Confirmar simulación (asociado) ─── */}
      <AlertDialog open={isConfirmSimOpen} onOpenChange={setIsConfirmSimOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar y activar este crédito?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>
                  El crédito por <strong className="text-slate-800">{simSeleccionada ? formatCurrency(simSeleccionada.monto) : ''}</strong> a{' '}
                  <strong className="text-slate-800">{simSeleccionada?.plazo} meses</strong> quedará registrado como{' '}
                  <strong className="text-emerald-600">Activo</strong> de inmediato en Gestión de Créditos.
                </p>
                <p className="text-xs text-slate-400">
                  Esta acción no se puede deshacer. El administrador recibirá una notificación.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleConfirmarSimulacion}
              disabled={confirmandoSim}
            >
              {confirmandoSim ? 'Activando crédito...' : '🎉 Sí, activar crédito'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Rechazar simulación (asociado) ─── */}
      <AlertDialog open={isRechazarSimOpen} onOpenChange={setIsRechazarSimOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar esta simulación?</AlertDialogTitle>
            <AlertDialogDescription>
              Al rechazar, la simulación de crédito por <strong>{simSeleccionada ? formatCurrency(simSeleccionada.monto) : ''}</strong> se eliminará permanentemente y no quedará ningún registro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRechazarSimulacion}
              disabled={rechazandoSim}
            >
              {rechazandoSim ? 'Rechazando...' : '❌ Sí, rechazar y eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Detalle ─────────────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isDetailDialogOpen} onOpenChange={async (open) => {
        setIsDetailDialogOpen(open);
        if (!open) {
          setSelectedItem(null);
          setHistorialDetalle([]);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-blue-600" /> Detalle del crédito
            </DialogTitle>
          </DialogHeader>

          {selectedItem && (() => {
            // ── Cálculos base ─────────────────────────────────────────────
            const monto        = selectedItem.monto        ?? 0;
            const saldo        = selectedItem.saldo        ?? monto;
            const cuota        = selectedItem.cuotaMensual ?? 0;
            const tasaAnual    = selectedItem.tasaInteres  ?? 0;
            const plazo        = selectedItem.plazo        ?? 0;
            const tasaMensual  = tasaAnual > 0 ? tasaAnual / 100 / 12 : 0;

            // Cuotas pagadas: usar historial real si existe, sino estimación
            const cuotasPagadasReal = historialDetalle.length;
            const cuotasPagadas     = cuotasPagadasReal > 0
              ? cuotasPagadasReal
              : (cuota > 0 ? Math.max(0, Math.round((monto - saldo) / cuota)) : 0);
            const cuotasPendientes  = Math.max(0, plazo - cuotasPagadas);

            // Capital e intereses del historial real
            const capitalPagado    = historialDetalle.reduce((s: number, p: any) => s + (p.capital ?? 0), 0);
            const interesesPagados = historialDetalle.reduce((s: number, p: any) => s + (p.interes ?? 0), 0);

            // Intereses pendientes estimados (suma de la amortización futura)
            let interesesPendientes = 0;
            let saldoTemp = saldo;
            for (let i = 0; i < cuotasPendientes; i++) {
              const intCuota = Math.round(saldoTemp * tasaMensual);
              const capCuota = Math.round(cuota - intCuota);
              interesesPendientes += intCuota;
              saldoTemp = Math.max(0, saldoTemp - capCuota);
            }

            // Fechas — fechaBase es null si el crédito aún no fue desembolsado.
            // fechaBaseAmort usa hoy como referencia solo para proyectar la tabla de cuotas.
            const fechaBase = selectedItem.fechaDesembolso
              ? new Date(selectedItem.fechaDesembolso + 'T00:00:00')
              : null;
            const fechaBaseAmort = fechaBase ?? new Date(); // solo para la tabla de amortización proyectada
            const fechaVencimiento = fechaBase && plazo > 0
              ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + plazo, fechaBase.getDate())
              : null;
            const fechaVencProxima = fechaBase && cuotasPagadas < plazo
              ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + cuotasPagadas + 1, fechaBase.getDate())
              : null;

            // Días de mora
            const hoyMs    = new Date(); hoyMs.setHours(0,0,0,0);
            const diasMora = (selectedItem.estadoAprobacion === 'en_mora' && fechaVencProxima && fechaVencProxima < hoyMs)
              ? Math.floor((hoyMs.getTime() - fechaVencProxima.getTime()) / 86400000)
              : 0;

            // Número de crédito corto
            const numCredito = `CRE-${String(selectedItem.id ?? '').substring(0, 8).toUpperCase()}`;

            // Generar tabla de amortización completa
            const amortizacion: {
              num: number; fecha: string; cuota: number;
              capital: number; interes: number; saldoFinal: number; pagada: boolean;
            }[] = [];
            let saldoAcum = monto;
            for (let i = 1; i <= plazo; i++) {
              const interesCuota = Math.round(saldoAcum * tasaMensual);
              const capitalCuota = Math.round(cuota - interesCuota);
              saldoAcum          = Math.max(0, saldoAcum - capitalCuota);
              const fechaCuota   = new Date(fechaBaseAmort.getFullYear(), fechaBaseAmort.getMonth() + i, fechaBaseAmort.getDate());
              amortizacion.push({
                num:        i,
                fecha:      fechaCuota.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
                cuota,
                capital:    capitalCuota,
                interes:    interesCuota,
                saldoFinal: saldoAcum,
                pagada:     i <= cuotasPagadas,
              });
            }

            return (
              <div className="space-y-4 py-1">

                {/* ══════════════════════════════════════════════════════════ */}
                {/* ── Perfil completo del crédito ─────────────────────────── */}
                {/* ══════════════════════════════════════════════════════════ */}

                {/* Encabezado: número + tipo + asociado + estado */}
                <div className="rounded-xl border border-blue-100 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <CreditCard className="size-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-blue-100 font-medium">N° de crédito</p>
                        <p className="text-lg font-bold text-white tracking-wider">{numCredito}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-blue-100 mb-1">
                        {TIPOS_CREDITO.find(t => t.value === selectedItem.tipo)?.label ?? 'Crédito de consumo'}
                      </p>
                      {selectedItem.anulado
                        ? <Badge className="bg-red-500 text-white border-0">Anulado</Badge>
                        : getEstadoBadge(selectedItem.estadoAprobacion)}
                    </div>
                  </div>

                  {/* Datos del asociado + info del crédito */}
                  <div className="bg-blue-50 px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="col-span-2 flex items-center gap-2 pb-2 border-b border-blue-100 mb-0.5">
                      <div className="p-1.5 bg-blue-100 rounded-full">
                        <Users className="size-3.5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{selectedItem.asociado}</p>
                        <p className="text-slate-500">C.C. {selectedItem.cedula}</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Monto aprobado</span>
                      <p className="font-bold text-slate-800">{formatCurrency(monto)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Monto desembolsado</span>
                      <p className="font-bold text-slate-800">{formatCurrency(monto)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Tasa de interés</span>
                      <p className="font-bold text-orange-700">
                        {tasaAnual > 0 ? `${tasaAnual}% EA (${(tasaAnual/12).toFixed(4)}% m.)` : 'Sin interés'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Plazo total</span>
                      <p className="font-bold text-slate-800">{plazo} meses</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Fecha de inicio</span>
                      <p className="font-bold text-slate-800">
                        {selectedItem.fechaDesembolso
                          ? new Date(selectedItem.fechaDesembolso + 'T00:00:00')
                              .toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Fecha de vencimiento</span>
                      <p className="font-bold text-slate-800">
                        {fechaVencimiento
                          ? fechaVencimiento.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ══════════════════════════════════════════════════════════ */}
                {/* ── Resumen financiero en tiempo real ───────────────────── */}
                {/* ══════════════════════════════════════════════════════════ */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="bg-slate-700 px-4 py-2.5 flex items-center gap-2">
                    <BarChart2 className="size-4 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                      Resumen financiero — actualizado en tiempo real
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-px bg-slate-200">
                    {/* Saldo pendiente */}
                    <div className={`bg-white p-3 ${diasMora > 0 ? 'bg-red-50' : ''}`}>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Saldo pendiente</p>
                      <p className={`text-base font-bold mt-0.5 ${saldo <= 0 ? 'text-emerald-600' : diasMora > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {saldo <= 0 ? '✓ Pagado' : formatCurrency(saldo)}
                      </p>
                    </div>
                    {/* Capital pagado */}
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Capital pagado</p>
                      <p className="text-base font-bold text-blue-700 mt-0.5">{formatCurrency(capitalPagado)}</p>
                    </div>
                    {/* Intereses pagados */}
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Intereses pagados</p>
                      <p className="text-base font-bold text-orange-600 mt-0.5">{formatCurrency(interesesPagados)}</p>
                    </div>
                    {/* Intereses pendientes */}
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Intereses pendientes</p>
                      <p className="text-sm font-semibold text-amber-600 mt-0.5">
                        {cuotasPendientes > 0 ? `≈ ${formatCurrency(interesesPendientes)}` : '—'}
                      </p>
                    </div>
                    {/* Cuotas pagadas */}
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Cuotas pagadas</p>
                      <p className="text-base font-bold text-emerald-700 mt-0.5">
                        {cuotasPagadas} <span className="text-xs font-normal text-slate-400">de {plazo}</span>
                      </p>
                    </div>
                    {/* Cuotas pendientes */}
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Cuotas pendientes</p>
                      <p className={`text-base font-bold mt-0.5 ${cuotasPendientes > 0 ? 'text-slate-700' : 'text-emerald-600'}`}>
                        {cuotasPendientes > 0 ? cuotasPendientes : '—'}
                      </p>
                    </div>
                    {/* Valor de la cuota */}
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Valor de cuota</p>
                      <p className="text-base font-bold text-indigo-700 mt-0.5">{formatCurrency(cuota)}</p>
                    </div>
                    {/* Próxima fecha de pago */}
                    <div className="bg-white p-3">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Próxima fecha de pago</p>
                      <p className={`text-sm font-semibold mt-0.5 ${diasMora > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                        {fechaVencProxima
                          ? fechaVencProxima.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                          : <span className="text-emerald-600">Pagado ✓</span>}
                      </p>
                    </div>
                    {/* Días en mora */}
                    <div className={`p-3 ${diasMora > 0 ? 'bg-red-50' : 'bg-white'}`}>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">Días en mora</p>
                      {diasMora > 0 ? (
                        <p className="text-base font-bold text-red-600 mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="size-3.5" /> {diasMora} días
                        </p>
                      ) : (
                        <p className="text-sm font-semibold text-emerald-600 mt-0.5">Al día ✓</p>
                      )}
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="bg-white px-4 py-3 border-t border-slate-100">
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span className="font-medium">Progreso del crédito</span>
                      <span>
                        {plazo > 0 ? `${((cuotasPagadas / plazo) * 100).toFixed(0)}% completado` : '—'}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${diasMora > 0 ? 'bg-red-400' : 'bg-emerald-500'}`}
                        style={{ width: plazo > 0 ? `${(cuotasPagadas / plazo) * 100}%` : '0%' }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                      <span>{selectedItem.fechaDesembolso ?? '—'}</span>
                      <span>{fechaVencimiento?.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) ?? '—'}</span>
                    </div>
                  </div>
                </div>

                {/* ── Tabs: Amortización / Historial de pagos / Documentos / Auditoría ── */}
                <Tabs defaultValue="amortizacion">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="amortizacion" className="text-xs gap-1">
                      <Clock className="size-3" /> Cuotas
                    </TabsTrigger>
                    <TabsTrigger value="pagos" className="text-xs gap-1">
                      <History className="size-3" />
                      Pagos{historialDetalle.length > 0 && ` (${historialDetalle.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="documentos" className="text-xs gap-1">
                      <FileText className="size-3" /> Soporte
                    </TabsTrigger>
                    <TabsTrigger value="auditoria" className="text-xs gap-1">
                      <Edit className="size-3" /> Auditoría
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Tab 1: Tabla de amortización (cuotas proyectadas) ── */}
                  <TabsContent value="amortizacion" className="mt-3">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                            <tr>
                              <th className="text-center px-2 py-2 font-semibold text-slate-500">#</th>
                              <th className="text-left   px-2 py-2 font-semibold text-slate-500">Vencimiento</th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">Cuota</th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">Capital</th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">
                                Interés <span className="text-orange-400 font-normal">({tasaAnual > 0 ? `${(tasaAnual/12).toFixed(2)}%/m` : '0%'})</span>
                              </th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">Saldo</th>
                              <th className="text-center px-2 py-2 font-semibold text-slate-500">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {amortizacion.map(row => {
                              // Si hay pago real para esta cuota, usarlo
                              const pagoReal = historialDetalle.find((p: any) => p.num_cuota === row.num);
                              const isPagada = pagoReal != null || row.pagada;
                              return (
                                <tr key={row.num}
                                  className={`border-b border-slate-100 last:border-0 ${isPagada ? 'bg-emerald-50/40' : ''}`}>
                                  <td className="px-2 py-1.5 text-center font-medium text-slate-500">{row.num}</td>
                                  <td className="px-2 py-1.5 text-slate-600">{row.fecha}</td>
                                  <td className="px-2 py-1.5 text-right font-medium text-slate-700">
                                    {pagoReal ? formatCurrency(pagoReal.monto_pagado) : formatCurrency(row.cuota)}
                                  </td>
                                  <td className="px-2 py-1.5 text-right text-slate-600">
                                    {pagoReal ? formatCurrency(pagoReal.capital) : formatCurrency(row.capital)}
                                  </td>
                                  <td className="px-2 py-1.5 text-right text-orange-600">
                                    {pagoReal ? formatCurrency(pagoReal.interes) : formatCurrency(row.interes)}
                                  </td>
                                  <td className="px-2 py-1.5 text-right font-medium text-indigo-600">
                                    {pagoReal ? formatCurrency(pagoReal.saldo_despues) : formatCurrency(row.saldoFinal)}
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    {isPagada
                                      ? <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                          <Check className="size-2.5" /> Pagada
                                        </span>
                                      : <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">
                                          <Clock className="size-2.5" /> Pendiente
                                        </span>
                                    }
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                      {selectedItem.fechaDesembolso
                        ? 'Los montos reales provienen de los pagos registrados · Proyección: amortización francesa'
                        : 'Proyección calculada desde la fecha de hoy (sin fecha de desembolso registrada) · Amortización francesa'}
                    </p>
                  </TabsContent>

                  {/* ── Tab 2: Historial completo de transacciones ── */}
                  <TabsContent value="pagos" className="mt-3">
                    {loadingHistorialDetalle ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
                      </div>
                    ) : historialDetalle.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                        <Banknote className="size-8" />
                        <p className="text-sm font-medium">Sin pagos registrados</p>
                        <p className="text-xs text-center">
                          {selectedItem.estadoAprobacion === 'desembolsado' || selectedItem.estadoAprobacion === 'en_mora'
                            ? 'El crédito está desembolsado pero aún no tiene cuotas pagadas'
                            : 'Los pagos aparecerán aquí una vez que el crédito esté activo'}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Encabezado con botones de exportación */}
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-slate-600">
                            {historialDetalle.length} transacción{historialDetalle.length !== 1 ? 'es' : ''} registradas
                          </p>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm" variant="outline"
                              className="gap-1.5 text-xs h-7 border-blue-200 text-blue-700 hover:bg-blue-50"
                              onClick={() => {
                                const ok = generateHistorialCreditoPDF(selectedItem, historialDetalle);
                                if (ok) toast.success('Historial PDF descargado');
                                else toast.error('Error al generar PDF');
                              }}
                            >
                              <Download className="size-3" /> PDF
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              className="gap-1.5 text-xs h-7 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => {
                                exportarHistorialCSV(historialDetalle, selectedItem);
                                toast.success('Historial CSV descargado');
                              }}
                            >
                              <Table2 className="size-3" /> CSV
                            </Button>
                          </div>
                        </div>

                        {/* Resumen del historial */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 text-center">
                            <p className="text-[10px] text-slate-500 uppercase">Total pagado</p>
                            <p className="text-sm font-bold text-emerald-700">{formatCurrency(historialDetalle.reduce((s: number, p: any) => s + (p.monto_pagado ?? 0), 0))}</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-center">
                            <p className="text-[10px] text-slate-500 uppercase">Capital pagado</p>
                            <p className="text-sm font-bold text-blue-700">{formatCurrency(capitalPagado)}</p>
                          </div>
                          <div className="bg-orange-50 border border-orange-100 rounded-lg p-2.5 text-center">
                            <p className="text-[10px] text-slate-500 uppercase">Intereses pagados</p>
                            <p className="text-sm font-bold text-orange-700">{formatCurrency(interesesPagados)}</p>
                          </div>
                        </div>

                        {/* Tabla de pagos reales con comprobante por fila */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                          <div className="max-h-56 overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                                <tr>
                                  <th className="text-center px-2 py-2 font-semibold text-slate-500">#</th>
                                  <th className="text-left   px-2 py-2 font-semibold text-slate-500">Fecha pago</th>
                                  <th className="text-right  px-2 py-2 font-semibold text-slate-500">Pagado</th>
                                  <th className="text-right  px-2 py-2 font-semibold text-slate-500">Capital</th>
                                  <th className="text-right  px-2 py-2 font-semibold text-slate-500">Interés</th>
                                  <th className="text-right  px-2 py-2 font-semibold text-slate-500">Saldo</th>
                                  <th className="text-center px-2 py-2 font-semibold text-slate-500">Método</th>
                                  <th className="text-center px-2 py-2 font-semibold text-slate-500">Comp.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...historialDetalle].reverse().map((p: any) => (
                                  <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 group">
                                    <td className="px-2 py-2 text-center font-medium text-slate-500">{p.num_cuota ?? '—'}</td>
                                    <td className="px-2 py-2 text-slate-700">
                                      {new Date(p.fecha_pago + 'T00:00:00').toLocaleDateString('es-CO', {
                                        day: '2-digit', month: 'short', year: 'numeric',
                                      })}
                                    </td>
                                    <td className="px-2 py-2 text-right font-bold text-emerald-700">{formatCurrency(p.monto_pagado)}</td>
                                    <td className="px-2 py-2 text-right text-blue-600">{formatCurrency(p.capital)}</td>
                                    <td className="px-2 py-2 text-right text-orange-600">{formatCurrency(p.interes)}</td>
                                    <td className="px-2 py-2 text-right font-medium text-indigo-700">{formatCurrency(p.saldo_despues)}</td>
                                    <td className="px-2 py-2 text-center text-slate-500 text-[10px] capitalize whitespace-nowrap">
                                      {p.metodo_pago ?? '—'}
                                    </td>
                                    <td className="px-2 py-2 text-center">
                                      <button
                                        title="Descargar comprobante"
                                        className="p-1 rounded hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors"
                                        onClick={() => {
                                          const ok = generateComprobantePagoPDF(p, selectedItem);
                                          if (ok) toast.success(`Comprobante cuota ${p.num_cuota} descargado`);
                                          else toast.error('Error al generar comprobante');
                                        }}
                                      >
                                        <Receipt className="size-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                          Haz clic en <Receipt className="size-2.5 inline" /> para descargar el comprobante individual de cada pago
                        </p>
                      </>
                    )}
                  </TabsContent>

                  {/* ── Tab 2: Documentación de soporte ── */}
                  <TabsContent value="documentos" className="mt-3 space-y-3">
                    {(selectedItem.descripcionSoporte || selectedItem.urlDocumento) ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl space-y-2.5">
                        {selectedItem.descripcionSoporte && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                              Documentos entregados
                            </p>
                            <p className="text-sm text-slate-700">{selectedItem.descripcionSoporte}</p>
                          </div>
                        )}
                        {selectedItem.urlDocumento && (
                          <a href={selectedItem.urlDocumento} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:underline font-medium">
                            <ExternalLink className="size-3.5" /> Ver / descargar documento adjunto
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                        <FileText className="size-8" />
                        <p className="text-sm">Sin documentos de soporte registrados</p>
                      </div>
                    )}
                    {selectedItem.motivoAnulacion && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-1">Motivo de anulación</p>
                        <p className="text-sm text-red-700">{selectedItem.motivoAnulacion}</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Tab 3: Auditoría de ediciones ── */}
                  <TabsContent value="auditoria" className="mt-3 space-y-3">
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          Registro de modificaciones
                        </p>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {/* Creación */}
                        <div className="flex items-start gap-3 px-3 py-3">
                          <div className="p-1.5 bg-emerald-100 rounded-full shrink-0 mt-0.5">
                            <Plus className="size-3 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-700">Crédito creado</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {selectedItem.createdAt
                                ? new Date(selectedItem.createdAt).toLocaleString('es-CO', {
                                    day: '2-digit', month: 'long', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })
                                : '—'}
                            </p>
                          </div>
                        </div>
                        {/* Última edición */}
                        {selectedItem.editadoPor ? (
                          <div className="flex items-start gap-3 px-3 py-3">
                            <div className="p-1.5 bg-blue-100 rounded-full shrink-0 mt-0.5">
                              <Edit className="size-3 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-700">Última edición</p>
                              <p className="text-xs text-slate-600 mt-0.5">
                                Por: <span className="font-semibold">{selectedItem.editadoPor}</span>
                              </p>
                              <p className="text-xs text-slate-500">
                                {selectedItem.editadoEn
                                  ? new Date(selectedItem.editadoEn).toLocaleString('es-CO', {
                                      day: '2-digit', month: 'long', year: 'numeric',
                                      hour: '2-digit', minute: '2-digit',
                                    })
                                  : '—'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="px-3 py-4 text-center text-xs text-slate-400">
                            Sin modificaciones registradas
                          </div>
                        )}
                        {/* Cambio de estado */}
                        {selectedItem.fechaEstadoCambio && (
                          <div className="flex items-start gap-3 px-3 py-3">
                            <div className={`p-1.5 rounded-full shrink-0 mt-0.5 ${
                              selectedItem.estadoAprobacion === 'en_mora'
                                ? 'bg-red-100'
                                : selectedItem.estadoAprobacion === 'pagado'
                                ? 'bg-emerald-100'
                                : 'bg-indigo-100'
                            }`}>
                              <Activity className={`size-3 ${
                                selectedItem.estadoAprobacion === 'en_mora'
                                  ? 'text-red-600'
                                  : selectedItem.estadoAprobacion === 'pagado'
                                  ? 'text-emerald-600'
                                  : 'text-indigo-600'
                              }`} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-700">
                                Cambio de estado → {ESTADOS_APROBACION.find(e => e.value === selectedItem.estadoAprobacion)?.label ?? selectedItem.estadoAprobacion}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Fecha efectiva:{' '}
                                {new Date(selectedItem.fechaEstadoCambio).toLocaleDateString('es-CO', {
                                  day: '2-digit', month: 'long', year: 'numeric',
                                })}
                              </p>
                              {selectedItem.motivoEstadoCambio && (
                                <p className="text-xs text-slate-600 mt-0.5">
                                  Motivo: <span className="font-medium">{selectedItem.motivoEstadoCambio}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Mora automática detectada */}
                        {selectedItem.estadoAprobacion === 'en_mora' && !selectedItem.fechaEstadoCambio && (
                          <div className="flex items-start gap-3 px-3 py-3 bg-red-50/50">
                            <div className="p-1.5 bg-red-100 rounded-full shrink-0 mt-0.5">
                              <AlertTriangle className="size-3 text-red-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-red-700">En mora (detectado automáticamente)</p>
                              <p className="text-xs text-red-500 mt-0.5">
                                El crédito tiene cuotas vencidas y saldo pendiente
                              </p>
                            </div>
                          </div>
                        )}
                        {/* Anulación */}
                        {selectedItem.anulado && (
                          <div className="flex items-start gap-3 px-3 py-3 bg-red-50/50">
                            <div className="p-1.5 bg-red-100 rounded-full shrink-0 mt-0.5">
                              <X className="size-3 text-red-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-red-700">Crédito anulado</p>
                              {selectedItem.motivoAnulacion && (
                                <p className="text-xs text-red-600 mt-0.5">Motivo: {selectedItem.motivoAnulacion}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Cerrar</Button>
            {selectedItem && !selectedItem.anulado && userRole === 'admin' && (
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
                setIsDetailDialogOpen(false);
                handleOpenCreate(selectedItem);
              }}>
                <Edit className="size-4 mr-1.5" /> Editar crédito
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Pagar cuota ─────────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isPagoDialogOpen} onOpenChange={(open) => {
        setIsPagoDialogOpen(open);
        if (!open) { setSelectedItem(null); setHistorialPagos([]); }
      }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="size-5 text-emerald-600" /> Pagar cuota del crédito
            </DialogTitle>
            <DialogDescription>
              {selectedItem && `${selectedItem.asociado} · Saldo pendiente: ${formatCurrency(selectedItem.saldo)}`}
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (() => {
            const saldo        = selectedItem.saldo ?? 0;
            const cuota        = selectedItem.cuotaMensual ?? 0;
            const tasaAnual    = selectedItem.tasaInteres  ?? 0;
            const tasaMensual  = tasaAnual > 0 ? tasaAnual / 100 / 12 : 0;
            const montoPago    = parseFloat(pagoMonto.replace(/[^\d.]/g, '')) || 0;
            const interesPrev  = Math.round(saldo * tasaMensual);
            const capitalPrev  = Math.max(0, Math.round(montoPago - interesPrev));
            const saldoNuevo   = Math.max(0, saldo - capitalPrev);
            const numCuotaNext = historialPagos.length + 1;

            // Fecha de vencimiento de la próxima cuota
            const fechaBase = selectedItem.fechaDesembolso
              ? new Date(selectedItem.fechaDesembolso + 'T00:00:00') : new Date();
            const fechaVenc = new Date(
              fechaBase.getFullYear(),
              fechaBase.getMonth() + numCuotaNext,
              fechaBase.getDate()
            );

            return (
              <div className="space-y-5 py-1">

                {/* ── Resumen del crédito ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-indigo-500 uppercase">Monto original</p>
                    <p className="text-sm font-bold text-indigo-700 mt-0.5">{formatCurrency(selectedItem.monto)}</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-orange-500 uppercase">Saldo pendiente</p>
                    <p className="text-sm font-bold text-orange-700 mt-0.5">{formatCurrency(saldo)}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-blue-500 uppercase">Cuota mensual</p>
                    <p className="text-sm font-bold text-blue-700 mt-0.5">{formatCurrency(cuota)}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">N° cuota a pagar</p>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">
                      {numCuotaNext} de {selectedItem.plazo}
                    </p>
                  </div>
                </div>

                {/* ── Fecha vencimiento cuota ── */}
                <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-xl text-sm">
                  <Calendar className="size-4 text-yellow-600 shrink-0" />
                  <span className="text-slate-600">
                    Vencimiento cuota {numCuotaNext}:{' '}
                    <span className="font-bold text-yellow-700">
                      {fechaVenc.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </span>
                </div>

                {/* ── Formulario de pago ── */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos del pago</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="pago-monto" className="flex items-center gap-1.5">
                        <DollarSign className="size-3.5 text-emerald-500" /> Monto a pagar <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="pago-monto"
                        type="text"
                        placeholder={formatCurrency(cuota)}
                        value={pagoMonto}
                        onChange={e => setPagoMonto(e.target.value.replace(/[^\d.]/g, ''))}
                        className={
                          pagoMonto && parseFloat(pagoMonto) < cuota && cuota > 0
                            ? 'border-red-400 focus-visible:ring-red-400'
                            : pagoMonto && parseFloat(pagoMonto) >= cuota && cuota > 0
                            ? 'border-emerald-400 focus-visible:ring-emerald-400'
                            : ''
                        }
                      />
                      {pagoMonto && parseFloat(pagoMonto) < cuota && cuota > 0 ? (
                        <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                          <AlertTriangle className="size-3 shrink-0" />
                          Mínimo a pagar: <strong>{formatCurrency(cuota)}</strong>
                        </p>
                      ) : pagoMonto && parseFloat(pagoMonto) > cuota && cuota > 0 ? (
                        <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="size-3 shrink-0" />
                          Excedente <strong>{formatCurrency(parseFloat(pagoMonto) - cuota)}</strong> se abonará al capital
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">Mínimo: <strong>{formatCurrency(cuota)}</strong> · puedes pagar más para reducir capital</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pago-fecha" className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-slate-500" /> Fecha del pago <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="pago-fecha"
                        type="date"
                        value={pagoFecha}
                        onChange={e => setPagoFecha(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <CreditCardIcon className="size-3.5 text-slate-500" /> Método de pago
                    </Label>
                    <Select value={pagoMetodo} onValueChange={(v) => { setPagoMetodo(v); setPagoComprobante(null); }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="efectivo">💵 Efectivo</SelectItem>
                        <SelectItem value="transferencia">🏦 Transferencia bancaria</SelectItem>

                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Comprobante — obligatorio si es transferencia */}
                  {pagoMetodo === 'transferencia' && (
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-sm font-medium">
                        <Upload className="size-3.5 text-blue-500" />
                        Comprobante de transferencia <span className="text-red-500">*</span>
                      </Label>
                      <div
                        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-colors ${
                          pagoComprobante
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                        }`}
                        onClick={() => document.getElementById('admin-comprobante-input')?.click()}
                      >
                        <input
                          id="admin-comprobante-input"
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={e => setPagoComprobante(e.target.files?.[0] ?? null)}
                        />
                        {pagoComprobante ? (
                          <>
                            <CheckCircle2 className="size-6 text-emerald-500" />
                            <p className="text-sm font-medium text-emerald-700 text-center break-all">{pagoComprobante.name}</p>
                            <p className="text-xs text-slate-500">{(pagoComprobante.size / 1024).toFixed(0)} KB · haz clic para cambiar</p>
                          </>
                        ) : (
                          <>
                            <Upload className="size-6 text-blue-400" />
                            <p className="text-sm font-medium text-blue-700">Haz clic para adjuntar el comprobante</p>
                            <p className="text-xs text-slate-500">JPG, PNG o PDF · máx. 5 MB</p>
                          </>
                        )}
                      </div>
                      {!pagoComprobante && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="size-3" /> Requerido para pagos por transferencia
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="pago-obs" className="flex items-center gap-1.5">
                      <FileText className="size-3.5 text-slate-500" /> Observación <span className="text-xs text-slate-400 font-normal">(opcional)</span>
                    </Label>
                    <Textarea
                      id="pago-obs"
                      placeholder="Ej: Pago parcial, referencia de transferencia, etc."
                      className="resize-none text-sm"
                      rows={2}
                      value={pagoObservacion}
                      onChange={e => setPagoObservacion(e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Preview del desglose ── */}
                {montoPago > 0 && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Desglose del pago</p>
                    {(() => {
                      const capitalNormal = Math.max(0, Math.round(cuota - interesPrev));
                      const abonoExtra    = Math.max(0, capitalPrev - capitalNormal);
                      return montoPago > cuota ? (
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Interés</p>
                            <p className="text-sm font-bold text-orange-600">{formatCurrency(interesPrev)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Capital cuota</p>
                            <p className="text-sm font-bold text-blue-600">{formatCurrency(capitalNormal)}</p>
                          </div>
                          <div className="bg-violet-50 rounded-lg p-1 border border-violet-200">
                            <p className="text-[10px] text-violet-600 uppercase font-semibold">Abono extra</p>
                            <p className="text-sm font-bold text-violet-700">+{formatCurrency(abonoExtra)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Nuevo saldo</p>
                            <p className="text-sm font-bold text-emerald-700">{formatCurrency(saldoNuevo)}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Interés</p>
                            <p className="text-sm font-bold text-orange-600">{formatCurrency(interesPrev)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Capital</p>
                            <p className="text-sm font-bold text-blue-600">{formatCurrency(capitalPrev)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase">Nuevo saldo</p>
                            <p className="text-sm font-bold text-emerald-700">{formatCurrency(saldoNuevo)}</p>
                          </div>
                        </div>
                      );
                    })()}
                    {montoPago > cuota && cuota > 0 && (
                      <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 shrink-0" />
                        El excedente se aplica directamente al capital, reduciendo el saldo más rápido
                      </p>
                    )}
                    {saldoNuevo <= 0 && (
                      <div className="flex items-center gap-2 pt-1 text-emerald-700 font-semibold text-sm">
                        <CheckCircle2 className="size-4" /> ¡Este pago cancela el crédito completamente!
                      </div>
                    )}
                  </div>
                )}

                {/* ── Historial de pagos ── */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <History className="size-4 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Historial de pagos ({historialPagos.length})
                    </p>
                  </div>
                  {loadingPagos ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
                    </div>
                  ) : historialPagos.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-slate-400 gap-1.5">
                      <Banknote className="size-7" />
                      <p className="text-sm">Sin pagos registrados aún</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                            <tr>
                              <th className="text-center px-2 py-2 font-semibold text-slate-500">#</th>
                              <th className="text-left   px-2 py-2 font-semibold text-slate-500">Fecha</th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">Pagado</th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">Capital</th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">Interés</th>
                              <th className="text-right  px-2 py-2 font-semibold text-slate-500">Saldo tras pago</th>
                              <th className="text-center px-2 py-2 font-semibold text-slate-500">Método</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historialPagos.map((p: any) => (
                              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                <td className="px-2 py-1.5 text-center text-slate-500">{p.num_cuota ?? '—'}</td>
                                <td className="px-2 py-1.5 text-slate-600">
                                  {new Date(p.fecha_pago).toLocaleDateString('es-CO', {
                                    day: '2-digit', month: 'short', year: 'numeric'
                                  })}
                                </td>
                                <td className="px-2 py-1.5 text-right font-semibold text-emerald-700">
                                  {formatCurrency(p.monto_pagado)}
                                </td>
                                <td className="px-2 py-1.5 text-right text-blue-600">{formatCurrency(p.capital)}</td>
                                <td className="px-2 py-1.5 text-right text-orange-600">{formatCurrency(p.interes)}</td>
                                <td className="px-2 py-1.5 text-right text-indigo-600">{formatCurrency(p.saldo_despues)}</td>
                                <td className="px-2 py-1.5 text-center text-slate-500 capitalize">{p.metodo_pago ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPagoDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleRegistrarPago}
              disabled={pagando || !selectedItem || (selectedItem?.saldo ?? 0) <= 0}
            >
              {pagando
                ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> Procesando...</>
                : <><Banknote className="size-4" /> Registrar pago</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Anular — Paso 1: ingresar justificación ─────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={isDeleteDialogOpen && anulacionStep === 1}
        onOpenChange={(open) => {
          if (!open) {
            setIsDeleteDialogOpen(false);
            setSelectedItem(null);
            setJustificacionAnulacion('');
            setAnulacionConfirmText('');
            setAnulacionStep(1);
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-5 text-amber-500" />
              Anular crédito — Paso 1 de 2
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-slate-600">
                <p>Estás a punto de anular el siguiente crédito. Esta acción <strong>no se puede deshacer</strong>.</p>
                {/* Resumen del crédito */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Asociado:</span>
                    <span className="font-semibold text-slate-800">{selectedItem?.asociado}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Monto original:</span>
                    <span className="font-semibold">{selectedItem ? formatCurrency(selectedItem.monto) : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Estado actual:</span>
                    <span>{selectedItem ? getEstadoBadge(selectedItem.estadoAprobacion) : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tipo:</span>
                    <span>{TIPOS_CREDITO.find(t => t.value === selectedItem?.tipo)?.label ?? selectedItem?.tipo}</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Justificación obligatoria */}
          <div className="px-1 pb-2 space-y-2">
            <Label className="font-medium text-slate-700">
              Motivo de la anulación <span className="text-red-500">*</span>
            </Label>
            <Textarea
              placeholder="Describe detalladamente el motivo de la anulación (crédito erróneo, duplicado, cancelado por el asociado, etc.)..."
              value={justificacionAnulacion}
              onChange={(e) => setJustificacionAnulacion(e.target.value)}
              className="resize-none min-h-[80px]"
              autoFocus
            />
            <p className="text-xs text-slate-400">
              {justificacionAnulacion.trim().length} caracteres
              {justificacionAnulacion.trim().length < 10 && ' · mínimo 10 caracteres'}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {/* Button normal para no cerrar el dialog automáticamente */}
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={justificacionAnulacion.trim().length < 10}
              onClick={() => setAnulacionStep(2)}
            >
              Continuar →
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Anular — Paso 2: confirmación final escribiendo "ANULAR" ───── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={isDeleteDialogOpen && anulacionStep === 2}
        onOpenChange={(open) => {
          if (!open) {
            setIsDeleteDialogOpen(false);
            setSelectedItem(null);
            setJustificacionAnulacion('');
            setAnulacionConfirmText('');
            setAnulacionStep(1);
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="size-5 text-red-600" />
              Confirmación final — Paso 2 de 2
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm">
                {/* Resumen */}
                <div className="p-3 bg-slate-50 rounded-lg border space-y-1 text-xs text-slate-700">
                  <p><span className="font-semibold">Asociado:</span> {selectedItem?.asociado}</p>
                  <p><span className="font-semibold">Monto:</span> {formatCurrency(selectedItem?.monto ?? 0)}</p>
                  <p className="text-slate-500 italic">
                    <span className="font-semibold not-italic text-slate-700">Motivo registrado:</span>{' '}
                    {justificacionAnulacion.trim()}
                  </p>
                </div>

                {/* Advertencia */}
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    El crédito quedará marcado como <strong>anulado</strong> y no podrá operarse ni
                    eliminarse sin autorización. Esta acción queda registrada en el sistema.
                  </p>
                </div>

                {/* Campo de confirmación */}
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium">
                    Para confirmar, escribe{' '}
                    <span className="font-bold text-red-600 tracking-wide">ANULAR</span>{' '}
                    en el campo:
                  </Label>
                  <Input
                    placeholder="Escribe ANULAR aquí..."
                    value={anulacionConfirmText}
                    onChange={(e) => setAnulacionConfirmText(e.target.value)}
                    className={`font-mono font-semibold tracking-widest ${
                      anulacionConfirmText === 'ANULAR'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : ''
                    }`}
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* Usamos Button (no AlertDialogAction) para que el dialog NO se cierre
                automáticamente antes de que el async termine */}
            <Button variant="outline" onClick={() => setAnulacionStep(1)} disabled={anulando}>
              ← Volver
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40"
              disabled={anulacionConfirmText !== 'ANULAR' || anulando}
              onClick={handleAnular}
            >
              {anulando ? 'Anulando...' : 'Confirmar anulación'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Eliminación definitiva — Paso 1 ─────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={isHardDeleteDialogOpen && hardDeleteStep === 1}
        onOpenChange={(open) => { if (!open) { setIsHardDeleteDialogOpen(false); setSelectedItem(null); setHardDeleteJustificacion(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="size-5" /> Eliminar crédito definitivamente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {selectedItem && (
                  <div className="p-3 bg-slate-50 rounded-lg border text-slate-700 space-y-1 text-xs">
                    <p><span className="font-semibold">Asociado:</span> {selectedItem.asociado}</p>
                    <p><span className="font-semibold">Monto:</span> {formatCurrency(selectedItem.monto)}</p>
                    <p><span className="font-semibold">Estado:</span> {selectedItem.anulado ? 'Anulado' : selectedItem.estadoAprobacion}</p>
                    {selectedItem.saldo > 0 && (
                      <p className="text-red-600 font-semibold">⚠ Saldo pendiente: {formatCurrency(selectedItem.saldo)}</p>
                    )}
                  </div>
                )}
                {selectedItem && selectedItem.saldo > 0 && !selectedItem.anulado ? (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">
                      No se puede eliminar un crédito con saldo activo ({formatCurrency(selectedItem.saldo)}).
                      Anula el crédito primero antes de eliminarlo definitivamente.
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-600">
                    Esta acción es <strong>irreversible</strong>. Se eliminará el crédito y todo su
                    historial de pagos permanentemente. ¿Deseas continuar?
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {(selectedItem?.saldo === 0 || selectedItem?.anulado) && (
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => setHardDeleteStep(2)}
              >
                Sí, continuar
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Eliminación definitiva — Paso 2 (confirmación final) ─────────── */}
      <AlertDialog open={isHardDeleteDialogOpen && hardDeleteStep === 2}
        onOpenChange={(open) => { if (!open) { setIsHardDeleteDialogOpen(false); setSelectedItem(null); setHardDeleteStep(1); setHardDeleteJustificacion(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="size-5" /> Confirmación final — acción irreversible
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <p>
                    Estás a punto de eliminar permanentemente el crédito de{' '}
                    <strong>{selectedItem?.asociado}</strong> por{' '}
                    <strong>{formatCurrency(selectedItem?.monto ?? 0)}</strong>.
                    Esta acción no se puede deshacer.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium">
                    Justificación de la eliminación <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Describe el motivo de la eliminación..."
                    value={hardDeleteJustificacion}
                    onChange={(e) => setHardDeleteJustificacion(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium">
                    Para confirmar, escribe <span className="font-bold text-red-600">ELIMINAR</span> en el campo:
                  </Label>
                  <Input
                    placeholder="Escribe ELIMINAR aquí..."
                    value={hardDeleteConfirmText}
                    onChange={(e) => setHardDeleteConfirmText(e.target.value)}
                    className={`font-mono ${hardDeleteConfirmText === 'ELIMINAR' ? 'border-red-500 bg-red-50' : ''}`}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHardDeleteStep(1)}>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40"
              disabled={hardDeleteConfirmText !== 'ELIMINAR' || !hardDeleteJustificacion.trim() || hardDeleting}
              onClick={handleHardDelete}
            >
              {hardDeleting ? 'Eliminando...' : 'Eliminar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Solicitar crédito (asociado) ────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isSolicitudDialogOpen} onOpenChange={(open) => {
        setIsSolicitudDialogOpen(open);
        if (!open) { setSolMonto(''); setSolTipo('libre_inversion'); setSolPlazo(''); setSolTasa(''); setSolDestino(''); setSolObs(''); }
      }}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="size-5 text-blue-600" /> Solicitar crédito
            </DialogTitle>
            <DialogDescription>
              Completa el formulario y el administrador revisará tu solicitud.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tipo de crédito */}
            <div className="space-y-1.5">
              <Label>Tipo de crédito <span className="text-red-500">*</span></Label>
              <Select value={solTipo} onValueChange={setSolTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CREDITO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monto + Plazo */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monto solicitado <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    className="pl-8"
                    placeholder="0"
                    value={solMonto}
                    onChange={(e) => setSolMonto(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Plazo (meses) <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    className="pl-8"
                    type="number" min={1} placeholder="12"
                    value={solPlazo}
                    onChange={(e) => setSolPlazo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Tasa de interés (opcional) */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Percent className="size-3.5 text-slate-400" /> Tasa de interés anual (%) — opcional
              </Label>
              <Input
                type="number" min={0} step={0.1} placeholder="Ej. 12"
                value={solTasa}
                onChange={(e) => setSolTasa(e.target.value)}
              />
              <p className="text-[11px] text-slate-400">Déjalo en blanco si no conoces la tasa; el admin la definirá.</p>
            </div>

            {/* ── Tarjeta de simulación en vivo ── */}
            {parseMonto(solMonto) > 0 && parseInt(solPlazo) > 0 && (() => {
              const _monto   = parseMonto(solMonto);
              const _tasa    = parseFloat(solTasa) || 0;
              const _plazo   = parseInt(solPlazo);
              const _cuota   = calcularCuota(_monto, _tasa, _plazo);
              const _total   = _cuota * _plazo;
              const _interes = _total - _monto;
              return (
                <div className="rounded-xl border border-purple-200 overflow-hidden shadow-sm">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="size-4 text-white" />
                      <span className="text-white text-sm font-bold">Simulación del crédito</span>
                    </div>
                    <span className="text-purple-200 text-[10px] font-medium uppercase tracking-wide">Método francés · cuota fija</span>
                  </div>
                  {/* KPIs */}
                  <div className="grid grid-cols-3 divide-x divide-purple-100 bg-white">
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] text-purple-400 uppercase tracking-wide font-semibold">Cuota mensual</p>
                      <p className="text-base font-black text-purple-700 mt-0.5">{formatCurrency(_cuota)}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] text-amber-500 uppercase tracking-wide font-semibold">Total intereses</p>
                      <p className="text-base font-black text-amber-600 mt-0.5">{formatCurrency(_interes)}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] text-emerald-500 uppercase tracking-wide font-semibold">Total a pagar</p>
                      <p className="text-base font-black text-emerald-600 mt-0.5">{formatCurrency(_total)}</p>
                    </div>
                  </div>
                  {/* Botones rápidos */}
                  <div className="flex gap-2 px-4 py-3 bg-slate-50 border-t border-purple-100">
                    <Button
                      type="button" variant="outline" size="sm"
                      className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50 gap-1.5 text-xs"
                      onClick={() => {
                        const t = generarTablaAmortizacion(_monto, _tasa, _plazo, new Date().toISOString().split('T')[0]);
                        setTablaSolSim(t);
                        setIsSolSimOpen(true);
                      }}
                    >
                      <Table2 className="size-3.5" /> Ver tabla completa ({_plazo} cuotas)
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm"
                      className="border-slate-300 text-slate-600 hover:bg-slate-100 gap-1.5 text-xs"
                      onClick={() => {
                        const t = generarTablaAmortizacion(_monto, _tasa, _plazo, new Date().toISOString().split('T')[0]);
                        descargarPDFAmortizacion(t, { monto: _monto, tasa: _tasa, plazo: _plazo, nombreAsociado: userData?.nombre });
                      }}
                    >
                      <Download className="size-3.5" /> PDF
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center pb-2">
                    Cálculo orientativo · las condiciones finales las define el administrador
                  </p>
                </div>
              );
            })()}

            {/* Destino del crédito */}
            <div className="space-y-1.5">
              <Label>Destino del crédito <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Ej. Pago de matrícula universitaria"
                value={solDestino}
                onChange={(e) => setSolDestino(e.target.value)}
              />
            </div>

            {/* Observaciones */}
            <div className="space-y-1.5">
              <Label>Observaciones adicionales</Label>
              <Textarea
                placeholder="Información adicional que quieras enviar al administrador..."
                value={solObs}
                onChange={(e) => setSolObs(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSolicitudDialogOpen(false)}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={savingSolicitud}
              onClick={handleSolicitarCredito}
            >
              {savingSolicitud ? 'Enviando...' : 'Enviar solicitud'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Rechazar solicitud de crédito (admin) ───────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={isRechazarSolOpen} onOpenChange={(open) => {
        if (!open) { setIsRechazarSolOpen(false); setSolicitudSeleccionada(null); setNotaRechazoSol(''); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="size-5 text-red-600" /> Rechazar solicitud de crédito
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {solicitudSeleccionada && (
                  <div className="p-3 bg-slate-50 rounded-lg border space-y-1 text-xs text-slate-700">
                    <p><span className="font-semibold">Asociado:</span> {solicitudSeleccionada.asociado}</p>
                    <p><span className="font-semibold">Monto:</span> {formatCurrency(solicitudSeleccionada.monto)}</p>
                    <p><span className="font-semibold">Tipo:</span> {solicitudSeleccionada.tipoCreditoLabel}</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium">
                    Motivo del rechazo <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    placeholder="Explica el motivo por el que se rechaza la solicitud..."
                    value={notaRechazoSol}
                    onChange={(e) => setNotaRechazoSol(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-400">El asociado recibirá una notificación con este mensaje.</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40"
              disabled={!notaRechazoSol.trim() || savingRechazarSol}
              onClick={handleRechazarSolicitudCredito}
            >
              {savingRechazarSol ? 'Rechazando...' : 'Confirmar rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Diálogo: Informe de desempeño de cartera ────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isInformeDialogOpen} onOpenChange={setIsInformeDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart2 className="size-5 text-emerald-600" />
              Informe de desempeño de cartera
            </DialogTitle>
            <DialogDescription>
              Vista previa del informe · {new Date().toLocaleDateString('es-CO', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const totalSolicitudes = carteraActivos.length + creditosAnulados.length;
            const desembolsados    = countByEstado['desembolsado'] ?? 0;
            const aprobados        = countByEstado['aprobado']     ?? 0;
            const pendientes       = countByEstado['pendiente']    ?? 0;
            const rechazados       = countByEstado['rechazado']    ?? 0;
            const enRevision       = countByEstado['en_revision']  ?? 0;
            const promedioCuota    = carteraActivos.length > 0
              ? Math.round(totalCuotaMensual / carteraActivos.length) : 0;
            const promedioMonto    = carteraActivos.length > 0
              ? Math.round(totalCartera / carteraActivos.length) : 0;
            const pctRecuperacion  = totalCartera > 0
              ? ((totalCuotaMensual / totalCartera) * 100).toFixed(2) : '0.00';
            const tasaAprobacion   = totalSolicitudes > 0
              ? (((desembolsados + aprobados) / totalSolicitudes) * 100).toFixed(1) : '0.0';
            const tasaRechazo      = totalSolicitudes > 0
              ? ((rechazados / totalSolicitudes) * 100).toFixed(1) : '0.0';

            return (
              <div className="space-y-5 py-1">

                {/* ── Sección 1: Resumen general ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-indigo-100 rounded-lg">
                      <Wallet className="size-4 text-indigo-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                      1. Resumen general de cartera
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Créditos activos',       value: `${carteraActivos.length}`,          color: 'bg-blue-50 border-blue-100',    text: 'text-blue-700' },
                      { label: 'Créditos anulados',      value: `${creditosAnulados.length}`,         color: 'bg-red-50 border-red-100',      text: 'text-red-700' },
                      { label: 'Cartera total',          value: formatCurrency(totalCartera),         color: 'bg-indigo-50 border-indigo-100', text: 'text-indigo-700' },
                      { label: 'Recaudo mensual',        value: formatCurrency(totalCuotaMensual),    color: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
                      { label: 'Monto promedio',         value: formatCurrency(promedioMonto),        color: 'bg-slate-50 border-slate-200',  text: 'text-slate-700' },
                      { label: 'Cuota promedio',         value: formatCurrency(promedioCuota),        color: 'bg-slate-50 border-slate-200',  text: 'text-slate-700' },
                    ].map(({ label, value, color, text }) => (
                      <div key={label} className={`p-3 rounded-xl border ${color}`}>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
                        <p className={`text-lg font-bold ${text}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Barra cuota / cartera */}
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                      <span className="font-semibold">Velocidad de recuperación mensual</span>
                      <span className="font-bold text-emerald-700">{pctRecuperacion}% de la cartera por mes</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min(100, parseFloat(pctRecuperacion) * 10)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Cada mes se recauda el {pctRecuperacion}% del capital total de la cartera
                    </p>
                  </div>
                </div>

                {/* ── Sección 2: Distribución por estado ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-orange-100 rounded-lg">
                      <PieChart className="size-4 text-orange-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                      2. Distribución por estado de aprobación
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Estado</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Cant.</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">% del total</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Monto (cartera)</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Cuota mensual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ESTADOS_APROBACION.map((e) => {
                          const count       = countByEstado[e.value] ?? 0;
                          const enEstado    = carteraActivos.filter(c => c.estadoAprobacion === e.value);
                          const montoE      = enEstado.reduce((s, c) => s + (c.monto ?? 0), 0);
                          const cuotaE      = enEstado.reduce((s, c) => s + (c.cuotaMensual ?? 0), 0);
                          const pct         = carteraActivos.length > 0
                            ? ((count / carteraActivos.length) * 100).toFixed(1) : '0.0';
                          return (
                            <tr key={e.value} className="border-b border-slate-100 last:border-0">
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${e.color}`}>
                                  {e.label}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{count}</td>
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-400 rounded-full"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-500">{pct}%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium text-slate-700">{formatCurrency(montoE)}</td>
                              <td className="px-3 py-2.5 text-right font-medium text-emerald-700">{formatCurrency(cuotaE)}</td>
                            </tr>
                          );
                        })}
                        {/* Fila de totales */}
                        <tr className="bg-slate-50 font-bold">
                          <td className="px-3 py-2.5 text-slate-700">TOTAL</td>
                          <td className="px-3 py-2.5 text-center text-slate-900">{carteraActivos.length}</td>
                          <td className="px-3 py-2.5 text-center text-slate-500">100%</td>
                          <td className="px-3 py-2.5 text-right text-indigo-700">{formatCurrency(totalCartera)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-700">{formatCurrency(totalCuotaMensual)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Sección 3: Indicadores de desempeño ── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-blue-100 rounded-lg">
                      <TrendingUp className="size-4 text-blue-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                      3. Indicadores de desempeño
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        label: 'Tasa de aprobación',
                        value: `${tasaAprobacion}%`,
                        sub:   `${desembolsados + aprobados} de ${totalSolicitudes} solicitudes`,
                        color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100',
                      },
                      {
                        label: 'Tasa de rechazo',
                        value: `${tasaRechazo}%`,
                        sub:   `${rechazados} solicitudes rechazadas`,
                        color: 'text-red-700', bg: 'bg-red-50 border-red-100',
                      },
                      {
                        label: 'Créditos en proceso',
                        value: `${pendientes + enRevision}`,
                        sub:   `${pendientes} pendientes · ${enRevision} en revisión`,
                        color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-100',
                      },
                      {
                        label: 'Créditos productivos',
                        value: `${aprobados + desembolsados}`,
                        sub:   `${aprobados} aprobados · ${desembolsados} desembolsados`,
                        color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100',
                      },
                      {
                        label: 'Tasa de interés promedio EA',
                        value: tasaPromedio > 0 ? `${tasaPromedio.toFixed(2)}%` : 'Sin tasa',
                        sub:   `Sobre ${carteraActivos.filter(c => (c.tasaInteres ?? 0) > 0).length} créditos con tasa`,
                        color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100',
                      },
                      {
                        label: 'Plazo promedio',
                        value: plazoPromedio > 0 ? `${plazoPromedio} meses` : '—',
                        sub:   'Promedio de todos los créditos activos',
                        color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100',
                      },
                    ].map(({ label, value, sub, color, bg }) => (
                      <div key={label} className={`p-3 rounded-xl border ${bg} flex items-start justify-between gap-3`}>
                        <div>
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                          <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            );
          })()}

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsInformeDialogOpen(false)}>
              Cerrar
            </Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                const ok = generateCarteraPDF({
                  creditos:         carteraActivos,
                  creditosAnulados: creditosAnulados,
                  totalCartera,
                  totalCuotaMensual,
                  tasaPromedio,
                  plazoPromedio,
                  countByEstado,
                  fechaInforme: new Date().toLocaleDateString('es-CO', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  }),
                });
                if (ok) {
                  toast.success('📊 Informe descargado correctamente');
                  setIsInformeDialogOpen(false);
                } else {
                  toast.error('Error al generar el PDF');
                }
              }}
            >
              <Download className="size-4" /> Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
