import { useState, useEffect } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { FileText, Download, Search, PiggyBank, FileSpreadsheet } from 'lucide-react';
import { formatCurrency } from '../lib/formatters';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Asociado {
  id: string;
  nombre: string;
  cedula: string;
}

export default function ReportesScreen() {
  const { userRole, userData } = useAuth();
  const [activeTab, setActiveTab] = useState('extractos');

  // Buscador de asociados (solo admin)
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

  // Estados
  const [, setLoadingAsociados] = useState(false);
  const [loadingDatos, setLoadingDatos] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Si es asociado, se autoselecciona
  useEffect(() => {
    if (userRole === 'asociado' && userData) {
      setSelectedAsociado({
        id: userData.id,
        nombre: userData.nombre || userData.name || 'Asociado',
        cedula: userData.cedula || ''
      });
    }
  }, [userRole, userData]);

  // Buscar asociados (Admin)
  useEffect(() => {
    if (userRole !== 'admin') return;
    if (searchTerm.length < 3) {
      if (searchTerm.length === 0) setAsociados([]);
      return;
    }
    const fetchAsociados = async () => {
      setLoadingAsociados(true);
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('id, nombre, cedula')
          .eq('rol_id', (await supabase.from('roles').select('id').eq('nombre', 'asociado').single()).data?.id)
          .or(`nombre.ilike.%${searchTerm}%,cedula.ilike.%${searchTerm}%`)
          .limit(10);
        if (error) throw error;
        setAsociados(data || []);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoadingAsociados(false);
      }
    };
    const timer = setTimeout(fetchAsociados, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, userRole]);

  // Cargar datos
  useEffect(() => {
    if (!selectedAsociado) {
      setAhorroPermanente(null); setAhorroVoluntario(null); setCreditos([]);
      return;
    }
    const cargarDatos = async () => {
      setLoadingDatos(true);
      try {
        const { data: ahorros, error: errAhorros } = await supabase.from('cuentas_ahorro').select('*').eq('asociado_id', selectedAsociado.id);
        if (errAhorros) throw errAhorros;

        const perm = ahorros?.find(a => a.tipo === 'permanente');
        const vol = ahorros?.find(a => a.tipo === 'voluntario');
        setAhorroPermanente(perm || null);
        setAhorroVoluntario(vol || null);

        const { data: creds, error: errCreds } = await supabase.from('creditos').select('*').eq('asociado_id', selectedAsociado.id);
        if (errCreds) throw errCreds;
        setCreditos(creds || []);
      } catch (err) {
        toast.error('Error cargando datos del asociado');
      } finally {
        setLoadingDatos(false);
      }
    };
    cargarDatos();
  }, [selectedAsociado]);

  const generarExtractoPdf = async () => {
    if (!selectedAsociado) return toast.error('Selecciona un asociado');
    if (!fechaInicio || !fechaFin) return toast.error('Selecciona fechas');

    setGeneratingPdf(true);
    try {
      const { data: transacciones, error } = await supabase
        .from('transacciones')
        .select('*')
        .eq('asociado_id', selectedAsociado.id)
        .gte('fecha_pago', fechaInicio)
        .lte('fecha_pago', fechaFin)
        .order('fecha_pago', { ascending: true });

      if (error) throw error;

      const doc = new jsPDF();
      
      doc.setFillColor(16, 185, 129);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('UFCA', 15, 18);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Unión Familiar de Crédito y Ahorro', 15, 25);
      
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('EXTRACTO CONSOLIDADO', 15, 50);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Asociado: ${selectedAsociado.nombre}`, 15, 60);
      doc.text(`Cédula: ${selectedAsociado.cedula}`, 15, 65);
      doc.text(`Periodo: ${fechaInicio} a ${fechaFin}`, 15, 70);

      let yPos = 80;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMEN DE PRODUCTOS', 15, yPos);
      yPos += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ahorro Permanente:`, 15, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(`${formatCurrency(ahorroPermanente?.monto_ahorrado || 0)} (${ahorroPermanente?.estado || 'Sin cuenta'})`, 65, yPos);
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      doc.text(`Ahorro Voluntario:`, 15, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(`${formatCurrency(ahorroVoluntario?.monto_ahorrado || 0)} (${ahorroVoluntario?.estado || 'Sin cuenta'})`, 65, yPos);
      yPos += 6;

      const totalCreditos = creditos.reduce((sum, c) => sum + (c.saldo || 0), 0);
      doc.setFont('helvetica', 'normal');
      doc.text(`Saldo Total Créditos:`, 15, yPos);
      doc.setFont('helvetica', 'bold');
      doc.text(`${formatCurrency(totalCreditos)} (${creditos.filter(c => c.estado === 'activo' || c.estado === 'desembolsado').length} activos)`, 65, yPos);
      yPos += 12;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('MOVIMIENTOS DEL PERIODO', 15, yPos);
      yPos += 5;

      const tableData = (transacciones || []).map(t => [
        t.fecha_pago,
        t.tipo.replace(/_/g, ' ').toUpperCase(),
        t.monto > 0 ? formatCurrency(t.monto) : '',
        t.monto < 0 ? formatCurrency(Math.abs(t.monto)) : ''
      ]);

      if (tableData.length === 0) {
        tableData.push(['—', 'Sin movimientos en este periodo', '—', '—']);
      }

      autoTable(doc, {
        startY: yPos,
        head: [['Fecha', 'Concepto', 'Ingreso', 'Egreso']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 15, right: 15 }
      });

      const pdfOutput = doc.output('blob');
      setPdfBlob(pdfOutput);
      const url = URL.createObjectURL(pdfOutput);
      setPdfPreviewUrl(url);
      setIsPdfPreviewOpen(true);

    } catch (err) {
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
    link.download = `Extracto_${selectedAsociado.cedula}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Descargando...');
  };

  const exportarCarteraCsv = async () => {
    setExportingCsv(true);
    try {
      const { data: creditosList, error } = await supabase
        .from('creditos')
        .select(`id, monto, saldo, cuota_mensual, tasa_interes, plazo_meses, estado, usuarios (nombre, cedula)`);

      if (error) throw error;
      if (!creditosList || creditosList.length === 0) return toast.info('No hay créditos');

      const headers = ['ID', 'Cedula', 'Nombre', 'Monto', 'Saldo', 'Cuota', 'Tasa', 'Plazo', 'Estado'];
      const rows = creditosList.map(c => {
        const u = c.usuarios as any;
        return [
          c.id, u?.cedula || '', u?.nombre || '',
          c.monto || 0, c.saldo ?? c.monto, c.cuota_mensual || 0,
          c.tasa_interes || 0, c.plazo_meses || 0, c.estado || ''
        ];
      });

      descargarArchivoCsv(headers, rows, `Cartera.csv`);
    } catch (err) {
      toast.error('Error exportando');
    } finally {
      setExportingCsv(false);
    }
  };

  const exportarPagosCsv = async () => {
    setExportingCsv(true);
    try {
      let query = supabase.from('transacciones').select(`id, tipo, monto, fecha_pago, estado, usuarios!transacciones_asociado_id_fkey (nombre, cedula)`).order('fecha_pago', { ascending: false });
      if (selectedAsociado) query = query.eq('asociado_id', selectedAsociado.id);
      
      const { data: pagos, error } = await query;
      if (error) throw error;
      if (!pagos || pagos.length === 0) return toast.info('No hay pagos');

      const headers = ['Fecha', 'Cedula', 'Nombre', 'Tipo', 'Monto', 'Estado'];
      const rows = pagos.map(p => {
        const u = p.usuarios as any;
        return [
          p.fecha_pago || '', u?.cedula || '', u?.nombre || '',
          p.tipo || '', p.monto || 0, p.estado || ''
        ];
      });

      descargarArchivoCsv(headers, rows, selectedAsociado ? `Pagos_${selectedAsociado.cedula}.csv` : 'Historial_Pagos.csv');
    } catch (err) {
      toast.error('Error exportando');
    } finally {
      setExportingCsv(false);
    }
  };

  const descargarArchivoCsv = (headers: string[], rows: any[][], filename: string) => {
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Reportes</h2>
        <p className="text-xs text-muted-foreground">Extractos y exportación de datos</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="extractos" className="text-xs gap-1.5"><FileText className="size-3.5"/> Extractos</TabsTrigger>
          <TabsTrigger value="exportacion" className="text-xs gap-1.5"><FileSpreadsheet className="size-3.5"/> Exportar</TabsTrigger>
        </TabsList>

        <TabsContent value="extractos" className="space-y-4">
          {userRole === 'admin' && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input placeholder="Buscar asociado..." className="pl-9 h-10 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                {asociados.length > 0 && (
                  <div className="mt-2 border rounded-md divide-y max-h-40 overflow-y-auto">
                    {asociados.map(a => (
                      <div key={a.id} className="p-2.5 text-sm cursor-pointer hover:bg-slate-50" onClick={() => { setSelectedAsociado(a); setSearchTerm(''); setAsociados([]); }}>
                        <p className="font-medium text-slate-800">{a.nombre}</p>
                        <p className="text-xs text-slate-500">CC: {a.cedula}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selectedAsociado && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-emerald-900">{selectedAsociado.nombre}</p>
                  <p className="text-xs text-emerald-700">C.C. {selectedAsociado.cedula}</p>
                </div>
                {userRole === 'admin' && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedAsociado(null)} className="h-7 text-xs px-2 text-emerald-700">Cambiar</Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="border-l-4 border-l-emerald-500 shadow-sm border-y-0 border-r-0 rounded-lg">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">Ahorros</p>
                    <p className="text-sm font-bold mt-1 text-slate-800">
                      {loadingDatos ? '...' : formatCurrency((ahorroPermanente?.monto_ahorrado || 0) + (ahorroVoluntario?.monto_ahorrado || 0))}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 shadow-sm border-y-0 border-r-0 rounded-lg">
                  <CardContent className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">Créditos</p>
                    <p className="text-sm font-bold mt-1 text-slate-800">
                      {loadingDatos ? '...' : formatCurrency(creditos.reduce((s, c) => s + (c.saldo || 0), 0))}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Fecha Inicial</Label>
                      <Input type="date" className="h-9 text-xs" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Fecha Final</Label>
                      <Input type="date" className="h-9 text-xs" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                    </div>
                  </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2 h-10" onClick={generarExtractoPdf} disabled={generatingPdf || loadingDatos}>
                    {generatingPdf ? <div className="size-4 animate-spin border-2 border-white border-t-transparent rounded-full"/> : <FileText className="size-4" />}
                    Generar PDF
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="exportacion" className="space-y-4">
          {userRole === 'admin' && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                <div className="p-3 bg-blue-50 rounded-full text-blue-600"><FileSpreadsheet className="size-6"/></div>
                <div>
                  <p className="text-sm font-bold">Cartera de Créditos</p>
                  <p className="text-xs text-muted-foreground">Estado global de préstamos</p>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 gap-2 h-10" onClick={exportarCarteraCsv} disabled={exportingCsv}>
                  <Download className="size-4"/> Exportar CSV
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div className="p-3 bg-emerald-50 rounded-full text-emerald-600"><PiggyBank className="size-6"/></div>
              <div>
                <p className="text-sm font-bold">Historial de Pagos</p>
                <p className="text-xs text-muted-foreground">Transacciones de ahorros y créditos</p>
              </div>
              <Button variant="outline" className="w-full border-emerald-200 text-emerald-700 gap-2 h-10" onClick={exportarPagosCsv} disabled={exportingCsv}>
                <Download className="size-4"/> {selectedAsociado ? `Pagos de ${selectedAsociado.nombre.split(' ')[0]}` : 'Exportar CSV'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isPdfPreviewOpen} onOpenChange={(open) => { if (!open) { setIsPdfPreviewOpen(false); setPdfPreviewUrl(''); }}}>
        <DialogContent className="w-[95vw] max-w-md p-0 overflow-hidden flex flex-col max-h-[85vh]">
          <DialogHeader className="p-4 border-b shrink-0 bg-white">
            <DialogTitle className="text-base flex items-center gap-2"><FileText className="size-4 text-emerald-600"/> Vista previa</DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-slate-100 min-h-[300px] relative">
            {pdfPreviewUrl && <iframe src={pdfPreviewUrl} className="absolute inset-0 w-full h-full border-0" />}
          </div>
          <div className="p-3 bg-white border-t shrink-0 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsPdfPreviewOpen(false)}>Cerrar</Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={descargarPdf}>
              <Download className="size-4"/> Descargar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
