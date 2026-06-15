import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8').replace(/\r/g, '');
const processEnv = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const parts = trimmed.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let value = parts.slice(1).join('=').trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    processEnv[key] = value;
  }
});

const supabaseUrl = processEnv.VITE_SUPABASE_URL;
const supabaseServiceKey = processEnv.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const crearHojaConEstilo = (
  wb,
  sheetName,
  title,
  headers,
  headerColor,
  headerBorderColor,
  zebraColor,
  data,
  colWidths,
  currencyCols = [],
  percentCols = [],
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
    rowData.forEach((val, ci) => {
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

async function testExport() {
  try {
    const { data: usuariosData, error: errUsrs } = await supabase
      .from('usuarios')
      .select('id, nombre, cedula');
    if (errUsrs) throw errUsrs;

    const usuariosMap = {};
    (usuariosData || []).forEach(u => { usuariosMap[u.id] = u; });

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

    // ── Hoja 0: Portada ──
    const wsPortada = wb.addWorksheet('Resumen General', { views: [{ showGridLines: false }] });
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
      ['🔵 Cartera Créditos', 'Detalle de créditos otorgados, saldos pendientes y plazos', `${creditosList.length} registros`, 'Azul'],
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

    // Hoja 1: Créditos (azul)
    const creditData = (creditosList || []).map((c, i) => {
      const usr = usuariosMap[c.asociado_id] || {};
      return [i + 1, usr.cedula || '—', usr.nombre || '—', c.monto || 0, c.saldo ?? c.monto, c.cuota_mensual || 0, c.tasa_interes || 0, c.plazo_meses || 0, c.fecha_desembolso || '—', (c.estado || '—').toUpperCase()];
    });
    crearHojaConEstilo(wb, 'Cartera Créditos', 'CARTERA DE CRÉDITOS',
      ['#', 'Cédula', 'Nombre', 'Monto Otorgado', 'Saldo Pendiente', 'Cuota Mensual', 'Tasa (%)', 'Plazo', 'Fecha Desembolso', 'Estado'],
      'FF2563EB', 'FF1D4ED8', 'FFEFF6FF',
      creditData,
      [5, 14, 28, 18, 18, 16, 12, 10, 18, 14],
      [4, 5, 6], [7],
    );

    // Hoja 2: Ahorros (verde)
    const ahorroData = (ahorrosList || []).map((a, i) => {
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

    // Hoja 3: Liquidaciones (naranja)
    const liqData = (liquidacionesList || []).map((l, i) => {
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

    // Hoja 4: Transacciones (púrpura)
    const transData = (pagosList || []).map((p, i) => {
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

    const outPath = path.resolve(__dirname, 'consolidated_test.xlsx');
    await wb.xlsx.writeFile(outPath);
    console.log("SUCCESS! Saved file to:", outPath);
    
    // Read the file back and verify sheets count and names
    const checkWb = new ExcelJS.Workbook();
    await checkWb.xlsx.readFile(outPath);
    console.log("Worksheets in file:");
    checkWb.worksheets.forEach((ws, idx) => {
      console.log(`- Sheet #${idx + 1}: Name="${ws.name}", rows=${ws.rowCount}`);
    });
  } catch (err) {
    console.error("ERROR IN EXPORT:", err);
  }
}

testExport();
