import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { 
  Search, Filter, Plus, Eye, ChevronLeft, ChevronRight, 
  Edit, Trash2, Gift, FileText
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './ui/tabs';
import { toast } from 'sonner';

interface PagosPremiosProps {
  userRole?: 'admin' | 'asociado';
}

export default function PagosPremios({ userRole = 'admin' }: PagosPremiosProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageAnulados, setCurrentPageAnulados] = useState(1);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPago, setSelectedPago] = useState<any>(null);
  const itemsPerPage = 10;

  const [isNuevoPagoOpen, setIsNuevoPagoOpen] = useState(false);
  const emptyPago = { asociado: '', cedula: '', tipoPremio: 'Cumpleaños', monto: '', metodoPago: 'Transferencia', fechaPago: new Date().toISOString().split('T')[0], concepto: '' };
  const [formPago, setFormPago] = useState(emptyPago);

  const [pagos, setPagos] = useState([
    { id: '1', asociado: 'María González Pérez', cedula: '1098765432', tipoPremio: 'Cumpleaños', monto: 100000, fechaPago: '2024-02-15', metodoPago: 'Transferencia', estado: 'Pagado', anulado: false },
    { id: '2', asociado: 'Juan Carlos Rodríguez', cedula: '1087654321', tipoPremio: 'Aniversario', monto: 150000, fechaPago: '2024-02-18', metodoPago: 'Efectivo', estado: 'Pagado', anulado: false },
    { id: '3', asociado: 'Ana María Martínez', cedula: '1076543210', tipoPremio: 'Navidad', monto: 200000, fechaPago: '2023-12-20', metodoPago: 'Transferencia', estado: 'Pagado', anulado: false },
    { id: '4', asociado: 'Pedro José Sánchez', cedula: '1065432109', tipoPremio: 'Día del padre', monto: 120000, fechaPago: '2024-06-15', metodoPago: 'Pendiente', estado: 'Pendiente', anulado: false },
    { id: '5', asociado: 'Laura Fernández López', cedula: '1054321098', tipoPremio: 'Cumpleaños', monto: 100000, fechaPago: '2024-03-10', metodoPago: 'Transferencia', estado: 'Programado', anulado: false },
    { id: '6', asociado: 'Carlos Alberto Gómez', cedula: '1043210987', tipoPremio: 'Fin de año', monto: 250000, fechaPago: '2023-12-30', metodoPago: 'Efectivo', estado: 'Pagado', anulado: false },
    { id: '7', asociado: 'Sandra Patricia Ruiz', cedula: '1032109876', tipoPremio: 'Cumpleaños', monto: 100000, fechaPago: '2024-04-22', metodoPago: 'Transferencia', estado: 'Programado', anulado: false },
    { id: '8', asociado: 'Miguel Ángel Torres', cedula: '1021098765', tipoPremio: 'Día de la madre', monto: 120000, fechaPago: '2024-05-12', metodoPago: 'Pendiente', estado: 'Pendiente', anulado: false },
  ]);

  // Filtrar pagos activos
  const pagosActivos = pagos.filter(p => !p.anulado);
  const filteredPagos = pagosActivos.filter(pago =>
    pago.asociado.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pago.cedula.includes(searchTerm) ||
    pago.tipoPremio.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtrar pagos anulados
  const pagosAnulados = pagos.filter(p => p.anulado);
  const filteredPagosAnulados = pagosAnulados.filter(pago =>
    pago.asociado.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pago.cedula.includes(searchTerm) ||
    pago.tipoPremio.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginación para activos
  const totalPages = Math.ceil(filteredPagos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPagos = filteredPagos.slice(startIndex, endIndex);

  // Paginación para anulados
  const totalPagesAnulados = Math.ceil(filteredPagosAnulados.length / itemsPerPage);
  const startIndexAnulados = (currentPageAnulados - 1) * itemsPerPage;
  const endIndexAnulados = startIndexAnulados + itemsPerPage;
  const currentPagosAnulados = filteredPagosAnulados.slice(startIndexAnulados, endIndexAnulados);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getEstadoColor = (estado: string) => {
    const colores: { [key: string]: string } = {
      'Pagado': 'bg-emerald-100 text-emerald-700',
      'Pendiente': 'bg-amber-100 text-amber-700',
      'Programado': 'bg-blue-100 text-blue-700',
      'Cancelado': 'bg-red-100 text-red-700'
    };
    return colores[estado] || 'bg-slate-100 text-slate-700';
  };

  const handleAnular = () => {
    if (!selectedPago) return;
    
    setPagos(prev => prev.map(p =>
      p.id === selectedPago.id ? { ...p, anulado: true } : p
    ));
    
    toast.success(`Pago de premio para "${selectedPago.asociado}" anulado exitosamente`);
    setIsDeleteDialogOpen(false);
    setSelectedPago(null);
  };

  const handleEdit = () => {
    toast.success('Pago de premio actualizado exitosamente');
    setIsEditDialogOpen(false);
    setSelectedPago(null);
  };

  const renderTable = (pagosList: any[], isAnulados: boolean = false) => (
    <>
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asociado</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Tipo de premio</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Fecha de pago</TableHead>
              <TableHead>Método de pago</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagosList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                  {isAnulados ? 'No hay pagos anulados' : 'No hay pagos registrados'}
                </TableCell>
              </TableRow>
            ) : (
              pagosList.map((pago) => (
                <TableRow key={pago.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isAnulados ? 'bg-slate-100' : 'bg-rose-100'}`}>
                        <Gift className={`size-4 ${isAnulados ? 'text-slate-600' : 'text-rose-600'}`} />
                      </div>
                      <p className="text-slate-900">{pago.asociado}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{pago.cedula}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-slate-700">
                      {pago.tipoPremio}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-900">{formatCurrency(pago.monto)}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{pago.fechaPago}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-slate-600">{pago.metodoPago}</p>
                  </TableCell>
                  <TableCell>
                    {isAnulados ? (
                      <Badge className="bg-red-100 text-red-700">
                        Anulado
                      </Badge>
                    ) : (
                      <Select
                        defaultValue={pago.estado}
                        onValueChange={(value: any) => {
                          setPagos(prev => prev.map(p =>
                            p.id === pago.id ? { ...p, estado: value } : p
                          ));
                          toast.success(`Estado actualizado a "${value}"`);
                        }}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pendiente">Pendiente</SelectItem>
                          <SelectItem value="Programado">Programado</SelectItem>
                          <SelectItem value="Pagado">Pagado</SelectItem>
                          <SelectItem value="Cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedPago(pago);
                          setIsDetailModalOpen(true);
                        }}
                        title="Ver detalles"
                      >
                        <Eye className="size-4" />
                      </Button>
                      {!isAnulados && userRole === 'admin' && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => toast.success('PDF generado (funcionalidad demo)')}
                            title="Ver PDF"
                            className="hover:bg-emerald-50"
                          >
                            <FileText className="size-4 text-emerald-600" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedPago(pago);
                              setIsDeleteDialogOpen(true);
                            }}
                            title="Anular pago"
                          >
                            <Trash2 className="size-4 text-amber-600" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">Pagos de Premios</h1>
            <p className="text-slate-600">Gestiona los pagos de premios a los asociados</p>
          </div>
          {userRole === 'admin' && (
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsNuevoPagoOpen(true)}>
              <Plus className="size-4" />
              Nuevo pago
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle>Lista de Pagos de Premios</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input
                    placeholder="Buscar..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                      setCurrentPageAnulados(1);
                    }}
                  />
                </div>
                <Button variant="outline" className="gap-2">
                  <Filter className="size-4" />
                  Filtros
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="activos" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="activos" className="gap-2">
                  <Gift className="size-4" />
                  Pagos Activos ({filteredPagos.length})
                </TabsTrigger>
                <TabsTrigger value="anulados" className="gap-2">
                  <Trash2 className="size-4" />
                  Pagos Anulados ({filteredPagosAnulados.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="activos" className="space-y-4">
                {renderTable(currentPagos, false)}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredPagos.length)} de {filteredPagos.length} pagos
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={currentPage === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="anulados" className="space-y-4">
                {renderTable(currentPagosAnulados, true)}
                {filteredPagosAnulados.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600">
                      Mostrando {startIndexAnulados + 1} a {Math.min(endIndexAnulados, filteredPagosAnulados.length)} de {filteredPagosAnulados.length} pagos
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurrentPageAnulados(prev => Math.max(1, prev - 1))} disabled={currentPageAnulados === 1}>
                        <ChevronLeft className="size-4" />
                      </Button>
                      {Array.from({ length: totalPagesAnulados }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={currentPageAnulados === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPageAnulados(page)}
                          className={currentPageAnulados === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setCurrentPageAnulados(prev => Math.min(totalPagesAnulados, prev + 1))} disabled={currentPageAnulados === totalPagesAnulados}>
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Detalles */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del pago de premio</DialogTitle>
            <DialogDescription>
              Información completa del pago
            </DialogDescription>
          </DialogHeader>
          {selectedPago && (
            <div className="space-y-4">
              <div>
                <Label className="text-slate-600">Asociado</Label>
                <p className="text-slate-900 mt-1">{selectedPago.asociado}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Cédula</Label>
                  <p className="text-slate-900 mt-1">{selectedPago.cedula}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Tipo de premio</Label>
                  <p className="text-slate-900 mt-1">{selectedPago.tipoPremio}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Monto</Label>
                  <p className="text-slate-900 mt-1">{formatCurrency(selectedPago.monto)}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Fecha de pago</Label>
                  <p className="text-slate-900 mt-1">{selectedPago.fechaPago}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-600">Método de pago</Label>
                  <p className="text-slate-900 mt-1">{selectedPago.metodoPago}</p>
                </div>
                <div>
                  <Label className="text-slate-600">Estado</Label>
                  <Badge className={selectedPago.anulado ? 'bg-red-100 text-red-700' : getEstadoColor(selectedPago.estado)}>
                    {selectedPago.anulado ? 'Anulado' : selectedPago.estado}
                  </Badge>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailModalOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar pago de premio</DialogTitle>
            <DialogDescription>
              Actualiza la información del pago
            </DialogDescription>
          </DialogHeader>
          {selectedPago && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="asociado">Asociado</Label>
                <Input id="asociado" defaultValue={selectedPago.asociado} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipoPremio">Tipo de premio</Label>
                <Input id="tipoPremio" defaultValue={selectedPago.tipoPremio} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monto">Monto</Label>
                  <Input id="monto" type="number" defaultValue={selectedPago.monto} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fechaPago">Fecha de pago</Label>
                  <Input id="fechaPago" type="date" defaultValue={selectedPago.fechaPago} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metodoPago">Método de pago</Label>
                <Input id="metodoPago" defaultValue={selectedPago.metodoPago} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setSelectedPago(null);
            }}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleEdit}>
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog para Anular */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este pago de premio?</AlertDialogTitle>
            <AlertDialogDescription>
              El pago será marcado como anulado y se moverá a la pestaña de "Pagos Anulados". El registro se conservará en el historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPago(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnular} className="bg-amber-600 hover:bg-amber-700">
              Anular pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Diálogo: Nuevo Pago Premio (CA_144) ──────────────────────────── */}
      <Dialog open={isNuevoPagoOpen} onOpenChange={open => { setIsNuevoPagoOpen(open); if (!open) setFormPago(emptyPago); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gift className="size-5 text-emerald-600" /> Registrar Pago de Premio</DialogTitle>
            <DialogDescription>Registra un bono, incentivo o premio para un asociado.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre del asociado <span className="text-red-500">*</span></Label>
                <Input value={formPago.asociado} onChange={e => setFormPago(p => ({ ...p, asociado: e.target.value }))} placeholder="Nombre completo" />
              </div>
              <div className="space-y-1.5">
                <Label>Cédula <span className="text-red-500">*</span></Label>
                <Input value={formPago.cedula} onChange={e => setFormPago(p => ({ ...p, cedula: e.target.value }))} placeholder="Número de cédula" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo de premio <span className="text-red-500">*</span></Label>
                <Select value={formPago.tipoPremio} onValueChange={v => setFormPago(p => ({ ...p, tipoPremio: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cumpleaños">Cumpleaños</SelectItem>
                    <SelectItem value="Aniversario">Aniversario</SelectItem>
                    <SelectItem value="Navidad">Navidad</SelectItem>
                    <SelectItem value="Día del padre">Día del padre</SelectItem>
                    <SelectItem value="Día de la madre">Día de la madre</SelectItem>
                    <SelectItem value="Fin de año">Fin de año</SelectItem>
                    <SelectItem value="Incentivo">Incentivo</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Monto <span className="text-red-500">*</span></Label>
                <Input type="number" min={0} value={formPago.monto} onChange={e => setFormPago(p => ({ ...p, monto: e.target.value }))} placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Método de pago</Label>
                <Select value={formPago.metodoPago} onValueChange={v => setFormPago(p => ({ ...p, metodoPago: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de pago</Label>
                <Input type="date" value={formPago.fechaPago} onChange={e => setFormPago(p => ({ ...p, fechaPago: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Concepto / observaciones</Label>
              <Input value={formPago.concepto} onChange={e => setFormPago(p => ({ ...p, concepto: e.target.value }))} placeholder="Descripción del premio..." />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNuevoPagoOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!formPago.asociado.trim() || !formPago.cedula.trim() || !formPago.monto) {
                  toast.error('Completa los campos obligatorios: asociado, cédula y monto');
                  return;
                }
                const nuevo = {
                  id:         Date.now().toString(),
                  asociado:   formPago.asociado,
                  cedula:     formPago.cedula,
                  tipoPremio: formPago.tipoPremio,
                  monto:      Number(formPago.monto),
                  fechaPago:  formPago.fechaPago,
                  metodoPago: formPago.metodoPago,
                  estado:     'Pendiente',
                  anulado:    false,
                };
                setPagos(prev => [nuevo, ...prev]);
                toast.success('Pago de premio registrado exitosamente');
                setIsNuevoPagoOpen(false);
                setFormPago(emptyPago);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              <Gift className="size-4" /> Registrar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}