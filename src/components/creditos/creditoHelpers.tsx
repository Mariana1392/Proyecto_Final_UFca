import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const ESTADOS_APROBACION = [
  { value: 'simulacion',   label: 'Simulación',   color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' },
  { value: 'pendiente',    label: 'Pendiente',    color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800' },
  { value: 'en_revision',  label: 'En revisión',  color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
  { value: 'aprobado',     label: 'Aprobado',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'activo',       label: 'Activo',       color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
  { value: 'desembolsado', label: 'Desembolsado', color: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' },
  { value: 'en_mora',      label: 'En mora',      color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
  { value: 'pagado',       label: 'Pagado',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
  { value: 'rechazado',    label: 'Rechazado',    color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700' },
];

import { Badge } from '../ui/badge';

export const getEstadoBadge = (estado: string) => {
  const e = ESTADOS_APROBACION.find(e => e.value === estado);
  if (!e) {
    return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700 text-xs font-medium capitalize">{estado}</Badge>;
  }
  return <Badge variant="outline" className={`${e.color} text-xs font-medium`}>{e.label}</Badge>;
};

/** Tipos de interés disponibles en el sistema */
export const TIPOS_INTERES = [
  {
    value: 'compuesto',
    label: 'Interés compuesto — Francés (EA)',
    desc:  'El interés se calcula sobre el saldo pendiente cada mes. Cuota fija, amortización creciente.',
  },
  {
    value: 'simple',
    label: 'Interés simple — Capital original',
    desc:  'El interés se calcula siempre sobre el capital original. Cuota fija, interés y capital constantes.',
  },
] as const;

export type TipoInteres = 'simple' | 'compuesto';

/** Convierte tasa Efectiva Anual (EA) a tasa mensual efectiva */
export const tasaEAaMensual = (tasaAnualPct: number): number => {
  if (!tasaAnualPct || tasaAnualPct <= 0) return 0;
  return Math.pow(1 + tasaAnualPct / 100, 1 / 12) - 1;
};

/** Calcula cuota mensual con amortización francesa — tasa EA */
export const calcularCuota = (monto: number, tasaAnual: number, plazoMeses: number): number => {
  if (!monto || !plazoMeses) return 0;
  if (!tasaAnual) return Math.round(monto / plazoMeses);
  const i = tasaEAaMensual(tasaAnual);
  return Math.round(monto * (i * Math.pow(1 + i, plazoMeses)) / (Math.pow(1 + i, plazoMeses) - 1));
};

/**
 * Cuota mensual con interés SIMPLE sobre capital original.
 * Interés = P × i_mensual (constante cada mes)
 * Capital = P / n         (constante cada mes)
 * Cuota   = Capital + Interés
 */
export const calcularCuotaSimple = (monto: number, tasaAnual: number, plazoMeses: number): number => {
  if (!monto || !plazoMeses) return 0;
  if (!tasaAnual) return Math.round(monto / plazoMeses);
  const i = tasaEAaMensual(tasaAnual);
  return Math.round(monto / plazoMeses + monto * i);
};

/** Tabla de amortización con interés SIMPLE (interés constante sobre capital original) */
export const generarTablaAmortizacionSimple = (
  monto: number, tasaAnual: number, plazo: number, fechaInicio: string
): FilaAmortizacion[] => {
  if (!monto || !plazo) return [];
  const i      = tasaEAaMensual(tasaAnual);
  const cuota  = calcularCuotaSimple(monto, tasaAnual, plazo);
  const interesFijo = Math.round(monto * i);          // siempre sobre capital original
  const capitalFijo = Math.round(monto / plazo);       // cuota de capital constante
  const rows: FilaAmortizacion[] = [];
  let saldo = monto;
  const base = fechaInicio ? new Date(fechaInicio + 'T00:00:00') : new Date();

  for (let k = 1; k <= plazo; k++) {
    const fecha   = new Date(base.getFullYear(), base.getMonth() + k, base.getDate());
    const capital = k < plazo ? capitalFijo : saldo;   // última cuota cierra el saldo exacto
    saldo         = Math.max(0, saldo - capital);
    rows.push({
      numero:   k,
      fecha:    fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
      cuota,
      interes:  interesFijo,
      capital,
      saldo,
    });
  }
  return rows;
};

export interface FilaAmortizacion {
  numero: number;
  fecha: string;
  cuota: number;
  interes: number;
  capital: number;
  saldo: number;
}

/** Genera tabla de amortización francesa completa — tasa EA */
export const generarTablaAmortizacion = (
  monto: number, tasaAnual: number, plazo: number, fechaInicio: string
): FilaAmortizacion[] => {
  if (!monto || !plazo) return [];
  const r = tasaEAaMensual(tasaAnual);
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

/** Genera y descarga un PDF con la tabla de pagos (simple) o amortización francesa (compuesto) */
export const descargarPDFAmortizacion = (
  tabla: FilaAmortizacion[],
  opts: { monto: number; tasa: number; plazo: number; nombreAsociado?: string; tipo?: string; tipoInteres?: 'simple' | 'compuesto' }
) => {
  if (!tabla.length) return;
  const esSimple = (opts.tipoInteres ?? 'compuesto') === 'simple';
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
  doc.text(
    esSimple ? 'UFCA – Tabla de Pagos' : 'UFCA – Tabla de Amortización Francesa',
    14, 14
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    esSimple
      ? 'Unión Familiar de Crédito y Ahorro · Interés simple sobre capital original'
      : 'Unión Familiar de Crédito y Ahorro · Método de cuota fija mensual (amortización francesa)',
    14, 21
  );
  if (opts.nombreAsociado) {
    doc.text(`Asociado: ${opts.nombreAsociado}`, 14, 28);
  }
  doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, 35);

  // ── Tarjetas KPI ────────────────────────────────────────────────────────
  const kpis = [
    { l: 'Monto solicitado', v: fmtCOP(opts.monto) },
    { l: esSimple ? 'Tasa N.A.' : 'Tasa EA', v: `${opts.tasa}%` },
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
