import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF with autoTable types
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable?: {
      finalY: number;
    };
  }
}

// Formatear moneda en pesos colombianos
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
};

// Agregar header corporativo
const addHeader = (doc: jsPDF, title: string) => {
  // Fondo verde esmeralda
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, 210, 40, 'F');
  
  // Logo UFCA
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('UFCA', 20, 20);
  
  // Subtítulo
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Unión Familiar de Crédito y Ahorro', 20, 28);
  
  // Título del documento
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, 55);
  
  // Fecha de generación
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const fecha = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Fecha de generación: ${fecha}`, 20, 62);
  
  return 70; // Retornar posición Y después del header
};

// Agregar footer a todas las páginas
const addFooter = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
    doc.text('Sistema UFCA - Documento generado automáticamente', 105, 290, { align: 'center' });
  }
};

// ==================== PDF DE PEDIDOS ====================
export const generatePedidoPDF = (pedido: any) => {
  try {
    const doc = new jsPDF();
    let yPos = addHeader(doc, 'COMPROBANTE DE PEDIDO');
    
    yPos += 5;
    
    // Información del pedido
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL PEDIDO', 20, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const pedidoInfo = [
      ['Número de pedido:', pedido.numero || 'N/A'],
      ['Cliente:', pedido.cliente || 'N/A'],
      ['Fecha:', pedido.fecha || new Date().toLocaleDateString('es-CO')],
      ['Productos:', pedido.productos || 'N/A'],
      ['Cantidad de items:', `${pedido.cantidad || 0} items`],
      ['Método de pago:', pedido.metodoPago || 'N/A'],
      ['Estado:', pedido.estado || 'Pendiente'],
    ];
    
    pedidoInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 75, yPos);
      yPos += 7;
    });
    
    yPos += 5;
    
    // Total
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 20, yPos);
    doc.setTextColor(16, 185, 129);
    doc.text(formatCurrency(pedido.total || 0), 75, yPos);
    doc.setTextColor(0, 0, 0);
    
    yPos += 15;
    
    // Tabla de productos
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DE PRODUCTOS', 20, yPos);
    yPos += 5;
    
    const productosEjemplo = [
      ['Producto 1', '2', formatCurrency(500000), formatCurrency(1000000)],
      ['Producto 2', '1', formatCurrency(200000), formatCurrency(200000)],
      ['Producto 3', '3', formatCurrency(150000), formatCurrency(450000)],
    ];
    
    autoTable(doc, {
      startY: yPos,
      head: [['Producto', 'Cantidad', 'Precio Unitario', 'Subtotal']],
      body: productosEjemplo,
      theme: 'striped',
      headStyles: { 
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 9 }
    });
    
    // Footer
    addFooter(doc);
    
    // Guardar
    doc.save(`Pedido_${pedido.numero || 'N/A'}.pdf`);
    return true;
  } catch (error) {
    console.error('Error al generar PDF de Pedido:', error);
    return false;
  }
};

// ==================== PDF DE VENTAS ====================
export const generateVentaPDF = (venta: any) => {
  try {
    const doc = new jsPDF();
    let yPos = addHeader(doc, 'COMPROBANTE DE VENTA');
    
    yPos += 5;
    
    // Información de la venta
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DE LA VENTA', 20, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const ventaInfo = [
      ['Número de pedido:', venta.pedido || 'N/A'],
      ['Cliente:', venta.cliente || 'N/A'],
      ['Fecha:', venta.fecha || new Date().toLocaleDateString('es-CO')],
      ['Productos:', venta.productos || 'N/A'],
      ['Cantidad:', `${venta.cantidad || 0} items`],
      ['Método de pago:', venta.metodoPago || 'N/A'],
      ['Estado:', venta.estado || 'Completada'],
    ];
    
    ventaInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 75, yPos);
      yPos += 7;
    });
    
    yPos += 5;
    
    // Total
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL A PAGAR:', 20, yPos);
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(16);
    doc.text(formatCurrency(venta.total || 0), 75, yPos);
    doc.setTextColor(0, 0, 0);
    
    yPos += 20;
    
    // Nota
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Gracias por su compra. Este es un comprobante válido de su transacción.', 20, yPos);
    
    // Footer
    addFooter(doc);
    
    // Guardar
    doc.save(`Venta_${venta.pedido || 'N/A'}.pdf`);
    return true;
  } catch (error) {
    console.error('Error al generar PDF de Venta:', error);
    return false;
  }
};

// ==================== PDF DE COMPRAS ====================
export const generateCompraPDF = (compra: any) => {
  try {
    const doc = new jsPDF();
    let yPos = addHeader(doc, 'ORDEN DE COMPRA');
    
    yPos += 5;
    
    // Información de la compra
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DE LA COMPRA', 20, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const compraInfo = [
      ['Número de compra:', compra.numero || 'N/A'],
      ['Proveedor:', compra.proveedor || 'N/A'],
      ['Fecha:', compra.fecha || new Date().toLocaleDateString('es-CO')],
      ['Productos:', compra.productos || 'N/A'],
      ['Cantidad de items:', `${compra.cantidad || 0} items`],
      ['Estado:', compra.estado || 'Completada'],
    ];
    
    compraInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 70, yPos);
      yPos += 7;
    });
    
    yPos += 5;
    
    // Total
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 20, yPos);
    doc.setTextColor(16, 185, 129);
    doc.text(formatCurrency(compra.total || 0), 70, yPos);
    doc.setTextColor(0, 0, 0);
    
    yPos += 15;
    
    // Tabla de productos
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DE PRODUCTOS', 20, yPos);
    yPos += 5;
    
    const cantidad = compra.cantidad || 5;
    const precioUnit = Math.floor((compra.total || 1000000) / cantidad);
    
    const productosEjemplo = [
      ['Producto A', `${Math.ceil(cantidad / 2)}`, formatCurrency(precioUnit), formatCurrency(precioUnit * Math.ceil(cantidad / 2))],
      ['Producto B', `${Math.floor(cantidad / 2)}`, formatCurrency(precioUnit), formatCurrency(precioUnit * Math.floor(cantidad / 2))],
    ];
    
    autoTable(doc, {
      startY: yPos,
      head: [['Producto', 'Cantidad', 'Precio Unitario', 'Subtotal']],
      body: productosEjemplo,
      theme: 'striped',
      headStyles: { 
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 9 }
    });
    
    // Footer
    addFooter(doc);
    
    // Guardar
    doc.save(`Compra_${compra.numero || 'N/A'}.pdf`);
    return true;
  } catch (error) {
    console.error('Error al generar PDF de Compra:', error);
    return false;
  }
};

// ==================== PDF DE CRÉDITOS ====================
export const generateCreditoPDF = (credito: any) => {
  try {
    const doc  = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // ── Constantes del crédito ─────────────────────────────────────────────
    const monto        = credito.monto         || 0;
    const saldo        = credito.saldo         ?? monto;
    const cuota        = credito.cuotaMensual  || 0;
    const tasaAnual    = credito.tasaInteres   || 0;
    const plazo        = credito.plazo         || 0;
    const tasaMensual  = tasaAnual > 0 ? tasaAnual / 100 / 12 : 0;
    const numCredito   = `CRE-${String(credito.id ?? '').substring(0, 8).toUpperCase()}`;

    const estadosLabel: Record<string, string> = {
      pendiente:    'Pendiente',
      en_revision:  'En revisión',
      aprobado:     'Aprobado',
      desembolsado: 'Desembolsado',
      en_mora:      'EN MORA',
      pagado:       'Pagado',
      rechazado:    'Rechazado',
    };
    const tiposLabel: Record<string, string> = {
      libre_inversion: 'Libre inversión',
      educacion:       'Educación',
      vivienda:        'Vivienda',
      calamidad:       'Calamidad',
    };
    const estadoLabel = credito.anulado
      ? 'ANULADO'
      : (estadosLabel[credito.estadoAprobacion] ?? credito.estadoAprobacion ?? 'N/A');
    const tipoLabel = tiposLabel[credito.tipo] ?? credito.tipo ?? 'Libre inversión';

    // Cálculos financieros
    const cuotasPagadas    = cuota > 0 ? Math.max(0, Math.round((monto - saldo) / cuota)) : 0;
    const cuotasPendientes = Math.max(0, plazo - cuotasPagadas);
    const capitalPagado    = monto - saldo;
    let interesesPagados   = 0;
    let interesesPendientes = 0;
    let saldoTemp = monto;
    for (let i = 1; i <= plazo; i++) {
      const intCuota = Math.round(saldoTemp * tasaMensual);
      const capCuota = Math.round(cuota - intCuota);
      if (i <= cuotasPagadas) interesesPagados += intCuota;
      else interesesPendientes += intCuota;
      saldoTemp = Math.max(0, saldoTemp - capCuota);
    }
    const totalAPagar       = cuota * plazo;
    const totalIntereses    = totalAPagar - monto;
    const pctAvance         = plazo > 0 ? Math.round((cuotasPagadas / plazo) * 100) : 0;

    // Fechas
    const fechaBase = credito.fechaDesembolso
      ? new Date(credito.fechaDesembolso + 'T00:00:00')
      : null;
    const fechaVencimiento = fechaBase && plazo > 0
      ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + plazo, fechaBase.getDate())
      : null;
    const fechaVencProxima = fechaBase && cuotasPagadas < plazo
      ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + cuotasPagadas + 1, fechaBase.getDate())
      : null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const diasMora = (credito.estadoAprobacion === 'en_mora' && fechaVencProxima && fechaVencProxima < hoy)
      ? Math.floor((hoy.getTime() - fechaVencProxima.getTime()) / 86400000)
      : 0;

    const fmtFecha = (d: Date | null) =>
      d ? d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const fmtFechaCorta = (d: Date | null) =>
      d ? d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    // ══════════════════════════════════════════════════════════════════════
    // PÁGINA 1
    // ══════════════════════════════════════════════════════════════════════

    // ── Header corporativo ─────────────────────────────────────────────────
    doc.setFillColor(16, 185, 129);   // verde esmeralda UFCA
    doc.rect(0, 0, 210, 44, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('UFCA', 14, 18);
    doc.setFontSize(9);  doc.setFont('helvetica', 'normal');
    doc.text('Uni\u00f3n Familiar de Cr\u00e9dito y Ahorro', 14, 26);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('CERTIFICADO DE CR\u00c9DITO', 14, 37);
    // Número de crédito a la derecha
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(numCredito, pageW - 14, 18, { align: 'right' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    const fechaGen = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' } as any);
    doc.text(`Generado: ${fechaGen}`, pageW - 14, 26, { align: 'right' });
    // Badge de estado en header
    const badgeColor = credito.anulado ? [239,68,68] : credito.estadoAprobacion === 'en_mora' ? [220,38,38] : credito.estadoAprobacion === 'pagado' ? [16,185,129] : [99,102,241];
    doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
    doc.roundedRect(pageW - 55, 30, 41, 10, 2, 2, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(estadoLabel, pageW - 34.5, 36.5, { align: 'center' });

    let y = 54;
    doc.setTextColor(0, 0, 0);

    // ── 1. Datos del asociado ──────────────────────────────────────────────
    doc.setFillColor(236, 253, 245);
    doc.rect(14, y - 4, pageW - 28, 22, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(6, 95, 70);
    doc.text('DATOS DEL ASOCIADO', 18, y + 1);
    doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text(credito.asociado || 'N/A', 18, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text(`C.C. ${credito.cedula || 'N/A'}`, 18, y + 6);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`Tipo: ${tipoLabel}`, pageW / 2, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(`N° ${numCredito}`, pageW / 2, y + 6, { align: 'center' });
    y += 22;

    // ── 2. Información financiera del crédito (tabla 2 columnas) ──────────
    doc.setFillColor(5, 150, 105);
    doc.rect(14, y, pageW - 28, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('CONDICIONES DEL CRÉDITO', 18, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 10;

    const condiciones: [string, string, string, string][] = [
      ['Monto aprobado',    formatCurrency(monto),           'Cuota mensual',        formatCurrency(cuota)],
      ['Tasa de interés EA', tasaAnual > 0 ? `${tasaAnual}%` : 'Sin interés',
                                                              'Tasa mensual',         tasaAnual > 0 ? `${(tasaAnual/12).toFixed(4)}%` : '—'],
      ['Plazo total',        `${plazo} meses`,               'Total a pagar',         formatCurrency(totalAPagar)],
      ['Total intereses',    formatCurrency(totalIntereses),  'Saldo pendiente',       formatCurrency(saldo)],
      ['Fecha desembolso',   fmtFecha(fechaBase),            'Fecha de vencimiento',  fmtFecha(fechaVencimiento)],
    ];

    condiciones.forEach(([l1, v1, l2, v2]) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
      doc.text(l1, 18, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
      doc.text(v1, 18, y + 5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
      doc.text(l2, pageW / 2 + 5, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
      doc.text(v2, pageW / 2 + 5, y + 5);
      y += 13;
      doc.setDrawColor(230, 230, 230);
      doc.line(14, y - 1, pageW - 14, y - 1);
    });
    y += 2;

    // Observaciones / propósito
    if (credito.descripcionSoporte) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
      doc.text('Propósito / Observaciones:', 18, y);
      y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
      const lines = doc.splitTextToSize(credito.descripcionSoporte, pageW - 36);
      doc.text(lines, 18, y);
      y += lines.length * 5 + 4;
    }

    // ── 3. Resumen financiero en tiempo real ───────────────────────────────
    y += 2;
    doc.setFillColor(5, 150, 105);
    doc.rect(14, y, pageW - 28, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN FINANCIERO', 18, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 10;

    const resumen: [string, string, string, string][] = [
      ['Cuotas pagadas',     `${cuotasPagadas} de ${plazo}`,    'Cuotas pendientes',    `${cuotasPendientes}`],
      ['Capital pagado',      formatCurrency(capitalPagado),     'Capital pendiente',    formatCurrency(saldo)],
      ['Intereses pagados',   formatCurrency(interesesPagados),  'Intereses pendientes', cuotasPendientes > 0 ? `aprox. ${formatCurrency(interesesPendientes)}` : '---'],
      ['Progreso del crédito', `${pctAvance}% completado`,      'Próxima cuota',        fmtFechaCorta(fechaVencProxima)],
    ];

    resumen.forEach(([l1, v1, l2, v2]) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
      doc.text(l1, 18, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      if (l1.includes('pagad')) doc.setTextColor(16, 100, 60);
      else doc.setTextColor(0, 0, 0);
      doc.text(v1, 18, y + 5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
      doc.text(l2, pageW / 2 + 5, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
      doc.text(v2, pageW / 2 + 5, y + 5);
      y += 13;
      doc.setDrawColor(230, 230, 230);
      doc.line(14, y - 1, pageW - 14, y - 1);
    });

    // Barra de progreso
    y += 2;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 80);
    doc.text('Progreso visual:', 18, y);
    y += 5;
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(18, y, pageW - 36, 5, 1.5, 1.5, 'F');
    if (pctAvance > 0) {
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(18, y, (pageW - 36) * (pctAvance / 100), 5, 1.5, 1.5, 'F');
    }
    doc.setFontSize(7); doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
    doc.text(`${pctAvance}%`, 18 + (pageW - 36) * (pctAvance / 100) + 2, y + 3.5);
    y += 12;

    // ── 4. Alertas: mora / anulación / estado especial ────────────────────
    if (diasMora > 0) {
      doc.setFillColor(254, 226, 226);
      doc.setDrawColor(239, 68, 68);
      doc.roundedRect(14, y, pageW - 28, 14, 2, 2, 'FD');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(185, 28, 28);
      doc.text(`!! CREDITO EN MORA - ${diasMora} dias vencidos`, 18, y + 9);
      doc.setTextColor(0, 0, 0);
      y += 18;
    }

    if (credito.anulado) {
      doc.setFillColor(254, 226, 226);
      doc.setDrawColor(239, 68, 68);
      doc.roundedRect(14, y, pageW - 28, credito.motivoAnulacion ? 20 : 12, 2, 2, 'FD');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(185, 28, 28);
      doc.text('CRÉDITO ANULADO', 18, y + 7);
      if (credito.motivoAnulacion) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 0, 0);
        const mAnul = doc.splitTextToSize(`Motivo: ${credito.motivoAnulacion}`, pageW - 40);
        doc.text(mAnul, 18, y + 14);
        y += mAnul.length * 5 + 5;
      }
      doc.setTextColor(0, 0, 0);
      y += 16;
    }

    if (credito.motivoEstadoCambio && !credito.anulado) {
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(14, y, pageW - 28, 16, 2, 2, 'FD');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(120, 80, 0);
      doc.text('Observación de estado:', 18, y + 6);
      doc.setFont('helvetica', 'normal');
      const mEst = doc.splitTextToSize(credito.motivoEstadoCambio, pageW - 40);
      doc.text(mEst, 18, y + 12);
      doc.setTextColor(0, 0, 0);
      y += 20;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PÁGINA 2 — Tabla de amortización
    // ══════════════════════════════════════════════════════════════════════
    doc.addPage();

    // Mini-header en página 2
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, 210, 18, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('UFCA - TABLA DE AMORTIZACI\u00d3N (SISTEMA FRANC\u00c9S)', 14, 12);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`${numCredito} · ${credito.asociado || 'N/A'}`, pageW - 14, 12, { align: 'right' });
    doc.setTextColor(0, 0, 0);

    let yAmort = 24;

    // Info rápida de referencia
    const refInfo: [string, string][] = [
      ['Monto',   formatCurrency(monto)],
      ['Cuota',   formatCurrency(cuota)],
      ['Tasa EA', tasaAnual > 0 ? `${tasaAnual}%` : 'Sin interés'],
      ['Plazo',   `${plazo} meses`],
    ];
    refInfo.forEach(([l, v], idx) => {
      const x = 14 + idx * 48;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(80, 80, 80);
      doc.text(l, x, yAmort);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(0, 0, 0);
      doc.text(v, x, yAmort + 5);
    });
    yAmort += 12;

    // Generar datos de amortización completos
    const amortData: string[][] = [];
    let saldoAcum = monto;
    for (let i = 1; i <= plazo; i++) {
      const intCuota  = Math.round(saldoAcum * tasaMensual);
      const capCuota  = Math.round(cuota - intCuota);
      saldoAcum = Math.max(0, saldoAcum - capCuota);
      const fechaCuota = fechaBase
        ? new Date(fechaBase.getFullYear(), fechaBase.getMonth() + i, fechaBase.getDate())
            .toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
      const pagada = i <= cuotasPagadas;
      amortData.push([
        `${i}`,
        fechaCuota,
        formatCurrency(cuota),
        formatCurrency(capCuota),
        formatCurrency(intCuota),
        formatCurrency(saldoAcum),
        pagada ? 'Pagada' : 'Pendiente',
      ]);
    }

    autoTable(doc, {
      startY: yAmort,
      head: [['N°', 'Fecha cuota', 'Valor cuota', 'Capital', 'Interés', 'Saldo', 'Estado']],
      body: amortData,
      theme: 'striped',
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: { fontSize: 7.5 },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 30 },
        2: { halign: 'right', cellWidth: 28 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 25 },
        5: { halign: 'right', cellWidth: 30 },
        6: { halign: 'center', cellWidth: 22 },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const val = data.cell.raw as string;
          if (val === 'Pagada') {
            data.cell.styles.textColor = [6, 120, 60];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [100, 100, 100];
          }
        }
      },
    });

    // Fila de totales
    const finalY = (doc as any).lastAutoTable.finalY + 3;
    const totalesData = [
      ['', 'TOTALES', formatCurrency(cuota * plazo), formatCurrency(monto), formatCurrency(totalIntereses), '—', ''],
    ];
    autoTable(doc, {
      startY: finalY,
      body: totalesData,
      theme: 'plain',
      bodyStyles: { fontStyle: 'bold', fontSize: 8, fillColor: [226, 232, 240] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 30 },
        2: { halign: 'right', cellWidth: 28, textColor: [5, 150, 105] },
        3: { halign: 'right', cellWidth: 28, textColor: [5, 150, 105] },
        4: { halign: 'right', cellWidth: 25, textColor: [5, 150, 105] },
        5: { halign: 'right', cellWidth: 30 },
        6: { halign: 'center', cellWidth: 22 },
      },
      margin: { left: 14, right: 14 },
    });

    // ── Nota legal ─────────────────────────────────────────────────────────
    const notaY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'italic');
    const nota =
      'Este certificado es un documento oficial de UFCA (Unión Familiar de Crédito y Ahorro). ' +
      'Los pagos deben realizarse puntualmente en las fechas indicadas. ' +
      'El incumplimiento genera intereses de mora y afecta el historial crediticio del asociado. ' +
      'La tabla de amortización usa el sistema francés (cuota fija, interés sobre saldo). ' +
      (credito.anulado ? `\nCRÉDITO ANULADO — Motivo: ${credito.motivoAnulacion || 'No especificado'}. ` : '') +
      'Para consultas comuníquese con la administración de UFCA.';
    const notaLines = doc.splitTextToSize(nota, pageW - 28);
    doc.text(notaLines, 14, notaY);

    // Footer en todas las páginas
    addFooter(doc);

    // Guardar
    const nombre = `Credito_${numCredito}_${credito.asociado?.replace(/\s+/g, '_') || 'N/A'}.pdf`;
    doc.save(nombre);
    return true;
  } catch (error) {
    console.error('Error al generar PDF de Crédito:', error);
    return false;
  }
};

// ==================== COMPROBANTE INDIVIDUAL DE PAGO ====================
export const generateComprobantePagoPDF = (pago: any, credito: any) => {
  try {
    const doc = new jsPDF();
    let yPos = addHeader(doc, 'COMPROBANTE DE PAGO');
    yPos += 5;

    const numCredito = `CRE-${String(credito.id ?? '').substring(0, 8).toUpperCase()}`;

    // ── Datos del crédito ──────────────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('DATOS DEL CRÉDITO', 20, yPos);
    yPos += 8;

    doc.setFontSize(10);
    const infoCredito: [string, string][] = [
      ['N° de crédito:',   numCredito],
      ['Asociado:',        credito.asociado  || 'N/A'],
      ['Cédula:',          credito.cedula    || 'N/A'],
      ['Monto otorgado:',  formatCurrency(credito.monto || 0)],
      ['Tasa EA:',         credito.tasaInteres > 0 ? `${credito.tasaInteres}%` : 'Sin interés'],
      ['Plazo:',           `${credito.plazo || 0} meses`],
    ];

    infoCredito.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 82, yPos);
      yPos += 7;
    });

    yPos += 5;

    // ── Detalle del pago ───────────────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DEL PAGO', 20, yPos);
    yPos += 8;

    const metodoPagoLabel: Record<string, string> = {
      efectivo:      'Efectivo',
      transferencia: 'Transferencia bancaria',
      cheque:        'Cheque',
    };

    const fechaPago = pago.fecha_pago
      ? new Date(pago.fecha_pago + 'T00:00:00').toLocaleDateString('es-CO', {
          day: '2-digit', month: 'long', year: 'numeric',
        })
      : '—';

    const infoPago: [string, string][] = [
      ['N° de cuota:',       `${pago.num_cuota ?? '—'}`],
      ['Fecha de pago:',     fechaPago],
      ['Método de pago:',    metodoPagoLabel[pago.metodo_pago] ?? pago.metodo_pago ?? '—'],
      ['Monto pagado:',      formatCurrency(pago.monto_pagado || 0)],
      ['  › Abono capital:', formatCurrency(pago.capital || 0)],
      ['  › Intereses:',     formatCurrency(pago.interes || 0)],
      ['Saldo antes:',       formatCurrency(pago.saldo_antes || 0)],
      ['Saldo después:',     formatCurrency(pago.saldo_despues || 0)],
    ];

    if (pago.observacion) infoPago.push(['Observación:', pago.observacion]);
    if (pago.registrado_por) infoPago.push(['Registrado por:', pago.registrado_por]);

    doc.setFontSize(10);
    infoPago.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      const isAmount = label.includes('Monto') || label.includes('capital') ||
                       label.includes('Intereses') || label.includes('Saldo');
      if (isAmount) doc.setTextColor(16, 120, 60);
      doc.text(value, 82, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 7;
    });

    yPos += 10;

    // ── Cuadro resumen verde ───────────────────────────────────────────────
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(20, yPos, 170, 28, 3, 3, 'FD');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 100, 60);
    doc.text('TOTAL PAGADO', 105, yPos + 10, { align: 'center' });
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129);
    doc.text(formatCurrency(pago.monto_pagado || 0), 105, yPos + 22, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    yPos += 40;

    // ── Nota legal ─────────────────────────────────────────────────────────
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'italic');
    const nota =
      'Este comprobante certifica el pago realizado sobre el crédito indicado. ' +
      'Conserve este documento como respaldo de su transacción. ' +
      'Para consultas comuníquese con UFCA.';
    doc.text(doc.splitTextToSize(nota, 170), 20, yPos);

    addFooter(doc);

    const nombreArchivo = `Comprobante_C${pago.num_cuota}_${
      credito.asociado?.replace(/\s+/g, '_') || 'N/A'
    }.pdf`;
    doc.save(nombreArchivo);
    return true;
  } catch (err) {
    console.error('Error al generar comprobante:', err);
    return false;
  }
};

// ==================== HISTORIAL COMPLETO DE PAGOS PDF ====================
export const generateHistorialCreditoPDF = (credito: any, historial: any[]) => {
  try {
    const doc  = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // ── Header corporativo ────────────────────────────────────────────────
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, 210, 44, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('UFCA', 14, 18);
    doc.setFontSize(9);  doc.setFont('helvetica', 'normal');
    doc.text('Uni\u00f3n Familiar de Cr\u00e9dito y Ahorro', 14, 26);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('HISTORIAL COMPLETO DE PAGOS', 14, 37);
    doc.setFontSize(8);  doc.setFont('helvetica', 'normal');
    const fechaGenH = new Date().toLocaleDateString('es-CO', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    } as any);
    doc.text(`Generado: ${fechaGenH}`, pageW - 14, 26, { align: 'right' });
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    const numCredito = `CRE-${String(credito.id ?? '').substring(0, 8).toUpperCase()}`;
    doc.text(numCredito, pageW - 14, 18, { align: 'right' });

    let yPos = 54;
    doc.setTextColor(0, 0, 0);

    // ── Datos del crédito ─────────────────────────────────────────────────
    doc.setFillColor(236, 253, 245);
    doc.rect(14, yPos - 4, pageW - 28, 36, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(6, 95, 70);
    doc.text('DATOS DEL CR\u00c9DITO', 18, yPos + 1);
    doc.setTextColor(0, 0, 0); yPos += 8;

    const col1x = 18, col2x = pageW / 2 + 5;
    const infoLeft: [string, string][] = [
      ['Asociado:',       credito.asociado  || 'N/A'],
      ['C\u00e9dula:',   credito.cedula    || 'N/A'],
      ['Monto otorgado:', formatCurrency(credito.monto || 0)],
      ['Saldo actual:',   formatCurrency(credito.saldo || 0)],
    ];
    const infoRight: [string, string][] = [
      ['Tipo:',       (() => {
        const tl: Record<string,string> = { libre_inversion:'Libre inversi\u00f3n', educacion:'Educaci\u00f3n', vivienda:'Vivienda', calamidad:'Calamidad' };
        return tl[credito.tipo] ?? credito.tipo ?? 'Libre inversi\u00f3n';
      })()],
      ['Tasa EA:',    credito.tasaInteres > 0 ? `${credito.tasaInteres}%` : 'Sin inter\u00e9s'],
      ['Plazo:',      `${credito.plazo || 0} meses`],
      ['Estado:',     credito.estadoAprobacion ?? 'N/A'],
    ];
    infoLeft.forEach(([l, v], i) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
      doc.text(l, col1x, yPos + i * 7);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
      doc.text(v, col1x, yPos + i * 7 + 4);
    });
    infoRight.forEach(([l, v], i) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
      doc.text(l, col2x, yPos + i * 7);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0, 0, 0);
      doc.text(v, col2x, yPos + i * 7 + 4);
    });
    yPos += 32;

    // ── Resumen de totales en 3 cajas ─────────────────────────────────────
    yPos += 4;
    const totalPagado    = historial.reduce((s, p) => s + (p.monto_pagado ?? 0), 0);
    const totalCapital   = historial.reduce((s, p) => s + (p.capital ?? 0), 0);
    const totalIntereses = historial.reduce((s, p) => s + (p.interes ?? 0), 0);
    const boxW = (pageW - 28 - 8) / 3;

    const cajas = [
      { label: 'TOTAL PAGADO',      val: formatCurrency(totalPagado),    fill: [236, 253, 245] as [number,number,number], text: [6, 95, 70] as [number,number,number] },
      { label: 'CAPITAL ABONADO',   val: formatCurrency(totalCapital),   fill: [239, 246, 255] as [number,number,number], text: [37, 99, 160] as [number,number,number] },
      { label: 'INTERESES PAGADOS', val: formatCurrency(totalIntereses), fill: [255, 247, 237] as [number,number,number], text: [154, 52, 18] as [number,number,number] },
    ];
    cajas.forEach(({ label, val, fill, text }, i) => {
      const x = 14 + i * (boxW + 4);
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.roundedRect(x, yPos, boxW, 14, 2, 2, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(120, 120, 120);
      doc.text(label, x + boxW / 2, yPos + 4.5, { align: 'center' });
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(text[0], text[1], text[2]);
      doc.text(val, x + boxW / 2, yPos + 11, { align: 'center' });
    });
    yPos += 20;

    // Línea resumen adicional
    const pctCapital = totalPagado > 0 ? ((totalCapital / totalPagado) * 100).toFixed(1) : '0.0';
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100);
    doc.text(
      `${historial.length} cuota${historial.length !== 1 ? 's' : ''} pagada${historial.length !== 1 ? 's' : ''} \u2014 ` +
      `Capital: ${pctCapital}% del total \u2014 ` +
      `Intereses: ${totalPagado > 0 ? (100 - parseFloat(pctCapital)).toFixed(1) : '0.0'}% del total`,
      14, yPos
    );
    yPos += 8;

    // ── Tabla completa de transacciones ──────────────────────────────────
    doc.setFillColor(5, 150, 105);
    doc.rect(14, yPos, pageW - 28, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DE TRANSACCIONES', 18, yPos + 5);
    doc.setTextColor(0, 0, 0);
    yPos += 9;

    const metodoPagoLabel: Record<string, string> = {
      efectivo:      'Efectivo',
      transferencia: 'Transferencia',
      cheque:        'Cheque',
    };

    const body = [...historial].reverse().map((p: any) => [
      `${p.num_cuota ?? '---'}`,
      p.fecha_pago
        ? new Date(p.fecha_pago + 'T00:00:00').toLocaleDateString('es-CO', {
            day: '2-digit', month: 'short', year: 'numeric',
          })
        : '---',
      formatCurrency(p.monto_pagado ?? 0),
      formatCurrency(p.capital ?? 0),
      formatCurrency(p.interes ?? 0),
      formatCurrency(p.saldo_antes ?? 0),
      formatCurrency(p.saldo_despues ?? 0),
      metodoPagoLabel[p.metodo_pago] ?? p.metodo_pago ?? '---',
      p.observacion ? String(p.observacion).substring(0, 25) : '',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['N°', 'Fecha pago', 'Pagado', 'Capital', 'Inter\u00e9s', 'Saldo antes', 'Saldo desp.', 'M\u00e9todo', 'Obs.']],
      body,
      theme: 'striped',
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      bodyStyles:           { fontSize: 7.5 },
      alternateRowStyles:   { fillColor: [241, 249, 245] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 9 },
        1: { cellWidth: 26 },
        2: { halign: 'right',  cellWidth: 24 },
        3: { halign: 'right',  cellWidth: 22 },
        4: { halign: 'right',  cellWidth: 22 },
        5: { halign: 'right',  cellWidth: 24 },
        6: { halign: 'right',  cellWidth: 24 },
        7: { halign: 'center', cellWidth: 22 },
        8: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        // Columna "Pagado" en verde
        if (data.section === 'body' && data.column.index === 2) {
          data.cell.styles.textColor = [6, 120, 60];
          data.cell.styles.fontStyle = 'bold';
        }
        // Saldo después en índigo
        if (data.section === 'body' && data.column.index === 6) {
          data.cell.styles.textColor = [79, 70, 229];
        }
      },
    });

    // ── Fila de totales ────────────────────────────────────────────────────
    const finalY = (doc as any).lastAutoTable.finalY + 2;
    autoTable(doc, {
      startY: finalY,
      body: [['', 'TOTALES', formatCurrency(totalPagado), formatCurrency(totalCapital), formatCurrency(totalIntereses), '', '', '', '']],
      theme: 'plain',
      bodyStyles: { fontStyle: 'bold', fontSize: 8, fillColor: [220, 252, 231] },
      columnStyles: {
        0: { cellWidth: 9 },
        1: { cellWidth: 26 },
        2: { halign: 'right', cellWidth: 24, textColor: [6, 120, 60] },
        3: { halign: 'right', cellWidth: 22, textColor: [37, 99, 160] },
        4: { halign: 'right', cellWidth: 22, textColor: [154, 52, 18] },
        5: { cellWidth: 24 },
        6: { cellWidth: 24 },
        7: { cellWidth: 22 },
        8: { cellWidth: 'auto' },
      },
      margin: { left: 14, right: 14 },
    });

    // ── Nota legal ─────────────────────────────────────────────────────────
    const notaY2 = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(7.5); doc.setTextColor(120, 120, 120); doc.setFont('helvetica', 'italic');
    const nota2 =
      'Este documento es un historial oficial de pagos del cr\u00e9dito indicado, generado por el sistema UFCA. ' +
      'Cada fila corresponde a una transacci\u00f3n registrada por la administraci\u00f3n. ' +
      'Para consultas o aclaraciones, comun\u00edquese con la administraci\u00f3n de UFCA.';
    doc.text(doc.splitTextToSize(nota2, pageW - 28), 14, notaY2);

    addFooter(doc);

    const nombreArchivo = `Historial_${numCredito}_${
      credito.asociado?.replace(/\s+/g, '_') || 'N/A'
    }.pdf`;
    doc.save(nombreArchivo);
    return true;
  } catch (err) {
    console.error('Error al generar historial PDF:', err);
    return false;
  }
};

// ==================== PDF INFORME DE CARTERA ====================
export const generateCarteraPDF = (datos: {
  creditos:         any[];
  creditosAnulados: any[];
  totalCartera:     number;
  totalCuotaMensual: number;
  tasaPromedio:     number;
  plazoPromedio:    number;
  countByEstado:    Record<string, number>;
  fechaInforme:     string;
}): boolean => {
  try {
    const {
      creditos, creditosAnulados,
      totalCartera, totalCuotaMensual,
      tasaPromedio, plazoPromedio,
      countByEstado, fechaInforme,
    } = datos;

    const estadosLabel: Record<string, string> = {
      pendiente:    'Pendiente',
      en_revision:  'En revisión',
      aprobado:     'Aprobado',
      desembolsado: 'Desembolsado',
      rechazado:    'Rechazado',
    };

    const doc = new jsPDF();
    let yPos = addHeader(doc, 'INFORME DE DESEMPEÑO DE CARTERA');

    // ── Fecha ───────────────────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Fecha de generación: ${fechaInforme}`, 20, yPos);
    yPos += 10;

    // ── 1. Resumen general ──────────────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('1. RESUMEN GENERAL DE CARTERA', 20, yPos);
    yPos += 7;

    // Cartera = suma de montos. Cuota mensual = lo que ingresa cada mes.
    const promedioMonto   = creditos.length > 0 ? Math.round(totalCartera / creditos.length) : 0;
    const promedioCuota   = creditos.length > 0 ? Math.round(totalCuotaMensual / creditos.length) : 0;
    // Cuota mensual como % de la cartera total (velocidad de recuperación mensual)
    const pctRecuperacion = totalCartera > 0
      ? ((totalCuotaMensual / totalCartera) * 100).toFixed(2)
      : '0.00';

    const kpis: [string, string][] = [
      ['Créditos activos',                    `${creditos.length}`],
      ['Créditos anulados',                   `${creditosAnulados.length}`],
      ['Cartera total (suma de montos)',       formatCurrency(totalCartera)],
      ['Monto promedio por crédito',          formatCurrency(promedioMonto)],
      ['Recaudo mensual total (suma cuotas)', formatCurrency(totalCuotaMensual)],
      ['Cuota mensual promedio',              formatCurrency(promedioCuota)],
      ['% Cuota / Cartera (recuperación mensual)', `${pctRecuperacion}%`],
      ['Tasa de interés promedio EA',
        tasaPromedio > 0 ? `${tasaPromedio.toFixed(2)}%` : 'Sin tasa registrada'],
      ['Plazo promedio',
        plazoPromedio > 0 ? `${plazoPromedio} meses` : 'N/A'],
    ];

    autoTable(doc, {
      startY: yPos,
      body: kpis,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [60, 60, 60], cellWidth: 95 },
        1: { textColor: [16, 80, 160], fontStyle: 'bold' },
      },
      margin: { left: 20, right: 20 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ── 2. Distribución por estado ───────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('2. DISTRIBUCIÓN POR ESTADO DE APROBACIÓN', 20, yPos);
    yPos += 5;

    const totalActivos = creditos.length || 1;
    const estadosData = Object.entries(countByEstado).map(([key, count]) => {
      const enEstado      = creditos.filter((c: any) => c.estadoAprobacion === key);
      const montoEstado   = enEstado.reduce((s: number, c: any) => s + (c.monto ?? 0), 0);
      const cuotaEstado   = enEstado.reduce((s: number, c: any) => s + (c.cuotaMensual ?? 0), 0);
      const pct           = ((count / totalActivos) * 100).toFixed(1);
      return [
        estadosLabel[key] ?? key,
        `${count}`,
        `${pct}%`,
        formatCurrency(montoEstado),
        formatCurrency(cuotaEstado),
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Estado', 'Cant.', '% total', 'Monto (cartera)', 'Cuota mensual']],
      body: estadosData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
      margin: { left: 20, right: 20 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ── 3. Indicadores de desempeño ──────────────────────────────────────────
    if (yPos > 220) { doc.addPage(); yPos = 20; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('3. INDICADORES DE DESEMPEÑO', 20, yPos);
    yPos += 5;

    const desembolsados    = countByEstado['desembolsado'] ?? 0;
    const aprobados        = countByEstado['aprobado']     ?? 0;
    const pendientes       = countByEstado['pendiente']    ?? 0;
    const rechazados       = countByEstado['rechazado']    ?? 0;
    const enRevision       = countByEstado['en_revision']  ?? 0;
    const totalSolicitudes = creditos.length + creditosAnulados.length;

    const indicadores: [string, string][] = [
      ['Tasa de aprobación (aprobados + desembolsados)',
        totalSolicitudes > 0
          ? `${(((desembolsados + aprobados) / totalSolicitudes) * 100).toFixed(1)}%`
          : 'N/A'],
      ['Tasa de rechazo',
        totalSolicitudes > 0
          ? `${((rechazados / totalSolicitudes) * 100).toFixed(1)}%`
          : 'N/A'],
      ['Tasa de anulación',
        totalSolicitudes > 0
          ? `${((creditosAnulados.length / totalSolicitudes) * 100).toFixed(1)}%`
          : 'N/A'],
      ['Créditos en proceso (pendiente + en revisión)', `${pendientes + enRevision}`],
      ['Créditos productivos (aprobados + desembolsados)', `${aprobados + desembolsados}`],
      ['Velocidad de recuperación mensual', `${pctRecuperacion}% de la cartera por mes`],
    ];

    autoTable(doc, {
      startY: yPos,
      body: indicadores,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [60, 60, 60], cellWidth: 110 },
        1: { textColor: [16, 80, 160], fontStyle: 'bold' },
      },
      margin: { left: 20, right: 20 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ── 4. Listado detallado ─────────────────────────────────────────────────
    if (yPos > 200) { doc.addPage(); yPos = 20; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('4. LISTADO DETALLADO DE CRÉDITOS ACTIVOS', 20, yPos);
    yPos += 5;

    const listaData = creditos.map((c: any) => [
      c.asociado        || 'N/A',
      c.cedula          || 'N/A',
      formatCurrency(c.monto        ?? 0),   // cartera (monto otorgado)
      formatCurrency(c.cuotaMensual ?? 0),   // cuota mensual
      c.tasaInteres > 0 ? `${c.tasaInteres}%` : '—',
      `${c.plazo ?? 0} m.`,
      estadosLabel[c.estadoAprobacion] ?? c.estadoAprobacion ?? 'N/A',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Asociado', 'Cédula', 'Monto (cartera)', 'Cuota mensual', 'Tasa EA', 'Plazo', 'Estado']],
      body: listaData,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7.5 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
      },
      margin: { left: 10, right: 10 },
    });

    addFooter(doc);
    const fechaArchivo = new Date().toISOString().slice(0, 10);
    doc.save(`Informe_Cartera_UFCA_${fechaArchivo}.pdf`);
    return true;
  } catch (error) {
    console.error('Error al generar informe de cartera:', error);
    return false;
  }
};

// ==================== PDF DE LIQUIDACIÓN ====================
export const generateLiquidacionPDF = (liquidacion: any) => {
  try {
    const doc = new jsPDF();
    let yPos = addHeader(doc, 'CERTIFICADO DE LIQUIDACIÓN');
    
    yPos += 5;
    
    // Información del asociado
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL ASOCIADO', 20, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const liquidacionInfo = [
      ['Asociado:', liquidacion.asociado || 'N/A'],
      ['Cédula:', liquidacion.cedula || 'N/A'],
      ['Fecha de solicitud:', liquidacion.fechaSolicitud || new Date().toLocaleDateString('es-CO')],
      ['Motivo del retiro:', liquidacion.motivoRetiro || 'N/A'],
      ['Estado:', liquidacion.estado || 'Solicitada'],
      ['Fecha de liquidación:', liquidacion.fechaLiquidacion || 'Pendiente'],
    ];
    
    liquidacionInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 75, yPos);
      yPos += 7;
    });
    
    yPos += 10;
    
    // Detalle del cálculo
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DEL CÁLCULO', 20, yPos);
    yPos += 5;
    
    const totalAhorro = liquidacion.totalAhorro || 0;
    const totalCreditos = liquidacion.totalCreditos || 0;
    const saldoAFavor = liquidacion.saldoAFavor || (totalAhorro - totalCreditos);
    
    const ahorroPermamente = totalAhorro * 0.65;
    const ahorroVoluntario = totalAhorro * 0.35;
    
    const detalleCalculo = [
      ['Ahorro permanente', formatCurrency(ahorroPermamente)],
      ['Ahorro voluntario', formatCurrency(ahorroVoluntario)],
      ['TOTAL AHORROS', formatCurrency(totalAhorro)],
      ['', ''],
      ['(-) Créditos pendientes', formatCurrency(totalCreditos)],
      ['', ''],
      ['TOTAL A LIQUIDAR', formatCurrency(saldoAFavor)],
    ];
    
    autoTable(doc, {
      startY: yPos,
      head: [['Concepto', 'Monto']],
      body: detalleCalculo,
      theme: 'plain',
      headStyles: { 
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      margin: { left: 20, right: 20 },
      styles: { fontSize: 10 },
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: function(data) {
        // Resaltar la fila del total
        if (data.row.index === 2 || data.row.index === 6) {
          data.cell.styles.fillColor = [229, 229, 229];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 11;
        }
        // Fila vacía
        if (data.row.index === 3 || data.row.index === 5) {
          data.cell.styles.minCellHeight = 2;
        }
      }
    });
    
    // Resumen final
    yPos = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SALDO A FAVOR DEL ASOCIADO:', 20, yPos);
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(18);
    doc.text(formatCurrency(saldoAFavor), 20, yPos + 10);
    doc.setTextColor(0, 0, 0);
    
    yPos += 25;
    
    // Nota legal
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const nota = 'Este documento certifica la liquidación de aportes del asociado. El desembolso se realizará según los términos y condiciones establecidos en el reglamento interno de UFCA. El asociado declara estar conforme con el cálculo presentado y renuncia a cualquier reclamación posterior.';
    const splitNota = doc.splitTextToSize(nota, 170);
    doc.text(splitNota, 20, yPos);
    
    // Footer
    addFooter(doc);
    
    // Guardar
    doc.save(`Liquidacion_${liquidacion.asociado?.replace(/\s/g, '_') || 'N/A'}.pdf`);
    return true;
  } catch (error) {
    console.error('Error al generar PDF de Liquidación:', error);
    return false;
  }
};

// ==================== PDF DE AHORRO PERMANENTE ====================
export const generateAhorroPermanentePDF = (ahorro: any) => {
  try {
    const doc = new jsPDF();
    let yPos = addHeader(doc, 'EXTRACTO DE AHORRO PERMANENTE');

    yPos += 5;

    // ── Rango del extracto ──────────────────────────────────────────────────
    if (ahorro.rangoInicio && ahorro.rangoFin) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(80, 80, 80);
      doc.text(
        `Período: ${ahorro.rangoInicio} al ${ahorro.rangoFin}`,
        20, yPos
      );
      doc.setTextColor(0, 0, 0);
      yPos += 8;
    }

    // ── Información del asociado ────────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL ASOCIADO', 20, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const ahorroInfo: [string, string][] = [
      ['Asociado:',         ahorro.asociado      || 'N/A'],
      ['Cédula:',           ahorro.cedula         || 'N/A'],
      ['Fecha de inicio:',  ahorro.fechaAfiliacion || 'N/A'],
      ['Cuota mensual:',    formatCurrency(ahorro.aporteActual || 0)],
      ['Estado del plan:',  ahorro.estado ? 'Activo' : 'Inactivo'],
    ];

    ahorroInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 75, yPos);
      yPos += 7;
    });

    yPos += 8;

    // ── Saldo destacado ─────────────────────────────────────────────────────
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(15, yPos - 5, 180, 22, 3, 3, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70);
    doc.text('SALDO ACTUAL:', 20, yPos + 5);
    doc.setFontSize(16);
    doc.text(formatCurrency(ahorro.saldoAcumulado || 0), 75, yPos + 5);
    doc.setTextColor(0, 0, 0);
    yPos += 28;

    // ── Historial real de transacciones ────────────────────────────────────
    const movimientos: any[] = ahorro.movimientos || [];

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const titulo = movimientos.length > 0
      ? `HISTORIAL DE TRANSACCIONES (${movimientos.length} registro${movimientos.length > 1 ? 's' : ''})`
      : 'HISTORIAL DE TRANSACCIONES';
    doc.text(titulo, 20, yPos);
    yPos += 5;

    if (movimientos.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text('No hay transacciones registradas en el período seleccionado.', 20, yPos + 8);
      doc.setTextColor(0, 0, 0);
      yPos += 20;
    } else {
      const historialRows = movimientos.map((m: any) => [
        m.fecha_movimiento || '—',
        m.tipo_movimiento  || '—',
        m.descripcion      || '—',
        formatCurrency(m.monto        || 0),
        formatCurrency(m.saldo_anterior || 0),
        formatCurrency(m.saldo_nuevo   || 0),
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Fecha', 'Tipo', 'Descripción', 'Monto', 'Saldo anterior', 'Saldo nuevo']],
        body: historialRows,
        theme: 'striped',
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
        },
        margin: { left: 15, right: 15 },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 22 },
          2: { cellWidth: 50 },
          3: { halign: 'right', cellWidth: 28 },
          4: { halign: 'right', cellWidth: 28 },
          5: { halign: 'right', cellWidth: 28 },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 1) {
            const tipo = data.cell.raw as string;
            if (tipo === 'Aporte' || tipo === 'Apertura') {
              data.cell.styles.textColor = [6, 95, 70];
              data.cell.styles.fontStyle = 'bold';
            } else if (tipo === 'Retiro') {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // ── Resumen totales ───────────────────────────────────────────────────
      const totalAportado = movimientos
        .filter((m: any) => (m.tipo_movimiento === 'Aporte' || m.tipo_movimiento === 'Apertura') && !m.anulado)
        .reduce((acc: number, m: any) => acc + (m.monto || 0), 0);

      const totalRetirado = movimientos
        .filter((m: any) => m.tipo_movimiento === 'Retiro' && !m.anulado)
        .reduce((acc: number, m: any) => acc + (m.monto || 0), 0);

      const resumenRows = [
        ['Total depositado en el período:', formatCurrency(totalAportado)],
        ['Total retirado en el período:',   formatCurrency(totalRetirado)],
        ['Saldo actual del plan:',          formatCurrency(ahorro.saldoAcumulado || 0)],
      ];

      autoTable(doc, {
        startY: yPos,
        body: resumenRows,
        theme: 'plain',
        margin: { left: 90, right: 15 },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 75 },
          1: { halign: 'right',  cellWidth: 35, fontStyle: 'bold', textColor: [6, 95, 70] },
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // ── Nota legal ──────────────────────────────────────────────────────────
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const nota = 'Este extracto certifica el estado del ahorro permanente del asociado en el período indicado. Los aportes mensuales son obligatorios según el reglamento de UFCA. Para consultas, comuníquese con la administración.';
    const splitNota = doc.splitTextToSize(nota, 170);
    doc.text(splitNota, 20, yPos);

    addFooter(doc);
    doc.save(`Extracto_Ahorro_${ahorro.asociado?.replace(/\s+/g, '_') || 'N/A'}_${ahorro.rangoInicio ?? ''}_${ahorro.rangoFin ?? ''}.pdf`);
    return true;
  } catch (error) {
    console.error('Error al generar PDF de Ahorro Permanente:', error);
    return false;
  }
};

// ==================== PDF DE AHORRO VOLUNTARIO ====================
export const generateAhorroVoluntarioPDF = (ahorro: any) => {
  try {
    const doc = new jsPDF();
    let yPos = addHeader(doc, 'CERTIFICADO DE AHORRO VOLUNTARIO');
    
    yPos += 5;
    
    // Información del asociado
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL ASOCIADO', 20, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const ahorroInfo = [
      ['Asociado:', ahorro.asociado || 'N/A'],
      ['Cédula:', ahorro.cedula || 'N/A'],
      ['Estado del ahorro:', ahorro.estado ? 'Activo' : 'Inactivo'],
    ];
    
    ahorroInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 75, yPos);
      yPos += 7;
    });
    
    yPos += 10;
    
    // Resumen de ahorros
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN DE AHORROS VOLUNTARIOS', 20, yPos);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    
    const resumenInfo = [
      ['Total aportes realizados:', `${ahorro.totalAportes || 0} aportes`],
      ['Último aporte:', formatCurrency(ahorro.ultimoAporte || 0)],
      ['Fecha último aporte:', ahorro.fechaUltimoAporte || 'N/A'],
      ['Saldo total acumulado:', formatCurrency(ahorro.montoTotal || 0)],
    ];
    
    resumenInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 75, yPos);
      yPos += 7;
    });
    
    yPos += 10;
    
    // Saldo total destacado
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SALDO TOTAL ACUMULADO:', 20, yPos);
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(18);
    doc.text(formatCurrency(ahorro.montoTotal || 0), 20, yPos + 10);
    doc.setTextColor(0, 0, 0);
    
    yPos += 25;
    
    // Información adicional
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Características del Ahorro Voluntario:', 20, yPos);
    yPos += 8;
    
    doc.setFontSize(9);
    const caracteristicas = [
      '• Los aportes son opcionales y pueden realizarse en cualquier momento.',
      '• No hay monto mínimo ni máximo establecido por aporte.',
      '• Los fondos pueden ser retirados cuando el asociado lo solicite.',
      '• El ahorro voluntario genera rendimientos según las políticas de UFCA.',
      '• Los retiros están sujetos a disponibilidad de caja y tiempo de procesamiento.',
    ];
    
    caracteristicas.forEach((item) => {
      doc.text(item, 20, yPos);
      yPos += 6;
    });
    
    yPos += 10;
    
    // Nota informativa
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const nota = 'Este documento certifica el estado actual del ahorro voluntario del asociado. Para realizar aportes o retiros, comuníquese con la administración de UFCA. Los retiros están sujetos a los términos y condiciones establecidos en el reglamento interno.';
    const splitNota = doc.splitTextToSize(nota, 170);
    doc.text(splitNota, 20, yPos);
    
    // Footer
    addFooter(doc);

    // Guardar
    doc.save(`Ahorro_Voluntario_${ahorro.asociado?.replace(/\s/g, '_') || 'N/A'}.pdf`);
    return true;
  } catch (error) {
    console.error('Error al generar PDF de Ahorro Voluntario:', error);
    return false;
  }
};

