import React from 'react';
import { Badge } from '../ui/badge';
import { TIPOS_LIQUIDACION as TIPOS_LIQ, ESTADOS_LIQUIDACION as ESTADOS_LIQ } from '../../lib/constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Concepto } from './liquidacionTypes';

export const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);

export const getEstadoBadge = (estado: string, anulado?: boolean) => {
  if (anulado) return React.createElement(Badge, { variant: "outline", className: "bg-red-100 text-red-700 border-red-200 text-xs" }, "Inválida");
  const e = ESTADOS_LIQ.find(s => s.value === estado);
  return React.createElement(Badge, { variant: "outline", className: `${e?.color ?? 'bg-slate-100 text-slate-600'} text-xs` }, estado);
};

export const numLiq = (id: string) => `LIQ-${String(id).substring(0, 8).toUpperCase()}`;

export function validateDateRange(desde: string, hasta: string): string {
  if (!desde && !hasta) return '';
  if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) return 'Formato de fecha inicio inválido (YYYY-MM-DD)';
  if (hasta && !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) return 'Formato de fecha fin inválido (YYYY-MM-DD)';
  if (desde && hasta && desde > hasta) return 'La fecha inicio no puede ser posterior a la fecha fin';
  if (hasta && hasta > new Date().toISOString().slice(0, 10)) return 'La fecha fin no puede ser futura';
  return '';
}

export function buildLiquidacionDoc(liq: any): jsPDF {
  const doc   = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const tipoLabel = TIPOS_LIQ.find(t => t.value === liq.tipo)?.label ?? liq.tipo;
  const nLiq  = numLiq(liq.id);

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

  return doc;
}

export function generateLiquidacionPDF(liq: any): boolean {
  try {
    const doc  = buildLiquidacionDoc(liq);
    const nLiq = numLiq(liq.id);
    doc.save(`Liquidacion_${nLiq}_${(liq.asociado ?? 'asociado').replace(/\s+/g, '_')}.pdf`);
    return true;
  } catch (err) {
    console.error('Error generando PDF:', err);
    return false;
  }
}

export function generateLiquidacionPDFBlobUrl(liq: any): string | null {
  try {
    const blob = buildLiquidacionDoc(liq).output('blob');
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Error generando blob PDF:', err);
    return null;
  }
}
