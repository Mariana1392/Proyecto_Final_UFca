import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { FileText, Download, Calendar, Search, PiggyBank, FileSpreadsheet, User, CheckCircle2, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../lib/formatters';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { dashboardApi } from '../lib/api';

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

  // Estados de carga
  const [loadingAsociados, setLoadingAsociados] = useState(false);
  const [loadingDatos, setLoadingDatos] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Utilidades
  const [utilidadesData, setUtilidadesData] = useState<any>(null);
  const [loadingUtilidades, setLoadingUtilidades] = useState(false);

  // Buscar asociados
  useEffect(() => {
    if (searchTerm.length < 3) {
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
          .or(`nombre.ilike.%${searchTerm}%,cedula.ilike.%${searchTerm}%`)
          .limit(10);
          
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
    const timer = setTimeout(fetchAsociados, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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
      
      // Header
      doc.setFillColor(16, 185, 129);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('UFCA', 20, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Unión Familiar de Crédito y Ahorro', 20, 28);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('EXTRACTO CONSOLIDADO', 20, 55);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Asociado: ${selectedAsociado.nombre}`, 20, 65);
      doc.text(`Cédula: ${selectedAsociado.cedula}`, 20, 70);
      doc.text(`Periodo: ${fechaInicio} a ${fechaFin}`, 20, 75);

      let yPos = 85;

      // Resumen Ahorros
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMEN DE PRODUCTOS', 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ahorro Permanente:`, 20, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(`${formatCurrency(ahorroPermanente?.monto_ahorrado || 0)} (${ahorroPermanente?.estado || 'Sin cuenta'})`, 80, yPos);
      yPos += 7;

      doc.setFont('helvetica', 'normal');
      doc.text(`Ahorro Voluntario:`, 20, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(`${formatCurrency(ahorroVoluntario?.monto_ahorrado || 0)} (${ahorroVoluntario?.estado || 'Sin cuenta'})`, 80, yPos);
      yPos += 7;

      const totalCreditos = creditos.reduce((sum, c) => sum + (c.saldo || 0), 0);
      doc.setFont('helvetica', 'normal');
      doc.text(`Saldo Total Créditos:`, 20, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(`${formatCurrency(totalCreditos)} (${creditos.filter(c => c.estado === 'activo' || c.estado === 'desembolsado').length} activos)`, 80, yPos);
      yPos += 15;

      // Tabla de Movimientos
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('MOVIMIENTOS DEL PERIODO', 20, yPos);
      yPos += 5;

      const tableData = (transacciones || []).map(t => [
        t.fecha_pago,
        t.tipo.replace(/_/g, ' ').toUpperCase(),
        t.metodo_pago || '—',
        t.monto > 0 ? formatCurrency(t.monto) : '',
        t.monto < 0 ? formatCurrency(Math.abs(t.monto)) : ''
      ]);

      if (tableData.length === 0) {
        tableData.push(['—', 'Sin movimientos en este periodo', '—', '—', '—']);
      }

      autoTable(doc, {
        startY: yPos,
        head: [['Fecha', 'Concepto', 'Método', 'Ingreso', 'Egreso']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 20, 290);
        doc.text(`Página ${i} de ${pageCount}`, 190, 290, { align: 'right' });
      }

      const pdfOutput = doc.output('blob');
      setPdfBlob(pdfOutput);
      const url = URL.createObjectURL(pdfOutput);
      setPdfPreviewUrl(url);
      setIsPdfPreviewOpen(true);

    } catch (err) {
      console.error('Error generando extracto:', err);
      toast.error('Hubo un error al generar el extracto');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const descargarPdf = () => {
    if (!pdfBlob || !selectedAsociado) return;
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Extracto_${selectedAsociado.cedula}_${fechaInicio}_al_${fechaFin}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Extracto descargado correctamente');
  };

  const exportarUtilidadesCsv = () => {
    if (!utilidadesData || utilidadesData.historial.length === 0) {
      return toast.info('No hay datos de utilidades para exportar');
    }
    
    const cabeceras = ['Fecha', 'Asociado', 'Cedula', 'Tipo de Transaccion', 'Monto Mora (Utilidad)'];
    const lineas = [cabeceras.join(',')];
    
    utilidadesData.historial.forEach((r: any) => {
      const linea = [
        new Date(r.fecha_pago).toLocaleDateString('es-CO'),
        r.asociado?.nombre ?? 'Desconocido',
        r.asociado?.cedula ?? 'N/A',
        r.tipo.replace(/_/g, ' ').toUpperCase(),
        r.monto_mora
      ].map(c => `"${c}"`).join(',');
      lineas.push(linea);
    });
    
    const blob = new Blob([lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `utilidades_mora_ufca_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Reporte de utilidades exportado a CSV');
  };

  const exportarCarteraCsv = async () => {
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
        return toast.info('No hay créditos registrados para exportar');
      }

      const asocIds = [...new Set(creditosList.map((c: any) => c.asociado_id).filter(Boolean))];
      const usuariosMap: Record<string, any> = {};
      if (asocIds.length > 0) {
        const { data: usrsData } = await supabase
          .from('usuarios').select('id, nombre, cedula').in('id', asocIds);
        (usrsData || []).forEach((u: any) => { usuariosMap[u.id] = u; });
      }

      const headers = ['ID Credito', 'Cedula Asociado', 'Nombre Asociado', 'Monto Otorgado', 'Saldo Pendiente', 'Cuota', 'Tasa (%)', 'Plazo (Meses)', 'Fecha Desembolso', 'Estado'];
      const rows = creditosList.map((c: any) => {
        const usr = usuariosMap[c.asociado_id] || {};
        return [
          c.id,
          usr.cedula || '—',
          usr.nombre || '—',
          c.monto || 0,
          c.saldo ?? c.monto,
          c.cuota_mensual || 0,
          c.tasa_interes || 0,
          c.plazo_meses || 0,
          c.fecha_desembolso || '—',
          c.estado || '—'
        ];
      });

      descargarArchivoCsv(headers, rows, `Cartera_Creditos_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      console.error('Error exportando cartera:', err);
      toast.error('Hubo un error exportando la cartera a CSV');
    } finally {
      setExportingCsv(false);
    }
  };

  const exportarPagosCsv = async () => {
    setExportingCsv(true);
    try {
      let query = supabase
        .from('transacciones')
        .select('*')
        .order('fecha_pago', { ascending: false });

      if (selectedAsociado) {
        query = query.eq('asociado_id', selectedAsociado.id);
      }

      const { data: pagos, error } = await query;
      if (error) throw error;

      if (!pagos || pagos.length === 0) {
        return toast.info('No hay pagos registrados para exportar');
      }

      const asocIds = [...new Set(pagos.map((p: any) => p.asociado_id).filter(Boolean))];
      const usuariosMap: Record<string, any> = {};
      if (asocIds.length > 0) {
        const { data: usrsData } = await supabase
          .from('usuarios').select('id, nombre, cedula').in('id', asocIds);
        (usrsData || []).forEach((u: any) => { usuariosMap[u.id] = u; });
      }

      const headers = ['ID Transaccion', 'Fecha Pago', 'Cedula', 'Nombre', 'Tipo', 'Monto', 'Metodo', 'Estado', 'Observacion'];
      const rows = pagos.map((p: any) => {
        const usr = usuariosMap[p.asociado_id] || {};
        return [
          p.id,
          p.fecha_pago || '—',
          usr.cedula || '—',
          usr.nombre || '—',
          p.tipo || '—',
          p.monto || 0,
          p.metodo_pago || '—',
          p.estado || '—',
          p.observacion || '—'
        ];
      });

      const nombreArchivo = selectedAsociado 
        ? `Historial_Pagos_${selectedAsociado.cedula}.csv` 
        : `Historial_Pagos_Global_${new Date().toISOString().split('T')[0]}.csv`;
        
      descargarArchivoCsv(headers, rows, nombreArchivo);
    } catch (err) {
      console.error('Error exportando pagos:', err);
      toast.error('Hubo un error exportando los pagos a CSV');
    } finally {
      setExportingCsv(false);
    }
  };

  const descargarArchivoCsv = (headers: string[], rows: any[][], filename: string) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Archivo descargado correctamente');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Módulo de Reportes</h1>
            <p className="text-slate-600">Genera extractos interactivos y exporta datos de la cooperativa</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-[600px] grid-cols-3 mb-6">
            <TabsTrigger value="extractos" className="flex items-center gap-2">
              <FileText className="size-4" /> Extractos
            </TabsTrigger>
            <TabsTrigger value="exportacion" className="flex items-center gap-2">
              <Download className="size-4" /> Exportación
            </TabsTrigger>
            <TabsTrigger value="utilidades" className="flex items-center gap-2">
              <TrendingUp className="size-4" /> Utilidades
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extractos" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <Card className="md:col-span-1 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="size-5 text-emerald-600" />
                    Seleccionar Asociado
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                    <Input
                      placeholder="Buscar por cédula o nombre..."
                      className="pl-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  {loadingAsociados ? (
                    <div className="text-center py-4 text-sm text-slate-500">Buscando...</div>
                  ) : asociados.length > 0 ? (
                    <div className="border rounded-md divide-y overflow-hidden max-h-[300px] overflow-y-auto">
                      {asociados.map(a => (
                        <div 
                          key={a.id}
                          className={`p-3 text-sm cursor-pointer hover:bg-slate-50 transition-colors ${selectedAsociado?.id === a.id ? 'bg-emerald-50 border-l-2 border-emerald-500' : ''}`}
                          onClick={() => { setSelectedAsociado(a); setSearchTerm(''); setAsociados([]); }}
                        >
                          <p className="font-medium text-slate-800">{a.nombre}</p>
                          <p className="text-slate-500 text-xs">C.C. {a.cedula}</p>
                        </div>
                      ))}
                    </div>
                  ) : searchTerm.length >= 3 ? (
                    <div className="text-center py-4 text-sm text-slate-500">No se encontraron resultados</div>
                  ) : null}

                  {selectedAsociado && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold text-emerald-900">{selectedAsociado.nombre}</p>
                        <p className="text-xs text-emerald-700">C.C. {selectedAsociado.cedula}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedAsociado(null)} className="h-8 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100">
                        Limpiar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="md:col-span-2 space-y-6">
                {selectedAsociado ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <Card className="shadow-sm border-l-4 border-l-emerald-500">
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-500 font-medium">Ahorro Permanente</p>
                          {loadingDatos ? <div className="h-8 bg-slate-100 animate-pulse rounded mt-1" /> : (
                            <>
                              <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(ahorroPermanente?.monto_ahorrado || 0)}</p>
                              <div className="flex items-center gap-1 mt-2">
                                <CheckCircle2 className={`size-3 ${ahorroPermanente?.estado === 'activo' ? 'text-emerald-500' : 'text-slate-400'}`} />
                                <span className="text-xs text-slate-500 capitalize">{ahorroPermanente?.estado || 'Sin cuenta'}</span>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm border-l-4 border-l-blue-500">
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-500 font-medium">Ahorro Voluntario</p>
                          {loadingDatos ? <div className="h-8 bg-slate-100 animate-pulse rounded mt-1" /> : (
                            <>
                              <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(ahorroVoluntario?.monto_ahorrado || 0)}</p>
                              <div className="flex items-center gap-1 mt-2">
                                <CheckCircle2 className={`size-3 ${ahorroVoluntario?.estado === 'activo' ? 'text-blue-500' : 'text-slate-400'}`} />
                                <span className="text-xs text-slate-500 capitalize">{ahorroVoluntario?.estado || 'Sin cuenta'}</span>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm border-l-4 border-l-amber-500">
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-500 font-medium">Saldo en Créditos</p>
                          {loadingDatos ? <div className="h-8 bg-slate-100 animate-pulse rounded mt-1" /> : (
                            <>
                              <p className="text-2xl font-bold text-slate-800 mt-1">
                                {formatCurrency(creditos.reduce((s, c) => s + (c.saldo || 0), 0))}
                              </p>
                              <div className="flex items-center gap-1 mt-2">
                                <TrendingUp className="size-3 text-amber-500" />
                                <span className="text-xs text-slate-500">{creditos.filter(c => c.estado === 'activo' || c.estado === 'desembolsado').length} créditos activos</span>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="shadow-sm">
                      <CardHeader className="bg-slate-50/50 border-b">
                        <CardTitle className="text-base">Generar Extracto PDF</CardTitle>
                        <CardDescription>Selecciona el periodo para visualizar los movimientos en el extracto.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="fechaInicio" className="flex items-center gap-2">
                            <Calendar className="size-4 text-slate-400" /> Fecha Inicial
                          </Label>
                          <Input
                            id="fechaInicio"
                            type="date"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fechaFin" className="flex items-center gap-2">
                            <Calendar className="size-4 text-slate-400" /> Fecha Final
                          </Label>
                          <Input
                            id="fechaFin"
                            type="date"
                            value={fechaFin}
                            onChange={(e) => setFechaFin(e.target.value)}
                          />
                        </div>
                        
                        <div className="sm:col-span-2 pt-2 flex justify-end">
                          <Button 
                            className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700" 
                            onClick={generarExtractoPdf}
                            disabled={generatingPdf || loadingDatos}
                          >
                            {generatingPdf ? (
                              <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <FileText className="size-4" />
                            )}
                            Vista Previa y Generar PDF
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 p-12">
                    <div className="text-center space-y-2">
                      <div className="p-4 bg-slate-100 rounded-full inline-block mx-auto mb-2">
                        <User className="size-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-800">Ningún asociado seleccionado</h3>
                      <p className="text-sm text-slate-500 max-w-sm">
                        Busca y selecciona un asociado en el panel lateral para ver sus saldos y generar su extracto consolidado.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="exportacion" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <Card className="shadow-sm">
                <CardHeader>
                  <div className="size-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                    <FileSpreadsheet className="size-5 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg">Exportar Créditos Globales</CardTitle>
                  <CardDescription>Descarga un archivo CSV con el estado completo de todos los créditos registrados en el sistema, saldos pendientes y asociados.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                    onClick={exportarCarteraCsv}
                    disabled={exportingCsv}
                  >
                    {exportingCsv ? <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="size-4" />}
                    Descargar Créditos Globales (CSV)
                  </Button>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
                    <PiggyBank className="size-5 text-emerald-600" />
                  </div>
                  <CardTitle className="text-lg">Exportar Historial de Pagos</CardTitle>
                  <CardDescription>Descarga todas las transacciones, aportes y pagos realizados en la cooperativa. Puedes filtrar por asociado si lo seleccionaste previamente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedAsociado && (
                    <div className="p-3 bg-slate-50 rounded border text-sm text-slate-600 flex justify-between items-center">
                      <span>Filtro activo: <strong>{selectedAsociado.nombre}</strong></span>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedAsociado(null)} className="h-6 px-2 text-xs">Quitar</Button>
                    </div>
                  )}
                  <Button 
                    variant="outline"
                    className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={exportarPagosCsv}
                    disabled={exportingCsv}
                  >
                    {exportingCsv ? <div className="size-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /> : <Download className="size-4" />}
                    {selectedAsociado ? `Descargar Pagos de ${selectedAsociado.nombre.split(' ')[0]}` : 'Descargar Todos los Pagos (CSV)'}
                  </Button>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="utilidades" className="space-y-6">
            {loadingUtilidades ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            ) : !utilidadesData ? (
              <div className="text-center p-12 text-slate-500">Error al cargar las utilidades</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md border-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-pink-100 flex items-center justify-between">
                        Utilidades Totales
                        <TrendingUp className="size-4 text-pink-200" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{formatCurrency(utilidadesData.utilidadTotal)}</div>
                      <p className="text-xs text-pink-100 mt-1">Ganancia neta por mora</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md border-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-amber-100 flex items-center justify-between">
                        Mora en Créditos
                        <FileSpreadsheet className="size-4 text-amber-200" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{formatCurrency(utilidadesData.utilidadCreditos)}</div>
                      <p className="text-xs text-amber-100 mt-1">Intereses de mora cobrados</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md border-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-emerald-100 flex items-center justify-between">
                        Mora en Ahorros
                        <PiggyBank className="size-4 text-emerald-200" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{formatCurrency(utilidadesData.utilidadAhorros)}</div>
                      <p className="text-xs text-emerald-100 mt-1">Penalidades por aportes atrasados</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">Historial de Utilidades (Mora)</CardTitle>
                      <CardDescription>Registro detallado de todas las transacciones que generaron utilidad para el fondo.</CardDescription>
                    </div>
                    <Button onClick={exportarUtilidadesCsv} className="gap-2 bg-slate-800 hover:bg-slate-700">
                      <Download className="size-4" /> Exportar a CSV
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {utilidadesData.historial.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        No hay registros de utilidades generadas por mora todavía.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                            <tr>
                              <th className="px-4 py-3 font-medium rounded-tl-lg">Fecha</th>
                              <th className="px-4 py-3 font-medium">Asociado</th>
                              <th className="px-4 py-3 font-medium">Concepto</th>
                              <th className="px-4 py-3 font-medium text-right rounded-tr-lg">Utilidad Generada</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {utilidadesData.historial.map((r: any) => (
                              <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                  {new Date(r.fecha_pago).toLocaleDateString('es-CO')}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-slate-800">{r.asociado?.nombre ?? 'Asociado Eliminado'}</div>
                                  <div className="text-xs text-slate-500">{r.asociado?.cedula ?? 'N/A'}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                    {r.tipo.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-emerald-600">
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
        <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="size-5 text-emerald-600" />
                  Vista previa — Extracto Consolidado
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs text-slate-500">
                  Revisa el documento antes de descargarlo o imprimirlo.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden bg-slate-100 relative">
            {pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0 absolute inset-0"
                title="Vista previa del extracto PDF"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-slate-200 shrink-0 flex items-center justify-between bg-slate-50">
            <p className="text-xs text-slate-500">Documento generado interactivo</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsPdfPreviewOpen(false)}>Cerrar</Button>
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={descargarPdf}
              >
                <Download className="size-4" />
                Descargar PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