/**
 * Genera el PDF de Ahorro Voluntario y devuelve un objeto con:
 * - url: blob URL para previsualizar en <iframe>
 * - filename: nombre sugerido para descarga
 * - download(): función para disparar la descarga directa
 * Retorna null si ocurre algún error.
 */
export const buildAhorroVoluntarioPDF = (ahorro: any): {
  url: string;
  filename: string;
  download: () => void;
} | null => {
  try {
    const doc = new jsPDF();
    let yPos = addHeader(doc, 'CERTIFICADO DE AHORRO VOLUNTARIO');

    yPos += 5;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL ASOCIADO', 20, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const ahorroInfo = [
      ['Asociado:', ahorro.asociado || 'N/A'],
      ['Cédula:', ahorro.cedula || 'N/A'],
      ['Estado del ahorro:', ahorro.estado ? 'Activo' : 'Inactivo'],
    ];

    ahorroInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 75, yPos);
      yPos += 7;
    });

    yPos += 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN DE AHORROS VOLUNTARIOS', 20, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    const resumenInfo = [
      ['Total aportes realizados:', `${ahorro.totalAportes || 0} aportes`],
      ['Último aporte:', formatCurrency(ahorro.ultimoAporte || 0)],
      ['Fecha último aporte:', ahorro.fechaUltimoAporte || 'N/A'],
      ['Saldo total acumulado:', formatCurrency(ahorro.montoTotal || 0)],
    ];

    resumenInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 75, yPos);
      yPos += 7;
    });

    yPos += 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('SALDO TOTAL ACUMULADO:', 20, yPos);
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(18);
    doc.text(formatCurrency(ahorro.montoTotal || 0), 20, yPos + 10);
    doc.setTextColor(0, 0, 0);

    yPos += 25;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Características del Ahorro Voluntario:', 20, yPos);
    yPos += 8;

    doc.setFontSize(9);
    const caracteristicas = [
      '• Los aportes son opcionales y pueden realizarse en cualquier momento.',
      '• No hay monto mínimo ni máximo establecido por aporte.',
      '• Los fondos pueden ser retirados cuando el asociado lo solicite.',
      '• El ahorro voluntario genera rendimientos según las políticas de UFCA.',
      '• Los retiros están sujetos a disponibilidad de caja y tiempo de procesamiento.',
    ];
    caracteristicas.forEach((item) => {
      doc.text(item, 20, yPos);
      yPos += 6;
    });

    yPos += 10;

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const nota = 'Este documento certifica el estado actual del ahorro voluntario del asociado. Para realizar aportes o retiros, comuníquese con la administración de UFCA.';
    doc.text(doc.splitTextToSize(nota, 170), 20, yPos);

    addFooter(doc);

    const filename = `Ahorro_Voluntario_${ahorro.asociado?.replace(/\s/g, '_') || 'N/A'}.pdf`;
    const blob     = doc.output('blob');
    const url      = URL.createObjectURL(blob);

    return {
      url,
      filename,
      download: () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
      },
    };
  } catch (error) {
    console.error('Error al construir PDF de Ahorro Voluntario:', error);
    return null;
  }
};